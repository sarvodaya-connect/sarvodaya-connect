import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import type { Principal } from '../auth/principal.js';
import {
  ALLOWED_CONTENT_TYPES,
  maxUploadBytes,
} from '../documents/upload-rules.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
  StorageUnavailableError,
} from '../storage/document-storage.js';
import {
  actingScope,
  canCoordinate,
  coversSociety,
  type EmergencyScope,
  isEmptyScope,
  societyScopeFilter,
  viewingScope,
} from './emergency-access.policy.js';
import type {
  AssignHelpersDto,
  CreateActionDto,
  CreateEvidenceDto,
  CreateReportDto,
  OpenIncidentDto,
  SendAssessmentDto,
  SocietyListQueryDto,
  UpdateDeliveryDto,
} from './emergency.dto.js';
import {
  actionState,
  DEFAULT_ASSESSMENT_WINDOW_MS,
  defaultIncidentTitle,
  distanceKm,
  INCIDENT_EVENTS,
  incidentReference,
  startedAtProblem,
} from './emergency-format.js';
import {
  EmergenciesRepository,
  type SocietyRowRecord,
} from './emergencies.repository.js';

const societyRefSelect = {
  id: true,
  nameEn: true,
  societyCode: true,
  districtId: true,
  district: { select: { nameEn: true } },
} as const;

const incidentInclude = {
  reportingSociety: { select: societyRefSelect },
} as const;

type IncidentRecord = Prisma.EmergencyIncidentGetPayload<{
  include: typeof incidentInclude;
}>;
type SocietyRefRecord = Prisma.SocietyGetPayload<{
  select: typeof societyRefSelect;
}>;

const ROLE_NAMES: Record<string, string> = {
  HQ_ADMIN: 'HQ',
  DISTRICT_MANAGER: 'DM',
  DEPUTY_DISTRICT_MANAGER: 'DDM',
  PROGRAMME_COORDINATOR: 'SPC',
  SOCIETY_OFFICER: 'Society Officer',
};

/** At most this many photos or PDFs per assessment or delivery. */
const MAX_EVIDENCE_PER_RECORD = 10;
const LIST_LIMIT = 100;
const ACTION_LIMIT = 200;
const HISTORY_LIMIT = 10;

function actorFields(principal: Principal) {
  return {
    actorId: principal.id,
    actorName: principal.displayName,
    actorRole: principal.roles[0] ?? null,
  };
}

function societyRef(society: SocietyRefRecord) {
  return {
    id: society.id,
    name: society.nameEn,
    code: society.societyCode,
    districtName: society.district.nameEn,
  };
}

/** "26 Oct, 6:00 p.m." in Sri Lanka time, for notification text. */
function sriLankaTime(value: Date) {
  const local = new Date(value.getTime() + 330 * 60_000);
  const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  const hour = local.getUTCHours() % 12 || 12;
  const minute = String(local.getUTCMinutes()).padStart(2, '0');
  return `${local.getUTCDate()} ${months[local.getUTCMonth()]}, ${hour}:${minute} ${local.getUTCHours() < 12 ? 'a.m.' : 'p.m.'}`;
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string } | null)?.code === 'P2002';
}

/**
 * V5 PR 8: disaster response for every role (D30–D33, IR01–IR05, M40–M49).
 * Every request works out what the user may see and do from their scope and
 * the database; deadlines and statuses are never kept in memory.
 */
@Injectable()
export class EmergenciesService {
  private readonly logger = new Logger(EmergenciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: EmergenciesRepository,
    private readonly notifications: NotificationsService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly config: ConfigService,
  ) {}

  /** V5 D30 list: incidents covering any society the user may see. */
  async list(principal: Principal, status: 'ACTIVE' | 'CLOSED') {
    const scope = viewingScope(principal);
    const visible = await this.visibleIncidentFilter(scope);
    const statusFilter = (s: 'ACTIVE' | 'CLOSED') =>
      s === 'CLOSED'
        ? { status: 'CLOSED' as const }
        : { status: { in: ['ACTIVE' as const, 'CONTAINED' as const] } };
    const [rows, active, closed] = await executeDatabaseOperation(() =>
      Promise.all([
        this.prisma.emergencyIncident.findMany({
          where: { ...visible, ...statusFilter(status) },
          include: incidentInclude,
          orderBy: [{ activatedAt: 'desc' }, { id: 'asc' }],
          take: LIST_LIMIT,
        }),
        this.prisma.emergencyIncident.count({
          where: { ...visible, ...statusFilter('ACTIVE') },
        }),
        this.prisma.emergencyIncident.count({
          where: { ...visible, ...statusFilter('CLOSED') },
        }),
      ]),
    );
    const summaries = await this.summaries(rows);
    return { data: summaries, counts: { active, closed } };
  }

  /** V5 D30, IR02, M48: anyone may open an incident for a society they act for. */
  async open(input: OpenIncidentDto, principal: Principal) {
    const now = new Date();
    const society = await executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id: input.reportingSocietyId },
        select: { ...societyRefSelect, status: true },
      }),
    );
    if (!society) throw new NotFoundException('Society not found');
    if (!coversSociety(actingScope(principal), society)) {
      throw new ForbiddenException(
        'You can report an incident only for a society you look after',
      );
    }
    const districtIds = [
      ...new Set([society.districtId, ...input.districtIds]),
    ];
    const districts = await executeDatabaseOperation(() =>
      this.prisma.district.findMany({
        where: { id: { in: districtIds } },
        select: { id: true, nameEn: true },
      }),
    );
    if (districts.length !== districtIds.length) {
      throw new BadRequestException('Choose districts from the list');
    }
    const startedAt = new Date(input.startedAt);
    const problem = startedAtProblem(startedAt, now);
    if (problem) throw new BadRequestException(problem);
    const dueAt = input.assessmentsDueAt
      ? new Date(input.assessmentsDueAt)
      : new Date(startedAt.getTime() + DEFAULT_ASSESSMENT_WINDOW_MS);
    if (dueAt <= startedAt) {
      throw new BadRequestException(
        'Assessments must be due after the incident started',
      );
    }
    const names = new Map(districts.map((d) => [d.id, d.nameEn]));
    const areaNames = districtIds.map((id) => names.get(id)!);
    const incident = await executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.emergencyIncident.create({
          data: {
            districtId: society.districtId,
            areaDistrictIds: districtIds,
            reportingSocietyId: society.id,
            title: input.title ?? defaultIncidentTitle(input.type, areaNames),
            type: input.type,
            description: input.description ?? '',
            message: input.message ?? '',
            location: areaNames.join(', ').slice(0, 200),
            createdById: principal.id,
            createdByName: principal.displayName,
            createdByRole: principal.roles[0] ?? null,
            startedAt,
            assessmentsDueAt: dueAt,
          },
          include: incidentInclude,
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'INCIDENT_OPENED',
            targetId: created.id,
            societyId: society.id,
            districtId: society.districtId,
            detail: incidentReference(
              created.referenceNumber,
              created.activatedAt,
            ),
          },
        });
        return created;
      }),
    );
    await this.notify(
      () => this.audience({ districtIds, includeHq: true }),
      principal,
      {
        title: `New incident: ${incident.title}`,
        body: `Opened by ${principal.displayName} (${society.nameEn}). ${areaNames.join(' and ')}. Send a rapid assessment by ${sriLankaTime(dueAt)}.${incident.message ? ` ${incident.message}` : ''}`,
        linkPath: `/emergencies/${incident.id}`,
      },
      incident.id,
    );
    return (await this.summaries([incident]))[0]!;
  }

  /** V5 D31 / IR01: the live incident for the user's scope. */
  async details(id: string, principal: Principal) {
    const now = new Date();
    const scope = viewingScope(principal, now);
    const incident = await this.visibleIncident(id, scope);
    const area = incident.areaDistrictIds;
    const acting = actingScope(principal);
    const isActive = incident.status !== 'CLOSED';
    const [
      [summary],
      totals,
      recent,
      actions,
      history,
      reports,
      assessable,
      canAct,
    ] = await Promise.all([
      this.summaries([incident]),
      this.totals(incident.id, area),
      this.repository.societyRows({
        incidentId: incident.id,
        areaDistrictIds: area,
        scope,
        state: 'ALL',
        limit: 5,
        offset: 0,
      }),
      this.actions(incident.id, principal, scope),
      this.history(incident.id, scope),
      executeDatabaseOperation(() =>
        this.prisma.emergencySituationReport.findMany({
          where: { incidentId: incident.id, number: { not: null } },
          orderBy: { number: 'desc' },
          take: 50,
        }),
      ),
      isActive
        ? executeDatabaseOperation(() =>
            this.prisma.society.findMany({
              where: {
                districtId: { in: area },
                status: 'ACTIVE',
                ...societyScopeFilter(acting),
              },
              select: societyRefSelect,
              orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
              take: 500,
            }),
          )
        : Promise.resolve([]),
      this.coversArea(acting, area),
    ]);
    return {
      incident: summary!,
      permissions: {
        canAssess: isActive && assessable.length > 0,
        canClose: isActive && canAct,
        canAssign: isActive && canCoordinate(principal),
        canReport: canCoordinate(principal),
      },
      totals,
      recentAssessments: recent
        .filter((row) => row.lastReceivedAt)
        .map((row) => this.toRow(row, acting, isActive)),
      actions,
      history,
      reports: reports.map((report) => ({
        id: report.id,
        number: report.number!,
        asOf: (report.asOf ?? report.createdAt).toISOString(),
        createdBy: report.createdByName,
      })),
      assessableSocieties: assessable.map(societyRef),
      lastReminderAt: incident.lastReminderAt?.toISOString() ?? null,
    };
  }

  /** V5 D31 "All 96": the area's societies in the user's scope, a page at a time. */
  async societies(
    id: string,
    query: SocietyListQueryDto,
    principal: Principal,
  ) {
    const scope = viewingScope(principal);
    const incident = await this.visibleIncident(id, scope);
    const rows = await this.repository.societyRows({
      incidentId: incident.id,
      areaDistrictIds: incident.areaDistrictIds,
      scope,
      state: query.state,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    const totalItems = rows[0]?.total ?? 0;
    return {
      data: rows.map((row) =>
        this.toRow(row, actingScope(principal), incident.status !== 'CLOSED'),
      ),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  /** V5 M43 and the phone home: one society's state and its sent updates. */
  async society(id: string, societyId: string, principal: Principal) {
    const scope = viewingScope(principal);
    const incident = await this.visibleIncident(id, scope);
    const [row] = await this.repository.societyRows({
      incidentId: incident.id,
      areaDistrictIds: incident.areaDistrictIds,
      scope,
      state: 'ALL',
      societyIds: [societyId],
      limit: 1,
      offset: 0,
    });
    if (!row) throw new NotFoundException('Society not found');
    const updates = await executeDatabaseOperation(() =>
      this.prisma.emergencyAssessment.findMany({
        where: { incidentId: incident.id, societyId, status: 'SUBMITTED' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          id: true,
          createdAt: true,
          createdByName: true,
          impact: true,
          _count: {
            select: { evidence: { where: { uploadedAt: { not: null } } } },
          },
        },
      }),
    );
    const [summary] = await this.summaries([incident]);
    return {
      incident: summary!,
      row: this.toRow(
        row,
        actingScope(principal),
        incident.status !== 'CLOSED',
      ),
      updates: updates
        .map((update, index) => ({
          id: update.id,
          number: index + 1,
          sentAt: update.createdAt.toISOString(),
          sentBy: update.createdByName,
          impact: update.impact,
          photos: update._count.evidence,
        }))
        .reverse(),
    };
  }

  /**
   * V5 M41–M43, IR03: a rapid assessment, sent online. Each send is a new
   * update; the latest one counts. A retry with the same clientMutationId
   * returns the update already received.
   */
  async sendAssessment(
    id: string,
    input: SendAssessmentDto,
    principal: Principal,
  ) {
    const incident = await this.visibleIncident(id, viewingScope(principal));
    const replay = await executeDatabaseOperation(() =>
      this.prisma.emergencyAssessment.findUnique({
        where: {
          createdById_clientMutationId: {
            createdById: principal.id,
            clientMutationId: input.clientMutationId,
          },
        },
      }),
    );
    if (replay) {
      if (
        replay.incidentId !== incident.id ||
        replay.societyId !== input.societyId
      ) {
        throw new ConflictException(
          'This assessment ID was already used for another society',
        );
      }
      return {
        id: replay.id,
        sentAt: replay.createdAt.toISOString(),
        replayed: true,
      };
    }
    this.assertActive(incident);
    const society = await this.areaSociety(input.societyId, incident);
    if (!coversSociety(actingScope(principal), society)) {
      throw new ForbiddenException(
        'You can send an assessment only for a society you look after',
      );
    }
    const record = await executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.emergencyAssessment.create({
          data: {
            incidentId: incident.id,
            societyId: society.id,
            clientMutationId: input.clientMutationId,
            status: 'SUBMITTED',
            observedAt: new Date(),
            impact: input.impact,
            householdsAffected: input.families,
            peopleAffected: input.people,
            housesFullyDamaged: input.housesFully,
            housesPartlyDamaged: input.housesPartly,
            injured: input.injured,
            displacedPeople: input.displaced,
            roadAccess: input.roadAccess,
            needs: input.needs,
            notes: input.note,
            confirmedWithPresident: input.confirmedWithPresident,
            createdById: principal.id,
            createdByName: principal.displayName,
          },
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'INCIDENT_ASSESSMENT_SENT',
            targetId: incident.id,
            societyId: society.id,
            districtId: society.districtId,
            detail: incidentReference(
              incident.referenceNumber,
              incident.activatedAt,
            ),
          },
        });
        return created;
      }),
    );
    return {
      id: record.id,
      sentAt: record.createdAt.toISOString(),
      replayed: false,
    };
  }

  /** V5 IR04, M49: close an incident. Records who closed it and when. */
  async close(id: string, principal: Principal) {
    const incident = await this.visibleIncident(id, viewingScope(principal));
    this.assertActive(incident);
    if (
      !(await this.coversArea(actingScope(principal), incident.areaDistrictIds))
    ) {
      throw new ForbiddenException(
        'You can close an incident only when it covers a society you look after',
      );
    }
    const closedAt = new Date();
    const closed = await executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const changed = await tx.emergencyIncident.updateMany({
          where: { id, status: { not: 'CLOSED' } },
          data: {
            status: 'CLOSED',
            closedAt,
            closedById: principal.id,
            closedByName: principal.displayName,
            closedByRole: principal.roles[0] ?? null,
          },
        });
        if (changed.count === 0) {
          throw new ConflictException('This incident is already closed');
        }
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'INCIDENT_CLOSED',
            targetId: id,
            districtId: incident.districtId,
            detail: incidentReference(
              incident.referenceNumber,
              incident.activatedAt,
            ),
          },
        });
        return tx.emergencyIncident.findUniqueOrThrow({
          where: { id },
          include: incidentInclude,
        });
      }),
    );
    await this.notify(
      () =>
        this.audience({
          districtIds: incident.areaDistrictIds,
          includeHq: true,
        }),
      principal,
      {
        title: `Incident closed: ${incident.title}`,
        body: `Closed by ${principal.displayName} (${ROLE_NAMES[principal.roles[0] ?? ''] ?? 'staff'}) on ${sriLankaTime(closedAt)}.`,
        linkPath: `/emergencies/${id}`,
      },
      id,
    );
    return (await this.summaries([closed]))[0]!;
  }

  /** V5 D31 "Reminder sent": HQ tells the societies that have not sent an assessment. */
  async remind(id: string, principal: Principal) {
    this.assertCoordinator(principal);
    const incident = await this.visibleIncident(id, viewingScope(principal));
    this.assertActive(incident);
    const missing = await this.repository.notAssessedSocieties(
      incident.id,
      incident.areaDistrictIds,
    );
    const now = new Date();
    await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.emergencyIncident.update({
          where: { id },
          data: { lastReminderAt: now },
        }),
        this.prisma.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'INCIDENT_REMINDER_SENT',
            targetId: id,
            detail: `${missing.length} societies`,
          },
        }),
      ]),
    );
    const notified = missing.length
      ? await this.notify(
          () =>
            this.audience({
              societyIds: missing.map((s) => s.id),
              districtIds: [...new Set(missing.map((s) => s.districtId))],
            }),
          principal,
          {
            title: `Assessment due: ${incident.title}`,
            body: incident.assessmentsDueAt
              ? `Send a rapid assessment for your society by ${sriLankaTime(incident.assessmentsDueAt)}.`
              : 'Send a rapid assessment for your society.',
            linkPath: `/emergencies/${id}`,
          },
          id,
        )
      : 0;
    return { societies: missing.length, notified, sentAt: now.toISOString() };
  }

  /** V5 D32: HQ records a need for a society in the area. */
  async createAction(id: string, input: CreateActionDto, principal: Principal) {
    this.assertCoordinator(principal);
    const incident = await this.visibleIncident(id, viewingScope(principal));
    const replay = await executeDatabaseOperation(() =>
      this.prisma.emergencyResponseAction.findUnique({
        where: {
          createdById_clientMutationId: {
            createdById: principal.id,
            clientMutationId: input.clientMutationId,
          },
        },
      }),
    );
    if (replay) {
      if (replay.incidentId !== incident.id) {
        throw new ConflictException('This action ID was already used');
      }
      return { id: replay.id, replayed: true };
    }
    this.assertActive(incident);
    const society = await this.areaSociety(input.societyId, incident);
    const action = await executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.emergencyResponseAction.create({
          data: {
            incidentId: incident.id,
            societyId: society.id,
            clientMutationId: input.clientMutationId,
            need: input.need,
            title: input.title,
            quantity: input.quantity,
            unit: input.unit,
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            createdById: principal.id,
            createdByName: principal.displayName,
          },
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'INCIDENT_NEED_ADDED',
            targetId: incident.id,
            societyId: society.id,
            districtId: society.districtId,
            detail: `${input.title} · ${input.quantity}${input.unit ? ` ${input.unit}` : ''}`,
          },
        });
        return created;
      }),
    );
    return { id: action.id, replayed: false };
  }

  /** V5 D32: societies HQ could ask to help, nearest unaffected ones first. */
  async helpingCandidates(actionId: string, principal: Principal) {
    this.assertCoordinator(principal);
    const action = await this.findAction(actionId, principal);
    const target = action.society;
    if (!target) return [];
    const societies = await executeDatabaseOperation(() =>
      this.prisma.society.findMany({
        where: {
          status: 'ACTIVE',
          districtId: {
            in: [
              ...new Set([
                target.districtId,
                ...action.incident.areaDistrictIds,
              ]),
            ],
          },
        },
        select: { ...societyRefSelect, latitude: true, longitude: true },
        take: 500,
      }),
    );
    const latest = await executeDatabaseOperation(() =>
      this.prisma.emergencyAssessment.findMany({
        where: {
          incidentId: action.incidentId,
          status: 'SUBMITTED',
          societyId: { in: societies.map((s) => s.id) },
        },
        orderBy: { createdAt: 'desc' },
        select: { societyId: true, impact: true },
        take: 2000,
      }),
    );
    const impactOf = new Map<string, string>();
    for (const row of latest) {
      if (!impactOf.has(row.societyId)) impactOf.set(row.societyId, row.impact);
    }
    const rank = (state: string) =>
      state === 'SAFE' ? 0 : state === 'NOT_ASSESSED' ? 1 : 2;
    return societies
      .filter((s) => s.id !== target.id)
      .map((s) => ({
        society: societyRef(s),
        state: impactOf.get(s.id) ?? 'NOT_ASSESSED',
        distanceKm: distanceKm(target, s),
      }))
      .sort(
        (a, b) =>
          rank(a.state) - rank(b.state) ||
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
          a.society.name.localeCompare(b.society.name),
      )
      .slice(0, 30);
  }

  /** V5 D32: HQ assigns the societies that will help with a need. */
  async assignHelpers(
    actionId: string,
    input: AssignHelpersDto,
    principal: Principal,
  ) {
    this.assertCoordinator(principal);
    const action = await this.findAction(actionId, principal);
    this.assertActive(action.incident);
    const ids = input.helpers.map((h) => h.societyId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Choose each helping society once');
    }
    const helpers = await executeDatabaseOperation(() =>
      this.prisma.society.findMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        select: societyRefSelect,
      }),
    );
    if (helpers.length !== ids.length) {
      throw new BadRequestException('Choose active societies to help');
    }
    const dueAt = new Date(input.dueAt);
    try {
      await executeDatabaseOperation(() =>
        this.prisma.$transaction(async (tx) => {
          await tx.emergencyActionHelper.createMany({
            data: input.helpers.map((h) => ({
              actionId,
              helperSocietyId: h.societyId,
              quantity: h.quantity,
              note: input.note ?? '',
              assignedById: principal.id,
              assignedByName: principal.displayName,
            })),
          });
          await tx.emergencyResponseAction.update({
            where: { id: actionId },
            data: { dueAt },
          });
          await tx.platformAuditEvent.create({
            data: {
              ...actorFields(principal),
              action: 'INCIDENT_HELPERS_ASSIGNED',
              targetId: action.incidentId,
              societyId: action.societyId,
              districtId: action.society?.districtId ?? null,
              detail:
                `${action.title} · ${helpers.map((h) => h.nameEn).join(', ')}`.slice(
                  0,
                  2000,
                ),
            },
          });
        }),
      );
    } catch (error) {
      const cause = (error as { cause?: unknown }).cause ?? error;
      if (isUniqueViolation(cause)) {
        throw new ConflictException(
          'One of these societies is already helping with this need',
        );
      }
      throw error;
    }
    const forName = action.society?.nameEn ?? 'the society in need';
    await this.notify(
      () =>
        this.audience({
          societyIds: [...ids, ...(action.societyId ? [action.societyId] : [])],
          districtIds: [
            ...new Set([
              ...helpers.map((h) => h.districtId),
              ...(action.society ? [action.society.districtId] : []),
            ]),
          ],
        }),
      principal,
      {
        title: `Helpers assigned: ${action.title} for ${forName}`,
        body: `${helpers.map((h) => h.nameEn).join(', ')} will help. Deliver by ${sriLankaTime(dueAt)}.${input.note ? ` ${input.note}` : ''}`,
        linkPath: `/emergencies/${action.incidentId}?tab=actions`,
      },
      action.incidentId,
    );
    return { assigned: helpers.length };
  }

  /** V5 M46: the helping society (or HQ) records how much it has delivered. */
  async updateDelivery(
    helperId: string,
    input: UpdateDeliveryDto,
    principal: Principal,
  ) {
    const helper = await this.findHelper(helperId, principal);
    this.assertActive(helper.action.incident);
    if (!this.canUpdateHelper(principal, helper.helperSociety)) {
      throw new ForbiddenException(
        'Only the helping society and HQ can update this delivery',
      );
    }
    if (input.deliveredQuantity > helper.quantity) {
      throw new BadRequestException(
        `Delivered so far cannot be more than ${helper.quantity}`,
      );
    }
    if (input.status === 'DELIVERED' && !input.deliveredOn) {
      throw new BadRequestException('Enter the date it was delivered');
    }
    await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.emergencyActionHelper.update({
          where: { id: helperId },
          data: {
            status: input.status,
            deliveredQuantity: input.deliveredQuantity,
            deliveredOn: input.deliveredOn
              ? new Date(`${input.deliveredOn}T00:00:00Z`)
              : null,
            deliveryNote: input.note ?? helper.deliveryNote,
            updatedById: principal.id,
            updatedByName: principal.displayName,
          },
        }),
        this.prisma.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'INCIDENT_DELIVERY_UPDATED',
            targetId: helper.action.incidentId,
            societyId: helper.helperSocietyId,
            districtId: helper.helperSociety.districtId,
            detail: `${helper.action.title} · ${input.deliveredQuantity} of ${helper.quantity}`,
          },
        }),
      ]),
    );
    return { id: helperId, status: input.status };
  }

  /** V5 D33: HQ makes a numbered situation report from the latest data. */
  async createReport(id: string, input: CreateReportDto, principal: Principal) {
    this.assertCoordinator(principal);
    const incident = await this.visibleIncident(id, viewingScope(principal));
    const replay = await executeDatabaseOperation(() =>
      this.prisma.emergencySituationReport.findUnique({
        where: {
          createdById_clientMutationId: {
            createdById: principal.id,
            clientMutationId: input.clientMutationId,
          },
        },
      }),
    );
    if (replay) return { id: replay.id, number: replay.number, replayed: true };
    const snapshot = await this.snapshot(incident);
    const asOf = new Date();
    // Two HQ users refreshing at once: the second takes the next number.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const report = await executeDatabaseOperation(() =>
          this.prisma.$transaction(async (tx) => {
            const last = await tx.emergencySituationReport.aggregate({
              where: { incidentId: id },
              _max: { number: true },
            });
            const created = await tx.emergencySituationReport.create({
              data: {
                incidentId: id,
                clientMutationId: input.clientMutationId,
                status: 'SUBMITTED',
                number: (last._max.number ?? 0) + 1,
                asOf,
                snapshot: snapshot as unknown as Prisma.InputJsonValue,
                summary: input.summary,
                createdById: principal.id,
                createdByName: principal.displayName,
              },
            });
            await tx.platformAuditEvent.create({
              data: {
                ...actorFields(principal),
                action: 'INCIDENT_REPORT_CREATED',
                targetId: id,
                detail: `Situation report no. ${created.number}`,
              },
            });
            return created;
          }),
        );
        return { id: report.id, number: report.number, replayed: false };
      } catch (error) {
        const cause = (error as { cause?: unknown }).cause ?? error;
        if (!isUniqueViolation(cause) || attempt === 2) throw error;
      }
    }
    throw new ConflictException('Try making the report again');
  }

  /** V5 D33, M47: a situation report, for anyone who can see the incident. */
  async report(reportId: string, principal: Principal) {
    const report = await executeDatabaseOperation(() =>
      this.prisma.emergencySituationReport.findUnique({
        where: { id: reportId },
      }),
    );
    if (!report || report.number == null || !report.snapshot) {
      throw new NotFoundException('Situation report not found');
    }
    const incident = await this.visibleIncident(
      report.incidentId,
      viewingScope(principal),
    );
    const [summary] = await this.summaries([incident]);
    return {
      id: report.id,
      number: report.number,
      asOf: (report.asOf ?? report.createdAt).toISOString(),
      createdBy: report.createdByName,
      incident: summary!,
      summary: report.summary,
      snapshot: report.snapshot,
    };
  }

  /** A pre-signed upload for a photo or PDF with an assessment (M41). */
  async assessmentEvidence(
    assessmentId: string,
    input: CreateEvidenceDto,
    principal: Principal,
  ) {
    const assessment = await executeDatabaseOperation(() =>
      this.prisma.emergencyAssessment.findUnique({
        where: { id: assessmentId },
        include: {
          incident: { include: incidentInclude },
          society: { select: { id: true, districtId: true } },
          _count: { select: { evidence: true } },
        },
      }),
    );
    if (
      !assessment ||
      !(await this.canSee(viewingScope(principal), assessment.incident))
    ) {
      throw new NotFoundException('Assessment not found');
    }
    this.assertActive(assessment.incident);
    if (
      assessment.createdById !== principal.id &&
      !coversSociety(actingScope(principal), assessment.society)
    ) {
      throw new ForbiddenException(
        'Only people who look after this society can add photos',
      );
    }
    if (assessment._count.evidence >= MAX_EVIDENCE_PER_RECORD) {
      throw new BadRequestException(
        `An assessment can have at most ${MAX_EVIDENCE_PER_RECORD} photos`,
      );
    }
    return this.createEvidence(input, principal, {
      incidentId: assessment.incidentId,
      societyId: assessment.societyId,
      assessmentId,
      kind: 'assessments',
    });
  }

  /** A pre-signed upload for a delivery photo (M46). */
  async deliveryEvidence(
    helperId: string,
    input: CreateEvidenceDto,
    principal: Principal,
  ) {
    const helper = await this.findHelper(helperId, principal);
    this.assertActive(helper.action.incident);
    if (!this.canUpdateHelper(principal, helper.helperSociety)) {
      throw new ForbiddenException(
        'Only the helping society and HQ can add delivery photos',
      );
    }
    if (helper._count.evidence >= MAX_EVIDENCE_PER_RECORD) {
      throw new BadRequestException(
        `A delivery can have at most ${MAX_EVIDENCE_PER_RECORD} photos`,
      );
    }
    return this.createEvidence(input, principal, {
      incidentId: helper.action.incidentId,
      societyId: helper.helperSocietyId,
      helperId,
      kind: 'deliveries',
    });
  }

  /** Confirms the file reached storage with the declared size. */
  async completeEvidence(evidenceId: string, principal: Principal) {
    const evidence = await executeDatabaseOperation(() =>
      this.prisma.emergencyEvidence.findUnique({ where: { id: evidenceId } }),
    );
    if (!evidence || evidence.uploadedById !== principal.id) {
      throw new NotFoundException('Photo not found');
    }
    if (evidence.uploadedAt) {
      throw new ConflictException('This photo has already been uploaded');
    }
    const stored = await this.withStorage(() =>
      this.storage.getObjectInfo(evidence.storageKey),
    );
    if (!stored)
      throw new ConflictException('The file has not been uploaded yet');
    if (stored.sizeBytes !== evidence.sizeBytes) {
      throw new ConflictException('The uploaded file size does not match');
    }
    await executeDatabaseOperation(() =>
      this.prisma.emergencyEvidence.update({
        where: { id: evidenceId },
        data: { uploadedAt: new Date() },
      }),
    );
    return { id: evidenceId, uploaded: true };
  }

  /** A short-lived download link, for people who can see the society. */
  async downloadEvidence(evidenceId: string, principal: Principal) {
    const evidence = await executeDatabaseOperation(() =>
      this.prisma.emergencyEvidence.findUnique({
        where: { id: evidenceId },
        include: {
          incident: { include: incidentInclude },
          society: { select: { id: true, districtId: true } },
        },
      }),
    );
    const scope = viewingScope(principal);
    if (
      !evidence ||
      !evidence.uploadedAt ||
      !coversSociety(scope, evidence.society) ||
      !(await this.canSee(scope, evidence.incident))
    ) {
      throw new NotFoundException('Photo not found');
    }
    const extension =
      ALLOWED_CONTENT_TYPES[
        evidence.contentType as keyof typeof ALLOWED_CONTENT_TYPES
      ]?.[0] ?? '';
    return this.withStorage(() =>
      this.storage.createDownloadRequest({
        key: evidence.storageKey,
        fileName: `incident-photo-${evidence.id.slice(0, 8)}${extension}`,
        contentType: evidence.contentType,
      }),
    );
  }

  // ---------------------------------------------------------------------------

  private async createEvidence(
    input: CreateEvidenceDto,
    principal: Principal,
    target: {
      incidentId: string;
      societyId: string;
      assessmentId?: string;
      helperId?: string;
      kind: 'assessments' | 'deliveries';
    },
  ) {
    const maxBytes = maxUploadBytes(
      this.config.get<string>('DOCUMENT_MAX_UPLOAD_BYTES'),
    );
    if (input.sizeBytes > maxBytes) {
      throw new BadRequestException(
        `The file is larger than ${Math.round(maxBytes / 1_000_000)} MB. Choose a smaller PDF or photo.`,
      );
    }
    const id = randomUUID();
    // Keys hold only ids generated here, never names or other personal data.
    const storageKey = `incidents/${target.incidentId}/${target.kind}/${id}${ALLOWED_CONTENT_TYPES[input.contentType][0]}`;
    await executeDatabaseOperation(() =>
      this.prisma.emergencyEvidence.create({
        data: {
          id,
          incidentId: target.incidentId,
          societyId: target.societyId,
          assessmentId: target.assessmentId ?? null,
          helperId: target.helperId ?? null,
          storageKey,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256 ?? null,
          uploadedById: principal.id,
        },
      }),
    );
    const upload = await this.withStorage(() =>
      this.storage.createUploadRequest({
        key: storageKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        ...(input.checksumSha256
          ? { checksumSha256: input.checksumSha256 }
          : {}),
      }),
    );
    return {
      evidence: {
        id,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
      upload,
    };
  }

  /** Incidents whose area includes a society the scope covers. */
  private async visibleIncidentFilter(
    scope: EmergencyScope,
  ): Promise<Prisma.EmergencyIncidentWhereInput> {
    if (scope.national) return {};
    if (isEmptyScope(scope)) return { id: { in: [] } };
    const districts = await this.scopeDistricts(scope);
    return { areaDistrictIds: { hasSome: districts } };
  }

  /** The districts of a scope's own societies and districts. */
  private async scopeDistricts(
    scope: Exclude<EmergencyScope, { national: true }>,
  ) {
    const societies = scope.societyIds.length
      ? await executeDatabaseOperation(() =>
          this.prisma.society.findMany({
            where: { id: { in: scope.societyIds } },
            select: { districtId: true },
          }),
        )
      : [];
    return [
      ...new Set([...scope.districtIds, ...societies.map((s) => s.districtId)]),
    ];
  }

  private async coversArea(scope: EmergencyScope, area: string[]) {
    if (scope.national) return true;
    if (scope.districtIds.some((id) => area.includes(id))) return true;
    if (!scope.societyIds.length) return false;
    const count = await executeDatabaseOperation(() =>
      this.prisma.society.count({
        where: { id: { in: scope.societyIds }, districtId: { in: area } },
      }),
    );
    return count > 0;
  }

  private canSee(
    scope: EmergencyScope,
    incident: { areaDistrictIds: string[] },
  ) {
    return this.coversArea(scope, incident.areaDistrictIds);
  }

  /** Incidents outside the user's scope are reported as not found. */
  private async visibleIncident(id: string, scope: EmergencyScope) {
    const incident = await executeDatabaseOperation(() =>
      this.prisma.emergencyIncident.findUnique({
        where: { id },
        include: incidentInclude,
      }),
    );
    if (!incident || !(await this.canSee(scope, incident))) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  private assertActive(incident: { status: string }) {
    if (incident.status === 'CLOSED') {
      throw new ConflictException('This incident is closed');
    }
  }

  private assertCoordinator(principal: Principal) {
    if (!canCoordinate(principal)) {
      throw new ForbiddenException(
        'Response actions and situation reports are decided by HQ',
      );
    }
  }

  /** A society in the incident area, or a 400 when it is outside it. */
  private async areaSociety(
    societyId: string,
    incident: { areaDistrictIds: string[] },
  ) {
    const society = await executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id: societyId },
        select: { id: true, districtId: true, nameEn: true, status: true },
      }),
    );
    if (
      !society ||
      society.status !== 'ACTIVE' ||
      !incident.areaDistrictIds.includes(society.districtId)
    ) {
      throw new BadRequestException('Choose a society in the incident area');
    }
    return society;
  }

  private async findAction(actionId: string, principal: Principal) {
    const action = await executeDatabaseOperation(() =>
      this.prisma.emergencyResponseAction.findUnique({
        where: { id: actionId },
        include: {
          incident: true,
          society: {
            select: {
              ...societyRefSelect,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
    );
    if (
      !action ||
      !(await this.canSee(viewingScope(principal), action.incident))
    ) {
      throw new NotFoundException('Response action not found');
    }
    return action;
  }

  private async findHelper(helperId: string, principal: Principal) {
    const helper = await executeDatabaseOperation(() =>
      this.prisma.emergencyActionHelper.findUnique({
        where: { id: helperId },
        include: {
          action: { include: { incident: true } },
          helperSociety: { select: { id: true, districtId: true } },
          _count: { select: { evidence: true } },
        },
      }),
    );
    const scope = viewingScope(principal);
    if (
      !helper ||
      !(await this.canSee(scope, helper.action.incident)) ||
      !(
        coversSociety(scope, helper.helperSociety) ||
        scope.national ||
        (helper.action.societyId != null &&
          (await this.coversSocietyId(scope, helper.action.societyId)))
      )
    ) {
      throw new NotFoundException('Response action not found');
    }
    return helper;
  }

  private async coversSocietyId(scope: EmergencyScope, societyId: string) {
    if (scope.national || scope.societyIds.includes(societyId)) return true;
    const society = await executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id: societyId },
        select: { id: true, districtId: true },
      }),
    );
    return !!society && coversSociety(scope, society);
  }

  private canUpdateHelper(
    principal: Principal,
    helperSociety: { id: string; districtId: string },
  ) {
    return coversSociety(actingScope(principal), helperSociety);
  }

  private async summaries(incidents: IncidentRecord[]) {
    if (!incidents.length) return [];
    const districtIds = [
      ...new Set(incidents.flatMap((i) => i.areaDistrictIds)),
    ];
    const [districts, perDistrict, assessed] = await Promise.all([
      executeDatabaseOperation(() =>
        this.prisma.district.findMany({
          where: { id: { in: districtIds } },
          select: { id: true, nameEn: true },
        }),
      ),
      this.repository.societiesPerDistrict(districtIds),
      this.repository.assessedPerIncident(incidents.map((i) => i.id)),
    ]);
    const names = new Map(districts.map((d) => [d.id, d.nameEn]));
    return incidents.map((incident) => ({
      id: incident.id,
      reference: incidentReference(
        incident.referenceNumber,
        incident.activatedAt,
      ),
      title: incident.title,
      type: incident.type,
      status: incident.status,
      description: incident.description,
      message: incident.message,
      areaDistricts: incident.areaDistrictIds.map((id) => ({
        id,
        name: names.get(id) ?? 'District',
      })),
      reportingSociety: incident.reportingSociety
        ? societyRef(incident.reportingSociety)
        : null,
      openedBy: { name: incident.createdByName, role: incident.createdByRole },
      startedAt: incident.startedAt.toISOString(),
      openedAt: incident.activatedAt.toISOString(),
      assessmentsDueAt: incident.assessmentsDueAt?.toISOString() ?? null,
      closedAt: incident.closedAt?.toISOString() ?? null,
      closedBy: incident.closedAt
        ? { name: incident.closedByName, role: incident.closedByRole }
        : null,
      societiesInArea: incident.areaDistrictIds.reduce(
        (sum, id) => sum + (perDistrict.get(id) ?? 0),
        0,
      ),
      assessed: assessed.get(incident.id) ?? 0,
    }));
  }

  private async totals(incidentId: string, area: string[]) {
    const [perDistrict, byDistrict, needs, actions, districts] =
      await Promise.all([
        this.repository.societiesPerDistrict(area),
        this.repository.districtTotals(incidentId),
        this.repository.needCounts(incidentId),
        this.repository.actionCounts(incidentId),
        executeDatabaseOperation(() =>
          this.prisma.district.findMany({
            where: { id: { in: area } },
            select: { id: true, nameEn: true },
          }),
        ),
      ]);
    const names = new Map(districts.map((d) => [d.id, d.nameEn]));
    const counted = new Map(byDistrict.map((row) => [row.districtId, row]));
    const rows = area.map((districtId) => {
      const row = counted.get(districtId);
      const inArea = perDistrict.get(districtId) ?? 0;
      return {
        districtId,
        name: names.get(districtId) ?? 'District',
        inArea,
        affected: row?.affected ?? 0,
        critical: row?.critical ?? 0,
        families: row?.families ?? 0,
        people: row?.people ?? 0,
        housesFully: row?.housesFully ?? 0,
        housesPartly: row?.housesPartly ?? 0,
        notAssessed: Math.max(0, inArea - (row?.assessed ?? 0)),
      };
    });
    const sum = (key: keyof (typeof rows)[number]) =>
      rows.reduce((total, row) => total + (row[key] as number), 0);
    const societiesInArea = sum('inArea');
    const notAssessed = sum('notAssessed');
    return {
      societiesInArea,
      assessed: societiesInArea - notAssessed,
      notAssessed,
      affected: sum('affected'),
      critical: sum('critical'),
      families: sum('families'),
      people: sum('people'),
      housesFully: sum('housesFully'),
      housesPartly: sum('housesPartly'),
      actions: actions.total,
      actionsDelivered: actions.delivered,
      byDistrict: rows,
      needs,
    };
  }

  private toRow(
    row: SocietyRowRecord,
    acting: EmergencyScope,
    isActive: boolean,
  ) {
    return {
      society: {
        id: row.id,
        name: row.name,
        code: row.code,
        districtName: row.districtName,
      },
      state: row.impact ?? 'NOT_ASSESSED',
      families: row.families,
      people: row.people,
      housesFully: row.housesFully,
      housesPartly: row.housesPartly,
      injured: row.injured,
      displaced: row.displaced,
      roadAccess: row.roadAccess,
      needs: row.needs ?? [],
      lastReceivedAt: row.lastReceivedAt?.toISOString() ?? null,
      updates: row.updates,
      photos: row.photos,
      canAssess:
        isActive &&
        coversSociety(acting, { id: row.id, districtId: row.districtId }),
    };
  }

  /** Response actions about the user's societies (as the society in need or a helper). */
  private async actions(
    incidentId: string,
    principal: Principal,
    scope: EmergencyScope,
  ) {
    const filter = societyScopeFilter(scope);
    const rows = await executeDatabaseOperation(() =>
      this.prisma.emergencyResponseAction.findMany({
        where: {
          incidentId,
          ...(scope.national
            ? {}
            : {
                OR: [
                  { society: filter },
                  { helpers: { some: { helperSociety: filter } } },
                ],
              }),
        },
        include: {
          society: { select: societyRefSelect },
          helpers: {
            include: {
              helperSociety: { select: societyRefSelect },
              _count: {
                select: { evidence: { where: { uploadedAt: { not: null } } } },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: ACTION_LIMIT,
      }),
    );
    return rows.map((action) => ({
      id: action.id,
      need: action.need,
      title: action.title,
      description: action.description,
      quantity: action.quantity,
      unit: action.unit,
      dueAt: action.dueAt?.toISOString() ?? null,
      forSociety: action.society ? societyRef(action.society) : null,
      state: actionState(action.helpers),
      delivered: action.helpers.reduce(
        (sum, h) => sum + h.deliveredQuantity,
        0,
      ),
      helpers: action.helpers.map((helper) => ({
        id: helper.id,
        society: societyRef(helper.helperSociety),
        quantity: helper.quantity,
        deliveredQuantity: helper.deliveredQuantity,
        status: helper.status,
        note: helper.note,
        deliveryNote: helper.deliveryNote,
        deliveredOn: helper.deliveredOn?.toISOString().slice(0, 10) ?? null,
        assignedBy: helper.assignedByName,
        assignedAt: helper.createdAt.toISOString(),
        photos: helper._count.evidence,
        canUpdate: this.canUpdateHelper(principal, helper.helperSociety),
      })),
      createdBy: action.createdByName,
      createdAt: action.createdAt.toISOString(),
    }));
  }

  /** V5 IR01 "Incident history", without events about societies outside the user's scope. */
  private async history(incidentId: string, scope: EmergencyScope) {
    const events = await executeDatabaseOperation(() =>
      this.prisma.platformAuditEvent.findMany({
        where: { targetId: incidentId, action: { in: [...INCIDENT_EVENTS] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 50,
      }),
    );
    const societyIds = [
      ...new Set(events.flatMap((e) => (e.societyId ? [e.societyId] : []))),
    ];
    const societies = societyIds.length
      ? await executeDatabaseOperation(() =>
          this.prisma.society.findMany({
            where: { id: { in: societyIds } },
            select: { id: true, districtId: true, nameEn: true },
          }),
        )
      : [];
    const byId = new Map(societies.map((s) => [s.id, s]));
    return events
      .filter((event) => {
        if (!event.societyId) return true;
        const society = byId.get(event.societyId);
        return !!society && coversSociety(scope, society);
      })
      .slice(0, HISTORY_LIMIT)
      .map((event) => ({
        action: event.action,
        detail: event.detail,
        societyName: event.societyId
          ? (byId.get(event.societyId)?.nameEn ?? null)
          : null,
        actorName: event.actorName,
        actorRole: event.actorRole,
        at: event.createdAt.toISOString(),
      }));
  }

  /** The counts behind a situation report, kept with it. */
  private async snapshot(incident: IncidentRecord) {
    const totals = await this.totals(incident.id, incident.areaDistrictIds);
    const actions = await executeDatabaseOperation(() =>
      this.prisma.emergencyResponseAction.findMany({
        where: { incidentId: incident.id },
        select: {
          need: true,
          title: true,
          unit: true,
          quantity: true,
          societyId: true,
          helpers: {
            select: { helperSocietyId: true, deliveredQuantity: true },
          },
        },
        take: 2000,
      }),
    );
    const items = new Map<
      string,
      {
        need: string;
        title: string;
        unit: string;
        needed: number;
        delivered: number;
        helpers: Set<string>;
      }
    >();
    for (const action of actions) {
      const key = `${action.need}|${action.title.toLowerCase()}|${action.unit}`;
      const item = items.get(key) ?? {
        need: action.need,
        title: action.title,
        unit: action.unit,
        needed: 0,
        delivered: 0,
        helpers: new Set<string>(),
      };
      item.needed += action.quantity;
      for (const helper of action.helpers) {
        item.delivered += helper.deliveredQuantity;
        item.helpers.add(helper.helperSocietyId);
      }
      items.set(key, item);
    }
    const { byDistrict, needs, ...rest } = totals;
    return {
      totals: rest,
      byDistrict,
      needs,
      items: [...items.values()].map(({ helpers, ...item }) => ({
        ...item,
        helpingSocieties: helpers.size,
      })),
      helpingSocieties: new Set(
        actions.flatMap((a) => a.helpers.map((h) => h.helperSocietyId)),
      ).size,
      helpedSocieties: new Set(
        actions
          .filter((a) => a.helpers.length && a.societyId)
          .map((a) => a.societyId),
      ).size,
    };
  }

  /**
   * People whose scope covers the societies or districts involved: Society
   * Officers, SPCs and DDMs of those societies, DMs of those districts, DDMs
   * with temporary access to them and, when asked, HQ.
   */
  private async audience(input: {
    districtIds: string[];
    societyIds?: string[];
    includeHq?: boolean;
  }) {
    const now = new Date();
    const societyIds =
      input.societyIds ??
      (
        await this.prisma.society.findMany({
          where: { districtId: { in: input.districtIds } },
          select: { id: true },
        })
      ).map((s) => s.id);
    const [accounts, grants] = await Promise.all([
      this.prisma.platformAccount.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            ...(input.includeHq ? [{ role: 'HQ_ADMIN' }] : []),
            {
              role: 'DISTRICT_MANAGER',
              districtId: { in: input.districtIds },
            },
            {
              role: {
                in: [
                  'SOCIETY_OFFICER',
                  'PROGRAMME_COORDINATOR',
                  'DEPUTY_DISTRICT_MANAGER',
                ],
              },
              societyIds: { hasSome: societyIds },
            },
          ],
        },
        select: { id: true },
      }),
      this.prisma.districtAccessGrant.findMany({
        where: {
          districtId: { in: input.districtIds },
          revokedAt: null,
          startsAt: { lte: now },
          expiresAt: { gt: now },
        },
        select: { deputyId: true },
      }),
    ]);
    return [...accounts.map((a) => a.id), ...grants.map((g) => g.deputyId)];
  }

  /** Notifications never undo the change they describe; a failure is logged without content. */
  private async notify(
    recipients: () => Promise<string[]>,
    principal: Principal,
    message: { title: string; body: string; linkPath: string },
    incidentId: string,
  ) {
    try {
      const ids = (await recipients()).filter((id) => id !== principal.id);
      return await this.notifications.notifyUsers(ids, {
        category: 'EMERGENCY',
        title: message.title.slice(0, 200),
        body: message.body.slice(0, 1000),
        linkPath: message.linkPath,
      });
    } catch (error) {
      this.logger.warn(
        `Could not send incident notifications for ${incidentId}`,
        error as Error,
      );
      return 0;
    }
  }

  private async withStorage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        throw new ServiceUnavailableException(
          'Photo storage temporarily unavailable',
          { cause: error },
        );
      }
      throw error;
    }
  }
}
