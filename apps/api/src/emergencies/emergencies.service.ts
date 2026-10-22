import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EmergencyAssessment } from '../generated/prisma/client.js';
import {
  assertCanAccessDistrict,
  assertCanAccessSociety,
  assertCanCreateEmergencyAction,
  assertCanManageEmergency,
  assertCanUseEmergency,
  canManageEmergency,
} from './emergency-access.policy.js';
import type {
  ActivateIncidentDto,
  CreateResponseActionDto,
  SyncAssessmentDto,
  SyncSituationReportDto,
} from './emergency.dto.js';

const incidentInclude = {
  district: { select: { id: true, nameEn: true } },
  _count: { select: { assessments: true, actions: true, reports: true } },
};

@Injectable()
export class EmergenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: Principal) {
    assertCanUseEmergency(principal);
    const where = principal.roles.includes('HQ_ADMIN')
      ? {}
      : principal.districtIds.length
        ? { districtId: { in: principal.districtIds } }
        : principal.societyIds.length
          ? { district: { societies: { some: { id: { in: principal.societyIds } } } } }
          : { id: { in: [] } };
    return this.prisma.emergencyIncident.findMany({
      where,
      include: incidentInclude,
      orderBy: [{ activatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async activate(input: ActivateIncidentDto, principal: Principal) {
    assertCanManageEmergency(principal);
    assertCanAccessDistrict(principal, input.districtId);
    this.assertCoordinates(input.latitude, input.longitude);
    return this.prisma.emergencyIncident.create({
      data: {
        districtId: input.districtId,
        title: input.title,
        type: input.type,
        severity: input.severity,
        description: input.description,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        createdById: principal.id,
      },
      include: incidentInclude,
    });
  }

  async assessment(input: SyncAssessmentDto, principal: Principal) {
    assertCanUseEmergency(principal);
    this.assertCoordinates(input.latitude, input.longitude);
    const incident = await this.requireIncident(input.incidentId, principal);
    await this.requireSociety(input.societyId, principal, incident.districtId);
    const where = { createdById_clientMutationId: { createdById: principal.id, clientMutationId: input.clientMutationId } };
    const current = await this.prisma.emergencyAssessment.findUnique({ where });
    const data = {
      incidentId: input.incidentId,
      societyId: input.societyId,
      status: input.status,
      observedAt: new Date(input.observedAt),
      peopleAffected: input.peopleAffected,
      householdsAffected: input.householdsAffected,
      displacedPeople: input.displacedPeople,
      infrastructureNotes: input.infrastructureNotes,
      urgentNeeds: input.urgentNeeds,
      notes: input.notes,
      latitude: input.latitude,
      longitude: input.longitude,
    };
    if (!current) {
      const record = await this.prisma.emergencyAssessment.create({
        data: { ...data, clientMutationId: input.clientMutationId, createdById: principal.id },
      });
      return { record, replayed: false };
    }
    if (input.expectedRevision === undefined) {
      if (this.sameAssessment(current, data)) return { record: current, replayed: true };
      throw new ConflictException('Assessment already exists; provide its latest revision to update it');
    }
    if (input.expectedRevision !== current.revision || current.status === 'SUBMITTED') {
      throw new ConflictException('Assessment changed or was submitted on another device; reload it before editing');
    }
    const updated = await this.prisma.emergencyAssessment.update({
      where: { id: current.id },
      data: { ...data, revision: { increment: 1 } },
    });
    return { record: updated, replayed: false };
  }

  async createAction(input: CreateResponseActionDto, principal: Principal) {
    assertCanCreateEmergencyAction(principal);
    const incident = await this.requireIncident(input.incidentId, principal);
    if (principal.roles.includes('PROGRAMME_COORDINATOR') && !input.societyId) {
      throw new BadRequestException('Coordinators must scope response actions to an assigned society');
    }
    if (input.societyId) await this.requireSociety(input.societyId, principal, incident.districtId);
    const where = { createdById_clientMutationId: { createdById: principal.id, clientMutationId: input.clientMutationId } };
    const current = await this.prisma.emergencyResponseAction.findUnique({ where });
    const data = {
      incidentId: input.incidentId,
      societyId: input.societyId,
      title: input.title,
      description: input.description,
      status: input.status,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    };
    if (current) {
      if (current.incidentId === data.incidentId && current.societyId === (data.societyId ?? null) && current.title === data.title && current.description === data.description && current.status === data.status && current.dueAt?.toISOString() === data.dueAt?.toISOString()) {
        return { record: current, replayed: true };
      }
      throw new ConflictException('This action ID was already used for a different action');
    }
    return {
      record: await this.prisma.emergencyResponseAction.create({ data: { ...data, clientMutationId: input.clientMutationId, createdById: principal.id } }),
      replayed: false,
    };
  }

  async updateIncidentStatus(id: string, status: 'ACTIVE' | 'CONTAINED' | 'CLOSED', principal: Principal) {
    assertCanManageEmergency(principal);
    const incident = await this.requireIncident(id, principal);
    if (incident.status === 'CLOSED' && status !== 'CLOSED') {
      throw new ConflictException('Closed incidents cannot be reopened');
    }
    return this.prisma.emergencyIncident.update({
      where: { id },
      data: { status, closedAt: status === 'CLOSED' ? new Date() : null },
      include: incidentInclude,
    });
  }

  async updateActionStatus(id: string, status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', principal: Principal) {
    assertCanManageEmergency(principal);
    const action = await this.prisma.emergencyResponseAction.findUnique({
      where: { id },
      include: { incident: { select: { districtId: true } } },
    });
    if (!action) throw new NotFoundException('Response action not found');
    assertCanAccessDistrict(principal, action.incident.districtId);
    return this.prisma.emergencyResponseAction.update({ where: { id }, data: { status } });
  }

  async situationReport(input: SyncSituationReportDto, principal: Principal) {
    assertCanUseEmergency(principal);
    const incident = await this.requireIncident(input.incidentId, principal);
    if ((principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR')) && !input.societyId) {
      throw new BadRequestException('Society users must scope situation reports to an assigned society');
    }
    if (input.societyId) await this.requireSociety(input.societyId, principal, incident.districtId);
    const where = { createdById_clientMutationId: { createdById: principal.id, clientMutationId: input.clientMutationId } };
    const current = await this.prisma.emergencySituationReport.findUnique({ where });
    const data = {
      incidentId: input.incidentId,
      societyId: input.societyId ?? null,
      status: input.status,
      summary: input.summary,
      needs: input.needs,
    };
    if (!current) {
      return { record: await this.prisma.emergencySituationReport.create({ data: { ...data, clientMutationId: input.clientMutationId, createdById: principal.id } }), replayed: false };
    }
    if (input.expectedRevision === undefined) {
      if (current.incidentId === data.incidentId && current.societyId === data.societyId && current.status === data.status && current.summary === data.summary && current.needs === data.needs) return { record: current, replayed: true };
      throw new ConflictException('Report already exists; provide its latest revision to update it');
    }
    if (input.expectedRevision !== current.revision || current.status === 'SUBMITTED') {
      throw new ConflictException('Situation report changed or was submitted on another device; reload it before editing');
    }
    return { record: await this.prisma.emergencySituationReport.update({ where: { id: current.id }, data: { ...data, revision: { increment: 1 } } }), replayed: false };
  }

  async details(id: string, principal: Principal) {
    const incident = await this.requireIncident(id, principal);
    const visible = canManageEmergency(principal)
      ? await this.prisma.emergencyIncident.findUnique({
          where: { id },
          include: {
            ...incidentInclude,
            assessments: { include: { society: { select: { id: true, societyCode: true, nameEn: true } } }, orderBy: { updatedAt: 'desc' } },
            actions: { orderBy: { createdAt: 'desc' } },
            reports: { orderBy: { createdAt: 'desc' } },
          },
        })
      : {
          ...incident,
          assessments: await this.prisma.emergencyAssessment.findMany({
            where: { incidentId: id, societyId: { in: principal.societyIds } },
            include: { society: { select: { id: true, societyCode: true, nameEn: true } } },
            orderBy: { updatedAt: 'desc' },
          }),
          actions: await this.prisma.emergencyResponseAction.findMany({
            where: { incidentId: id, societyId: { in: principal.societyIds } },
            orderBy: { createdAt: 'desc' },
          }),
          reports: await this.prisma.emergencySituationReport.findMany({
            where: { incidentId: id, OR: [{ societyId: { in: principal.societyIds } }, { createdById: principal.id }] },
            orderBy: { createdAt: 'desc' },
          }),
        };
    return visible;
  }

  private async requireIncident(id: string, principal: Principal) {
    const incident = await this.prisma.emergencyIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Emergency incident not found');
    assertCanUseEmergency(principal);
    if (principal.roles.includes('HQ_ADMIN')) return incident;
    if (principal.districtIds.includes(incident.districtId)) return incident;
    if (principal.societyIds.length) {
      const assessment = await this.prisma.emergencyAssessment.findFirst({
        where: { incidentId: id, societyId: { in: principal.societyIds } },
      });
      if (assessment) return incident;
    }
    // Officers need to receive incidents for their district before creating an assessment.
    if (principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR')) {
      const assignedSociety = await this.prisma.society.findFirst({
        where: { id: { in: principal.societyIds }, districtId: incident.districtId },
        select: { id: true },
      });
      if (assignedSociety) return incident;
    }
    assertCanAccessDistrict(principal, incident.districtId);
    return incident;
  }

  private async requireSociety(id: string, principal: Principal, incidentDistrictId: string) {
    const society = await this.prisma.society.findUnique({ where: { id }, select: { id: true, districtId: true } });
    if (!society) throw new NotFoundException('Society not found');
    if (society.districtId !== incidentDistrictId) throw new BadRequestException('Society must belong to the incident district');
    assertCanAccessSociety(principal, society.id, society.districtId);
  }

  private assertCoordinates(latitude?: number, longitude?: number) {
    if ((latitude === undefined) !== (longitude === undefined)) {
      throw new BadRequestException('Latitude and longitude must be supplied together');
    }
  }

  private sameAssessment(current: EmergencyAssessment, data: Record<string, unknown>) {
    return current.incidentId === data.incidentId && current.societyId === data.societyId &&
      current.status === data.status && current.observedAt.toISOString() === (data.observedAt as Date).toISOString() &&
      current.peopleAffected === data.peopleAffected && current.householdsAffected === data.householdsAffected &&
      current.displacedPeople === data.displacedPeople && current.infrastructureNotes === data.infrastructureNotes &&
      current.urgentNeeds === data.urgentNeeds && current.notes === data.notes &&
      current.latitude === data.latitude && current.longitude === data.longitude;
  }
}
