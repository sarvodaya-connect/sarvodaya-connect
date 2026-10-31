import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Principal } from '../auth/principal.js';
import { USER_DIRECTORY, type UserDirectory } from '../auth/user-directory.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanReadSociety } from './society-access.policy.js';
import type { CreateGradeChangeRequestDto, DirectGradeUpdateDto, GradeChangeDecisionDto, GradeChangeQueryDto } from './dto/grade-change.dto.js';

const societyInclude = {
  district: { select: { id: true, code: true, nameEn: true } },
  memberships: { orderBy: { year: 'desc' as const }, take: 1 },
  _count: { select: { councilMembers: true } },
};

function isGradeChangeRequester(principal: Principal) {
  return principal.roles.some((role) => ['SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'DEPUTY_DISTRICT_MANAGER'].includes(role));
}

@Injectable()
export class GradeChangesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(USER_DIRECTORY) private readonly users?: UserDirectory,
  ) {}

  private async activeDelegatedDistrictIds(principal: Principal, now = new Date()) {
    if (!principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) return [];
    const rows = await this.prisma.districtDelegation.findMany({
      where: { deputyUserId: principal.id, startsAt: { lte: now }, endsAt: { gt: now }, revokedAt: null },
      select: { districtId: true },
    });
    return rows.map((row) => row.districtId);
  }

  private async requireScopedSociety(societyId: string, principal: Principal) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId }, include: { district: true } });
    if (!society) throw new NotFoundException('Society not found');
    assertCanReadSociety(principal, society, await this.activeDelegatedDistrictIds(principal));
    return society;
  }

  private async requestWhere(principal: Principal) {
    if (principal.roles.includes('HQ_ADMIN')) return {};
    const clauses: object[] = [];
    if (principal.roles.includes('DISTRICT_MANAGER') && principal.districtIds.length) {
      clauses.push({ society: { districtId: { in: principal.districtIds } } });
    }
    if (principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) {
      if (principal.societyIds.length) clauses.push({ societyId: { in: principal.societyIds } });
      const delegated = await this.activeDelegatedDistrictIds(principal);
      if (delegated.length) clauses.push({ society: { districtId: { in: delegated } } });
    } else if ((principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR')) && principal.societyIds.length) {
      clauses.push({ societyId: { in: principal.societyIds } });
    }
    if (!clauses.length) return { id: { in: [] } };
    return clauses.length === 1 ? clauses[0] : { OR: clauses };
  }

  private mapRequest(record: any) {
    const members = record.society.memberships[0];
    return {
      id: record.id,
      societyId: record.societyId,
      societyName: record.society.nameEn,
      societyCode: record.society.societyCode,
      district: record.society.district,
      currentGrade: record.currentGrade,
      proposedGrade: record.proposedGrade,
      rationale: record.rationale,
      status: record.status,
      requestedBy: { id: record.requestedById, name: record.requestedByName },
      requestedAt: record.requestedAt.toISOString(),
      ...(record.decidedAt ? {
        decidedBy: { id: record.decidedById, name: record.decidedByName },
        decisionComment: record.decisionComment,
        decidedAt: record.decidedAt.toISOString(),
      } : {}),
      societySummary: {
        memberCount: members ? members.female + members.male : null,
        memberYear: members?.year ?? null,
        excoCount: record.society._count.councilMembers,
      },
      history: record.society.auditEvents?.map((event: any) => ({
        id: event.id,
        eventType: event.eventType,
        fromGrade: event.fromGrade,
        toGrade: event.toGrade,
        summary: event.summary,
        comment: event.comment,
        actorName: event.actorDisplayName,
        occurredAt: event.occurredAt.toISOString(),
      })) ?? [],
    };
  }

  async list(query: GradeChangeQueryDto, principal: Principal) {
    const scope = await this.requestWhere(principal);
    const search = query.search?.trim();
    const filters: object[] = [];
    if (query.status) filters.push({ status: query.status });
    if (query.districtId) filters.push({ society: { districtId: query.districtId } });
    if (search) filters.push({ society: { OR: [
          { nameEn: { contains: search, mode: 'insensitive' as const } },
          { societyCode: { contains: search, mode: 'insensitive' as const } },
          { district: { nameEn: { contains: search, mode: 'insensitive' as const } } },
        ] } });
    const where = { AND: [scope, ...filters] };
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.gradeChangeRequest.findMany({ where, include: { society: { include: societyInclude } }, orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.gradeChangeRequest.count({ where }),
    ]);
    return { data: records.map((record) => this.mapRequest(record)), meta: { page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) } };
  }

  async getById(id: string, principal: Principal) {
    const record = await this.prisma.gradeChangeRequest.findUnique({
      where: { id },
      include: { society: { include: { ...societyInclude, auditEvents: { orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }] } } } },
    });
    if (!record) throw new NotFoundException('Grade-change request not found');
    assertCanReadSociety(principal, record.society, await this.activeDelegatedDistrictIds(principal));
    return this.mapRequest(record);
  }

  async create(societyId: string, input: CreateGradeChangeRequestDto, principal: Principal) {
    if (!isGradeChangeRequester(principal)) throw new ForbiddenException('Your account cannot request a grade change');
    if (!principal.societyIds.includes(societyId)) throw new ForbiddenException('Grade requests are limited to societies assigned to your account');
    const society = await this.requireScopedSociety(societyId, principal);
    if (society.grade === input.proposedGrade) throw new BadRequestException('The requested grade must differ from the current grade');
    try {
      const hqRecipients = await this.users?.findHqUserIds() ?? [];
      const result = await this.prisma.$transaction(async (tx) => {
        const pending = await tx.gradeChangeRequest.findFirst({ where: { societyId, status: 'PENDING' } });
        if (pending) throw new ConflictException('This society already has a pending grade request');
        const request = await tx.gradeChangeRequest.create({ data: {
          societyId, currentGrade: society.grade, proposedGrade: input.proposedGrade,
          rationale: input.rationale.trim(), requestedById: principal.id, requestedByName: principal.displayName,
        } });
        await tx.societyAuditEvent.create({ data: {
          societyId, gradeChangeRequestId: request.id, eventType: 'GRADE_CHANGE_REQUESTED',
          fromGrade: society.grade, toGrade: input.proposedGrade,
          summary: `Grade change requested: ${society.grade} to ${input.proposedGrade}`,
          comment: input.rationale.trim(), actorId: principal.id, actorDisplayName: principal.displayName,
        } });
        if (hqRecipients.length) await tx.notification.createMany({ data: hqRecipients.map((recipientUserId) => ({
          recipientUserId, category: 'REQUEST', title: 'Grade change request for HQ',
          body: `${society.nameEn}: ${society.grade} to ${input.proposedGrade}`,
          linkPath: `/grade-changes/${request.id}`, societyId,
        })) });
        return request;
      }, { isolationLevel: 'Serializable' });
      return this.getById(result.id, principal);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        throw new ConflictException('This society already has a pending grade request');
      }
      throw error;
    }
  }

  async decide(id: string, input: GradeChangeDecisionDto, principal: Principal) {
    if (!principal.roles.includes('HQ_ADMIN')) throw new ForbiddenException('Only HQ can decide grade-change requests');
    const decidedAt = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.gradeChangeRequest.findUnique({ where: { id }, include: { society: true } });
        if (!request) throw new NotFoundException('Grade-change request not found');
        if (request.status !== 'PENDING') throw new ConflictException('This request has already been decided');
        const changed = await tx.gradeChangeRequest.updateMany({ where: { id, status: 'PENDING' }, data: {
          status: input.decision, decidedById: principal.id, decidedByName: principal.displayName,
          decisionComment: input.comment.trim(), decidedAt,
        } });
        if (!changed.count) throw new ConflictException('This request has already been decided');
        if (input.decision === 'APPROVED') {
          const updated = await tx.society.updateMany({ where: { id: request.societyId, grade: request.currentGrade }, data: { grade: request.proposedGrade } });
          if (!updated.count) throw new ConflictException('The society grade changed after this request was submitted');
        }
        await tx.societyAuditEvent.create({ data: {
          societyId: request.societyId, gradeChangeRequestId: request.id,
          eventType: input.decision === 'APPROVED' ? 'GRADE_CHANGE_APPROVED' : 'GRADE_CHANGE_REJECTED',
          fromGrade: request.currentGrade, toGrade: input.decision === 'APPROVED' ? request.proposedGrade : request.currentGrade,
          summary: input.decision === 'APPROVED' ? `Grade changed to ${request.proposedGrade}` : `Grade request rejected; grade remains ${request.currentGrade}`,
          comment: input.comment.trim(), actorId: principal.id, actorDisplayName: principal.displayName,
        } });
        await tx.notification.create({ data: {
          recipientUserId: request.requestedById, category: input.decision === 'APPROVED' ? 'APPROVAL' : 'RETURNED',
          title: input.decision === 'APPROVED' ? 'Grade change approved' : 'Grade change declined',
          body: input.decision === 'APPROVED' ? `${request.society.nameEn} is now grade ${request.proposedGrade}.` : `The grade remains ${request.currentGrade} for ${request.society.nameEn}.`,
          linkPath: `/grade-changes/${request.id}`, societyId: request.societyId,
        } });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2034') {
        throw new ConflictException('This request changed while the decision was being saved; reload it');
      }
      throw error;
    }
    return this.getById(id, principal);
  }

  async updateGradeDirectly(societyId: string, input: DirectGradeUpdateDto, principal: Principal) {
    if (!principal.roles.includes('HQ_ADMIN')) throw new ForbiddenException('Only HQ can change a society grade directly');
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    if (society.grade === input.grade) throw new BadRequestException('The society already has this grade');
    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.gradeChangeRequest.findFirst({ where: { societyId, status: 'PENDING' } });
      if (pending) throw new ConflictException('Resolve the pending grade request before changing the grade directly');
      const updated = await tx.society.updateMany({ where: { id: societyId, grade: society.grade }, data: { grade: input.grade } });
      if (!updated.count) throw new ConflictException('The society grade changed while this update was being saved');
      await tx.societyAuditEvent.create({ data: {
        societyId, eventType: 'GRADE_CHANGED_DIRECTLY', fromGrade: society.grade, toGrade: input.grade,
        summary: `Grade changed directly from ${society.grade} to ${input.grade}`,
        comment: input.reason.trim(), actorId: principal.id, actorDisplayName: principal.displayName,
      } });
    }, { isolationLevel: 'Serializable' });
    return this.prisma.society.findUniqueOrThrow({ where: { id: societyId }, select: { id: true, societyCode: true, nameEn: true, grade: true, updatedAt: true } });
  }
}
