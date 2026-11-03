import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type { Principal } from '../auth/principal.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { financialYear } from '../societies/financial-year.js';
import { chosenYear } from './national.service.js';
import { districtLabel, pageMeta } from './national-rules.js';

export const AUDIENCES = [
  'ALL_ACTIVE',
  'DISTRICT',
  'FIGURES_NOT_ADDED',
  'AUDIT_PAST_DUE',
] as const;
type Audience = (typeof AUDIENCES)[number];

export class CreateInformationRequestDto {
  @IsIn(AUDIENCES)
  audience!: Audience;
  @IsOptional()
  @IsUUID()
  districtId?: string;
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  financialYear?: number;
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;
  @IsDateString({ strict: true })
  dueOn!: string;
}

export class RespondDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RequestListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;
}

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in Sri Lanka as YYYY-MM-DD. */
export function sriLankaToday(now = new Date()) {
  return new Date(now.getTime() + SRI_LANKA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function formatDay(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * V5 D13 Requests & Tasks. HQ asks a group of societies for documents or
 * information; the Society Officer (or the SPC, where a society has none)
 * is notified and marks the society as responded. HQ's own tasks are worked
 * out from the live queues, so they close when the work is done.
 */
@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async audienceWhere(
    input: CreateInformationRequestDto,
    startYear: number,
  ): Promise<{ where: Prisma.SocietyWhereInput; districtName?: string }> {
    switch (input.audience) {
      case 'DISTRICT': {
        if (!input.districtId)
          throw new BadRequestException(
            'Choose the district to send the request to',
          );
        const district = await executeDatabaseOperation(() =>
          this.prisma.district.findUnique({ where: { id: input.districtId } }),
        );
        if (!district) throw new BadRequestException('District not found');
        return {
          where: { status: 'ACTIVE', districtId: district.id },
          districtName: district.nameEn,
        };
      }
      case 'FIGURES_NOT_ADDED':
        return {
          where: {
            status: 'ACTIVE',
            NOT: {
              annualSummaries: {
                some: {
                  financialYear: startYear,
                  totalProfit: { not: null },
                  totalExpenses: { not: null },
                },
              },
            },
          },
        };
      case 'AUDIT_PAST_DUE':
        return {
          where: {
            status: 'ACTIVE',
            documents: {
              none: {
                documentType: 'AUDIT_REPORT',
                financialYear: startYear,
                uploadedAt: { not: null },
              },
            },
          },
        };
      default:
        return { where: { status: 'ACTIVE' } };
    }
  }

  async create(
    input: CreateInformationRequestDto,
    principal: Principal,
    now = new Date(),
  ) {
    const today = sriLankaToday(now);
    const latest = sriLankaToday(new Date(now.getTime() + 366 * DAY_MS));
    if (input.dueOn < today || input.dueOn > latest)
      throw new BadRequestException(
        'Choose a deadline from today to one year ahead',
      );
    const usesYear =
      input.audience === 'FIGURES_NOT_ADDED' ||
      input.audience === 'AUDIT_PAST_DUE';
    const startYear = usesYear ? chosenYear(input.financialYear, now) : null;
    const { where } = await this.audienceWhere(input, startYear ?? 0);

    const created = await executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const societies = await tx.society.findMany({
          where,
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        if (societies.length === 0)
          throw new BadRequestException('No active society is in this group');
        const request = await tx.informationRequest.create({
          data: {
            title: input.title.trim(),
            audience: input.audience,
            districtId:
              input.audience === 'DISTRICT' ? input.districtId! : null,
            financialYear: startYear,
            dueOn: new Date(`${input.dueOn}T00:00:00Z`),
            createdById: principal.id,
            createdByName: principal.displayName,
          },
        });
        await tx.informationRequestSociety.createMany({
          data: societies.map((society) => ({
            requestId: request.id,
            societyId: society.id,
          })),
        });
        await tx.platformAuditEvent.create({
          data: {
            actorId: principal.id,
            actorName: principal.displayName,
            actorRole: 'HQ_ADMIN',
            action: 'INFORMATION_REQUEST_SENT',
            targetId: request.id,
            detail: `${request.title} · ${societies.length} societies · due ${input.dueOn}`,
          },
        });
        return { request, societyIds: societies.map((society) => society.id) };
      }),
    );

    await this.notifySocieties(created.societyIds, {
      title: `HQ request: ${created.request.title}`,
      body: `Please respond by ${formatDay(input.dueOn)}.`,
    });
    return this.summary(created.request.id, now);
  }

  /** Society Officers of each society, or its SPCs where it has no Society Officer. */
  private async notifySocieties(
    societyIds: string[],
    message: { title: string; body: string },
  ) {
    const wanted = new Set(societyIds);
    const accounts = await executeDatabaseOperation(() =>
      this.prisma.platformAccount.findMany({
        where: {
          role: { in: ['SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR'] },
          status: { not: 'DISABLED' },
          NOT: { societyIds: { isEmpty: true } },
        },
        select: { id: true, role: true, societyIds: true },
      }),
    );
    const officerSocieties = new Set(
      accounts
        .filter((account) => account.role === 'SOCIETY_OFFICER')
        .flatMap((account) => account.societyIds),
    );
    const recipients = new Map<string, string>();
    for (const account of accounts) {
      const societyId = account.societyIds.find(
        (id) =>
          wanted.has(id) &&
          (account.role === 'SOCIETY_OFFICER' || !officerSocieties.has(id)),
      );
      if (societyId) recipients.set(account.id, societyId);
    }
    await Promise.all(
      [...recipients].map(([accountId, societyId]) =>
        this.notifications.notifyUsers([accountId], {
          category: 'REQUEST',
          topic: 'INFORMATION_REQUEST',
          title: message.title,
          body: message.body,
          linkPath: `/societies/${societyId}`,
          societyId,
        }),
      ),
    );
  }

  private async counts(requestIds: string[]) {
    if (requestIds.length === 0)
      return new Map<string, { total: number; responded: number }>();
    const rows = await executeDatabaseOperation(
      () =>
        this.prisma.$queryRaw<
          { id: string; total: number; responded: number }[]
        >`
        SELECT request_id AS id, COUNT(*)::int AS total,
          COUNT(responded_at)::int AS responded
        FROM information_request_societies
        WHERE request_id = ANY(${requestIds}::uuid[])
        GROUP BY request_id`,
    );
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toSummary(
    request: Prisma.InformationRequestGetPayload<{
      include: { district: true };
    }>,
    counts: { total: number; responded: number } | undefined,
    now: Date,
  ) {
    const total = counts?.total ?? 0;
    const responded = counts?.responded ?? 0;
    const dueOn = request.dueOn.toISOString().slice(0, 10);
    const year =
      request.financialYear !== null
        ? financialYear(request.financialYear).label
        : '';
    const audienceLabel =
      request.audience === 'DISTRICT'
        ? districtLabel(request.district?.nameEn ?? 'One')
        : request.audience === 'FIGURES_NOT_ADDED'
          ? `${total} societies without ${year} figures`
          : request.audience === 'AUDIT_PAST_DUE'
            ? `${total} societies without the ${year} audit report`
            : 'All active societies';
    return {
      id: request.id,
      title: request.title,
      audience: request.audience,
      audienceLabel,
      dueOn,
      createdAt: request.createdAt.toISOString(),
      createdBy: request.createdByName,
      societies: total,
      responded,
      status:
        total > 0 && responded === total
          ? ('COMPLETE' as const)
          : dueOn < sriLankaToday(now)
            ? ('OVERDUE' as const)
            : ('OPEN' as const),
    };
  }

  private async summary(id: string, now: Date) {
    const request = await executeDatabaseOperation(() =>
      this.prisma.informationRequest.findUniqueOrThrow({
        where: { id },
        include: { district: true },
      }),
    );
    return this.toSummary(request, (await this.counts([id])).get(id), now);
  }

  /** D13 request tracker, newest first. */
  async list(page: number, now = new Date()) {
    const [requests, totalItems] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.informationRequest.findMany({
          include: { district: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        this.prisma.informationRequest.count(),
      ]),
    );
    const counts = await this.counts(requests.map((request) => request.id));
    return {
      data: requests.map((request) =>
        this.toSummary(request, counts.get(request.id), now),
      ),
      meta: pageMeta(page, PAGE_SIZE, totalItems),
    };
  }

  /** Requests for the societies the user is assigned to, newest first. */
  async inbox(principal: Principal) {
    if (principal.societyIds.length === 0) return { data: [] };
    const rows = await executeDatabaseOperation(() =>
      this.prisma.informationRequestSociety.findMany({
        where: { societyId: { in: principal.societyIds } },
        include: {
          request: true,
          society: { select: { id: true, nameEn: true } },
        },
        orderBy: [{ request: { createdAt: 'desc' } }, { societyId: 'asc' }],
        take: 50,
      }),
    );
    return {
      data: rows.map((row) => ({
        requestId: row.requestId,
        title: row.request.title,
        dueOn: row.request.dueOn.toISOString().slice(0, 10),
        society: { id: row.society.id, name: row.society.nameEn },
        respondedAt: row.respondedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * The assigned Society Officer, SPC or DDM marks their society as having
   * responded. Anyone else is refused; unknown requests are not found.
   */
  async respond(
    requestId: string,
    societyId: string,
    input: RespondDto,
    principal: Principal,
  ) {
    const assigned =
      principal.societyIds.includes(societyId) &&
      principal.roles.some((role) =>
        [
          'SOCIETY_OFFICER',
          'PROGRAMME_COORDINATOR',
          'DEPUTY_DISTRICT_MANAGER',
        ].includes(role),
      );
    const row = await executeDatabaseOperation(() =>
      this.prisma.informationRequestSociety.findUnique({
        where: { requestId_societyId: { requestId, societyId } },
      }),
    );
    if (!row) throw new NotFoundException('Request not found');
    if (!assigned)
      throw new ForbiddenException(
        'Only the society’s assigned staff can respond',
      );
    const changed = await executeDatabaseOperation(() =>
      this.prisma.informationRequestSociety.updateMany({
        where: { requestId, societyId, respondedAt: null },
        data: {
          respondedAt: new Date(),
          respondedById: principal.id,
          respondedByName: principal.displayName,
          note: input.note?.trim() || null,
        },
      }),
    );
    if (changed.count === 0)
      throw new ConflictException('This society has already responded');
    return { requestId, societyId, responded: true };
  }

  /** D13 "My tasks" for HQ, from the live queues. */
  async tasks(now = new Date()) {
    const soon = new Date(now.getTime() + 7 * DAY_MS);
    const [waiting, oldest, grants, withoutOfficer, overdue] =
      await executeDatabaseOperation(() =>
        Promise.all([
          this.prisma.gradeChangeRequest.count({
            where: { status: 'PENDING' },
          }),
          this.prisma.gradeChangeRequest.findFirst({
            where: { status: 'PENDING' },
            orderBy: { requestedAt: 'asc' },
            select: { requestedAt: true },
          }),
          this.prisma.districtAccessGrant.findMany({
            where: { revokedAt: null, expiresAt: { gt: now, lte: soon } },
            orderBy: { expiresAt: 'asc' },
            take: 5,
            select: { id: true, expiresAt: true },
          }),
          this.prisma.$queryRaw<{ societies: number }[]>`
            SELECT COUNT(*)::int AS societies FROM societies s
            WHERE s.status = 'ACTIVE' AND NOT EXISTS (
              SELECT 1 FROM platform_accounts p
              WHERE p.role = 'SOCIETY_OFFICER' AND p.status <> 'DISABLED'
                AND s.id = ANY(p.society_ids))`,
          this.prisma.informationRequest.count({
            where: {
              dueOn: { lt: new Date(`${sriLankaToday(now)}T00:00:00Z`) },
              societies: { some: { respondedAt: null } },
            },
          }),
        ]),
      );
    const day = (value: Date) => value.toISOString().slice(0, 10);
    const tasks = [];
    if (waiting > 0)
      tasks.push({
        id: 'grade-requests',
        title: `Decide ${waiting} grade-change ${waiting === 1 ? 'request' : 'requests'}`,
        due: oldest ? day(oldest.requestedAt) : null,
        href: '/reviews',
      });
    for (const grant of grants)
      tasks.push({
        id: `district-access-${grant.id}`,
        title: `Check temporary district access ending ${formatDay(day(grant.expiresAt))}`,
        due: day(grant.expiresAt),
        href: '/accounts',
      });
    const missing = withoutOfficer[0]?.societies ?? 0;
    if (missing > 0)
      tasks.push({
        id: 'society-officer-accounts',
        title: `Create Society Officer accounts for ${missing} active ${missing === 1 ? 'society' : 'societies'}`,
        due: null,
        href: '/accounts',
      });
    if (overdue > 0)
      tasks.push({
        id: 'overdue-requests',
        title: `Follow up ${overdue} ${overdue === 1 ? 'request' : 'requests'} past the deadline`,
        due: null,
        href: '/requests',
      });
    return { data: tasks };
  }
}
