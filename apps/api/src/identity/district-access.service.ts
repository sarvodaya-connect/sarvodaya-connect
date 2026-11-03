import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { hasRole, type Principal } from '../auth/principal.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GrantDistrictAccessDto } from './identity.dto.js';
import {
  grantHistory,
  grantProblem,
  grantStatus,
  maxDaysFrom,
  OPEN_RECORD_WINDOW_MS,
} from './district-access.rules.js';
import type {
  DistrictAccessGrantDetail,
  DistrictAccessGrantView,
  DistrictAccessList,
} from './district-access.types.js';

const OPENED = 'DISTRICT_SOCIETY_OPENED';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GrantRow = {
  id: string;
  districtId: string;
  deputyId: string;
  grantedById: string;
  startsAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  reason: string;
  createdAt: Date;
};

/**
 * V5 PR 7 (DM04, DM05, DD02, DD04, DD06, DD07; phone M30–M32). A District
 * Manager gives a DDM in their district view-only access to every society in
 * it for a set time. Access is re-read from the database on every request, so
 * an early end or expiry applies to the DDM's next request.
 */
@Injectable()
export class DistrictAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  maxDays() {
    return maxDaysFrom(this.config.get<string>('DISTRICT_ACCESS_MAX_DAYS'));
  }

  /** HQ sees every grant, the DM their district's, a DDM their own. */
  private whereFor(principal: Principal) {
    if (hasRole(principal, 'HQ_ADMIN')) return {};
    if (hasRole(principal, 'DISTRICT_MANAGER'))
      return {
        districtId: { in: principal.districtIds.filter((id) => UUID.test(id)) },
      };
    if (hasRole(principal, 'DEPUTY_DISTRICT_MANAGER'))
      return { deputyId: principal.id };
    throw new ForbiddenException(
      'Temporary district access is for District Managers, DDMs and HQ',
    );
  }

  async list(
    principal: Principal,
    now = new Date(),
  ): Promise<DistrictAccessList> {
    const where = this.whereFor(principal);
    return executeDatabaseOperation(async () => {
      const grants = await this.prisma.districtAccessGrant.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        take: 100,
      });
      return { data: await this.views(grants, now), maxDays: this.maxDays() };
    });
  }

  async detail(
    id: string,
    principal: Principal,
    now = new Date(),
  ): Promise<DistrictAccessGrantDetail> {
    const where = this.whereFor(principal);
    return executeDatabaseOperation(async () => {
      const grant = await this.prisma.districtAccessGrant.findFirst({
        where: { ...where, id },
      });
      if (!grant) throw new NotFoundException('Access grant not found');
      const [view] = await this.views([grant], now);
      const opens = await this.prisma.platformAuditEvent.findMany({
        where: { action: OPENED, targetId: grant.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const societies = await this.prisma.society.findMany({
        where: {
          id: {
            in: [...new Set(opens.map((o) => o.societyId!).filter(Boolean))],
          },
        },
        select: { id: true, nameEn: true },
      });
      const name = new Map(societies.map((s) => [s.id, s.nameEn]));
      return {
        ...view!,
        history: grantHistory(
          grant,
          {
            grantedBy: view!.grantedBy.name,
            deputy: view!.deputy.name,
            endedBy: view!.endedEarly?.byName ?? null,
          },
          opens.map((o) => ({
            at: o.createdAt,
            societyName: name.get(o.societyId ?? '') ?? 'Society',
          })),
          now,
        ),
      };
    });
  }

  async grant(
    input: GrantDistrictAccessDto,
    principal: Principal,
    now = new Date(),
  ): Promise<DistrictAccessGrantView> {
    if (
      !hasRole(principal, 'DISTRICT_MANAGER') ||
      !principal.districtIds.includes(input.districtId)
    )
      throw new ForbiddenException(
        'Only the District Manager of this district can give temporary access',
      );
    return executeDatabaseOperation(async () => {
      const deputy = await this.prisma.platformAccount.findUnique({
        where: { id: input.deputyId },
      });
      if (
        !deputy ||
        deputy.role !== 'DEPUTY_DISTRICT_MANAGER' ||
        deputy.districtId !== input.districtId ||
        deputy.status !== 'ACTIVE'
      )
        throw new BadRequestException('Choose an active DDM in your district');
      const startsAt = new Date(input.startsAt);
      const expiresAt = new Date(input.expiresAt);
      const overlapping = await this.prisma.districtAccessGrant.count({
        where: {
          deputyId: input.deputyId,
          districtId: input.districtId,
          revokedAt: null,
          startsAt: { lt: expiresAt },
          expiresAt: { gt: startsAt > now ? startsAt : now },
        },
      });
      const problem = grantProblem(
        { startsAt, expiresAt },
        overlapping,
        this.maxDays(),
        now,
      );
      if (problem)
        throw overlapping
          ? new ConflictException(problem)
          : new BadRequestException(problem);
      const reason = (input.reason ?? '').trim();
      const grant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.districtAccessGrant.create({
          data: {
            districtId: input.districtId,
            deputyId: input.deputyId,
            reason,
            startsAt,
            expiresAt,
            grantedById: principal.id,
          },
        });
        await tx.platformAuditEvent.create({
          data: {
            actorId: principal.id,
            actorName: principal.displayName,
            actorRole: 'DISTRICT_MANAGER',
            action: 'DISTRICT_ACCESS_GRANTED',
            targetId: created.id,
            districtId: input.districtId,
            detail: `${deputy.displayName} · view only until ${expiresAt.toISOString()}${reason ? ` · ${reason}` : ''}`,
          },
        });
        return created;
      });
      return (await this.views([grant], now))[0]!;
    });
  }

  /** "End access now". Takes effect on the DDM's next request. */
  async revoke(id: string, principal: Principal, now = new Date()) {
    return executeDatabaseOperation(async () => {
      const grant = await this.prisma.districtAccessGrant.findUnique({
        where: { id },
      });
      if (
        !grant ||
        !(
          hasRole(principal, 'HQ_ADMIN') ||
          (hasRole(principal, 'DISTRICT_MANAGER') &&
            principal.districtIds.includes(grant.districtId))
        )
      )
        throw new NotFoundException('Access grant not found');
      if (grant.revokedAt || grant.expiresAt <= now)
        throw new ConflictException('This access has already ended');
      await this.prisma.$transaction(async (tx) => {
        await tx.districtAccessGrant.update({
          where: { id },
          data: { revokedAt: now },
        });
        await tx.platformAuditEvent.create({
          data: {
            actorId: principal.id,
            actorName: principal.displayName,
            actorRole: principal.roles[0],
            action: 'DISTRICT_ACCESS_REVOKED',
            targetId: id,
            districtId: grant.districtId,
            detail: 'Ended early',
          },
        });
      });
      return { revoked: true };
    });
  }

  /**
   * DD06: a DDM opening a district society through temporary access is added
   * to the access history (once per society every 30 minutes). Their own
   * assigned societies are not recorded.
   */
  async recordOpen(
    principal: Principal,
    society: { id: string; districtId: string },
    now = new Date(),
  ) {
    if (
      !hasRole(principal, 'DEPUTY_DISTRICT_MANAGER') ||
      principal.societyIds.includes(society.id)
    )
      return;
    const grant = (principal.delegatedDistrictAccess ?? []).find(
      (g) =>
        g.districtId === society.districtId &&
        g.grantId &&
        Date.parse(g.expiresAt) > now.getTime(),
    );
    if (!grant?.grantId) return;
    await executeDatabaseOperation(async () => {
      const recent = await this.prisma.platformAuditEvent.count({
        where: {
          action: OPENED,
          targetId: grant.grantId,
          societyId: society.id,
          createdAt: { gt: new Date(now.getTime() - OPEN_RECORD_WINDOW_MS) },
        },
      });
      if (recent) return;
      await this.prisma.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          actorName: principal.displayName,
          actorRole: 'DEPUTY_DISTRICT_MANAGER',
          action: OPENED,
          targetId: grant.grantId!,
          societyId: society.id,
          districtId: society.districtId,
          detail: 'Opened with temporary district access · view only',
        },
      });
    });
  }

  /** Names, status and counts for a set of grants, in a few queries. */
  async views(
    grants: GrantRow[],
    now: Date,
  ): Promise<DistrictAccessGrantView[]> {
    if (!grants.length) return [];
    const db = this.prisma;
    const ids = grants.map((g) => g.id);
    const people = [
      ...new Set(grants.flatMap((g) => [g.deputyId, g.grantedById])),
    ].filter((id) => UUID.test(id));
    const districtIds = [...new Set(grants.map((g) => g.districtId))];
    const [accounts, districts, ends, opened] = await Promise.all([
      db.platformAccount.findMany({
        where: { id: { in: people } },
        select: { id: true, displayName: true },
      }),
      db.district.findMany({
        where: { id: { in: districtIds } },
        select: {
          id: true,
          nameEn: true,
          _count: { select: { societies: true } },
        },
      }),
      db.platformAuditEvent.findMany({
        where: { action: 'DISTRICT_ACCESS_REVOKED', targetId: { in: ids } },
        select: { targetId: true, actorName: true },
      }),
      db.platformAuditEvent.groupBy({
        by: ['targetId', 'societyId'],
        where: { action: OPENED, targetId: { in: ids } },
      }),
    ]);
    const name = new Map(accounts.map((a) => [a.id, a.displayName]));
    const district = new Map(districts.map((d) => [d.id, d]));
    const endedBy = new Map(ends.map((e) => [e.targetId, e.actorName]));
    const openedCount = new Map<string, number>();
    for (const row of opened)
      openedCount.set(row.targetId, (openedCount.get(row.targetId) ?? 0) + 1);
    return grants.map((g) => {
      const d = district.get(g.districtId);
      return {
        id: g.id,
        district: {
          id: g.districtId,
          name: d?.nameEn ?? '',
          societyCount: d?._count.societies ?? 0,
        },
        deputy: { id: g.deputyId, name: name.get(g.deputyId) ?? 'DDM account' },
        grantedBy: { id: g.grantedById, name: name.get(g.grantedById) ?? null },
        grantedAt: g.createdAt.toISOString(),
        startsAt: g.startsAt.toISOString(),
        expiresAt: g.expiresAt.toISOString(),
        endedEarly: g.revokedAt
          ? { at: g.revokedAt.toISOString(), byName: endedBy.get(g.id) ?? null }
          : null,
        reason: g.reason,
        status: grantStatus(g, now),
        societiesOpened: openedCount.get(g.id) ?? 0,
      };
    });
  }
}
