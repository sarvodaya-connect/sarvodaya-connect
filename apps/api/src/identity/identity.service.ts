import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  hasRole,
  readableDistrictIds,
  type Principal,
  type UserRole,
} from '../auth/principal.js';
import type {
  ActivateAccountDto,
  ActivationCheckDto,
  GrantDistrictAccessDto,
  InviteAccountDto,
  LoginDto,
} from './identity.dto.js';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password: string, hash: string) {
  const [salt, encoded] = hash.split(':');
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class IdentityService {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private localOnly() {
    if (!['development', 'test'].includes(this.config.get('NODE_ENV') ?? '')) {
      throw new ForbiddenException(
        'Local credentials are disabled. Configure the production identity provider.',
      );
    }
  }
  private activationUrl(credential: string, username: string) {
    const base =
      this.config.get<string>('DASHBOARD_PUBLIC_URL') ??
      'http://localhost:3000';
    const url = new URL('/activate', base);
    url.hash = new URLSearchParams({ credential, username }).toString();
    return url.toString();
  }
  private hq(principal: Principal) {
    if (!hasRole(principal, 'HQ_ADMIN'))
      throw new ForbiddenException('HQ access required');
  }
  private async validateScope(input: InviteAccountDto) {
    if (input.role === 'HQ_ADMIN') {
      if (input.districtId || input.societyIds.length)
        throw new BadRequestException('HQ has national scope');
      return;
    }
    if (
      !input.districtId ||
      !(await this.db.district.findUnique({ where: { id: input.districtId } }))
    ) {
      throw new BadRequestException('Select a valid district');
    }
    if (input.role === 'DISTRICT_MANAGER') {
      if (input.societyIds.length)
        throw new BadRequestException('A DM is assigned to a district');
    } else {
      if (
        !input.societyIds.length ||
        (input.role === 'SOCIETY_OFFICER' && input.societyIds.length !== 1)
      ) {
        throw new BadRequestException(
          'Select assigned societies; a Society Officer has exactly one',
        );
      }
      const count = await this.db.society.count({
        where: { id: { in: input.societyIds }, districtId: input.districtId },
      });
      if (count !== input.societyIds.length)
        throw new BadRequestException(
          'Every assigned society must belong to the selected district',
        );
    }
  }
  async scopeOptions(principal: Principal) {
    this.hq(principal);
    const [districts, societies] = await Promise.all([
      this.db.district.findMany({
        select: { id: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
      }),
      this.db.society.findMany({
        select: { id: true, nameEn: true, societyCode: true, districtId: true },
        orderBy: { nameEn: 'asc' },
      }),
    ]);
    return { districts, societies };
  }
  async accounts(principal: Principal) {
    this.hq(principal);
    const rows = await this.db.platformAccount.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        phone: true,
        email: true,
        role: true,
        districtId: true,
        societyIds: true,
        status: true,
        invitations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { method: true, expiresAt: true, usedAt: true },
        },
      },
    });
    return { data: rows };
  }
  async invite(input: InviteAccountDto, principal: Principal) {
    this.localOnly();
    this.hq(principal);
    await this.validateScope(input);
    if (
      await this.db.platformAccount.findUnique({
        where: { username: input.username },
      })
    )
      throw new ConflictException('Username is already in use');
    const credential = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 72 * 3600_000);
    const account = await this.db.$transaction(async (tx) => {
      const created = await tx.platformAccount.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          phone: input.phone,
          email: input.email,
          role: input.role,
          districtId: input.districtId,
          societyIds: input.societyIds,
        },
      });
      await tx.accountInvitation.create({
        data: {
          accountId: created.id,
          tokenHash: digest(credential),
          method: input.method,
          expiresAt,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'ACCOUNT_INVITED',
          targetId: created.id,
          districtId: created.districtId,
          detail: `Role ${created.role}; activation ${input.method}`,
        },
      });
      return { id: created.id, username: created.username };
    });
    return {
      account,
      activationUrl: this.activationUrl(credential, account.username),
      method: input.method,
      credential,
      expiresAt,
      delivery: 'MANUAL_HANDOVER',
    };
  }
  async updateAccount(
    id: string,
    input: InviteAccountDto,
    principal: Principal,
  ) {
    this.hq(principal);
    await this.validateScope(input);
    const current = await this.db.platformAccount.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Account not found');
    if (id === principal.id && input.role !== 'HQ_ADMIN')
      throw new BadRequestException('You cannot remove your own HQ access');
    return this.db.$transaction(async (tx) => {
      const account = await tx.platformAccount.update({
        where: { id },
        data: {
          displayName: input.displayName,
          phone: input.phone,
          email: input.email,
          role: input.role,
          districtId: input.districtId ?? null,
          societyIds: input.societyIds,
        },
      });
      await tx.accountSession.deleteMany({ where: { accountId: id } });
      await tx.districtAccessGrant.updateMany({
        where: { deputyId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'ACCOUNT_SCOPE_UPDATED',
          targetId: id,
          districtId: account.districtId,
          detail: `Role ${input.role}; sessions and temporary access revoked`,
        },
      });
      return { id: account.id, role: account.role, status: account.status };
    });
  }
  async disableAccount(id: string, principal: Principal) {
    this.hq(principal);
    if (id === principal.id)
      throw new BadRequestException('You cannot disable your own account');
    if (!(await this.db.platformAccount.findUnique({ where: { id } })))
      throw new NotFoundException('Account not found');
    return this.db.$transaction(async (tx) => {
      await tx.platformAccount.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
      await tx.accountSession.deleteMany({ where: { accountId: id } });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'ACCOUNT_DISABLED',
          targetId: id,
        },
      });
      return { status: 'INACTIVE' };
    });
  }
  async reissue(id: string, method: string, principal: Principal) {
    this.localOnly();
    this.hq(principal);
    const account = await this.db.platformAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.status === 'INACTIVE')
      throw new ConflictException('Account is inactive');
    const credential = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 72 * 3600_000);
    await this.db.$transaction(async (tx) => {
      await tx.accountInvitation.updateMany({
        where: { accountId: id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.accountSession.deleteMany({ where: { accountId: id } });
      await tx.platformAccount.update({
        where: { id },
        data: { status: 'PENDING' },
      });
      await tx.accountInvitation.create({
        data: {
          accountId: id,
          tokenHash: digest(credential),
          method,
          expiresAt,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'ACTIVATION_REISSUED',
          targetId: id,
          districtId: account.districtId,
        },
      });
    });
    return {
      account: { id, username: account.username },
      activationUrl: this.activationUrl(credential, account.username),
      method,
      credential,
      expiresAt,
      delivery: 'MANUAL_HANDOVER',
    };
  }
  private async invitation(input: ActivationCheckDto) {
    this.localOnly();
    const invitation = await this.db.accountInvitation.findUnique({
      where: { tokenHash: digest(input.credential) },
      include: { account: true },
    });
    if (!invitation && input.username)
      throw new UnauthorizedException(
        'The username or temporary password is incorrect',
      );
    if (
      !invitation ||
      invitation.usedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.account.status === 'INACTIVE' ||
      (invitation.method === 'TEMPORARY_PASSWORD' &&
        invitation.account.username !== input.username?.trim().toLowerCase())
    ) {
      throw new GoneException(
        'Activation expired, already used, or incorrect. Ask HQ for a new invitation.',
      );
    }
    return invitation;
  }
  async checkActivation(input: ActivationCheckDto) {
    const { account, expiresAt } = await this.invitation(input);
    const [district, societies] = await Promise.all([
      account.districtId
        ? this.db.district.findUnique({
            where: { id: account.districtId },
            select: { nameEn: true },
          })
        : null,
      this.db.society.findMany({
        where: { id: { in: account.societyIds } },
        select: { id: true, nameEn: true, societyCode: true },
      }),
    ]);
    const labels: Record<UserRole, string> = {
      SOCIETY_OFFICER: 'Society Officer',
      PROGRAMME_COORDINATOR: 'SPC',
      DEPUTY_DISTRICT_MANAGER: 'Deputy District Manager',
      DISTRICT_MANAGER: 'District Manager',
      HQ_ADMIN: 'HQ',
    };
    const scopeLabel =
      account.role === 'HQ_ADMIN'
        ? 'National access'
        : account.role === 'DISTRICT_MANAGER'
          ? `${district?.nameEn ?? 'Assigned district'} district`
          : societies.map((s) => `${s.nameEn} · ${s.societyCode}`).join('; ');
    return {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      roleLabel: labels[account.role as UserRole],
      scopeLabel,
      districtId: account.districtId,
      societyIds: account.societyIds,
      expiresAt,
    };
  }
  async activate(input: ActivateAccountDto) {
    const invitation = await this.invitation(input);
    if (
      !/\d/.test(input.password) ||
      input.password.toLowerCase() === invitation.account.username.toLowerCase()
    )
      throw new BadRequestException(
        'Use at least 10 characters with a number, different from your username',
      );
    const encoded = passwordHash(input.password);
    await this.db.$transaction(async (tx) => {
      const consumed = await tx.accountInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new GoneException('This invitation has already been used');
      await tx.accountInvitation.updateMany({
        where: { accountId: invitation.accountId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.platformAccount.update({
        where: { id: invitation.accountId },
        data: { passwordHash: encoded, status: 'ACTIVE' },
      });
      await tx.accountSession.deleteMany({
        where: { accountId: invitation.accountId },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: invitation.accountId,
          action: 'ACCOUNT_ACTIVATED',
          targetId: invitation.accountId,
          districtId: invitation.account.districtId,
        },
      });
    });
    return { status: 'ACTIVE' };
  }
  async login(input: LoginDto) {
    this.localOnly();
    const username = input.username.trim().toLowerCase();
    const attempt = this.attempts.get(username);
    if (attempt && attempt.until > Date.now() && attempt.count >= 5)
      throw new UnauthorizedException(
        'Too many attempts. Try again in 15 minutes.',
      );
    const account = await this.db.platformAccount.findUnique({
      where: { username },
    });
    if (
      !account ||
      account.status !== 'ACTIVE' ||
      !passwordMatches(
        input.password,
        account.passwordHash ?? passwordHash('unused-dummy-password'),
      )
    ) {
      this.attempts.set(username, {
        count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
        until: Date.now() + 15 * 60_000,
      });
      throw new UnauthorizedException(
        'Username or password is incorrect, or the account requires activation',
      );
    }
    this.attempts.delete(username);
    const token = randomBytes(32).toString('base64url');
    await this.db.accountSession.create({
      data: {
        accountId: account.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 8 * 3600_000),
      },
    });
    return { token, user: await this.principalFor(account.id) };
  }
  async principalFor(id: string): Promise<Principal | null> {
    const account = await this.db.platformAccount.findUnique({ where: { id } });
    if (!account || account.status !== 'ACTIVE') return null;
    const grants = await this.db.districtAccessGrant.findMany({
      where: {
        deputyId: id,
        revokedAt: null,
        startsAt: { lte: new Date() },
        expiresAt: { gt: new Date() },
      },
    });
    return {
      id: account.id,
      displayName: account.displayName,
      roles: [account.role as UserRole],
      districtIds: account.districtId ? [account.districtId] : [],
      societyIds: account.societyIds,
      delegatedDistrictAccess: grants.map((g) => ({
        districtId: g.districtId,
        startsAt: g.startsAt.toISOString(),
        expiresAt: g.expiresAt.toISOString(),
      })),
    };
  }
  async authenticate(token: string) {
    this.localOnly();
    const session = await this.db.accountSession.findUnique({
      where: { tokenHash: digest(token) },
    });
    return session && session.expiresAt > new Date()
      ? this.principalFor(session.accountId)
      : null;
  }
  async logout(token: string) {
    await this.db.accountSession.deleteMany({
      where: { tokenHash: digest(token) },
    });
    return { signedOut: true };
  }
  async deputies(principal: Principal) {
    if (!hasRole(principal, 'DISTRICT_MANAGER'))
      throw new ForbiddenException('District Manager access required');
    return {
      data: await this.db.platformAccount.findMany({
        where: {
          role: 'DEPUTY_DISTRICT_MANAGER',
          status: 'ACTIVE',
          districtId: { in: principal.districtIds },
        },
        select: { id: true, displayName: true, districtId: true },
      }),
    };
  }
  async grants(principal: Principal) {
    const where = hasRole(principal, 'HQ_ADMIN')
      ? {}
      : hasRole(principal, 'DISTRICT_MANAGER')
        ? { districtId: { in: principal.districtIds } }
        : { deputyId: principal.id };
    return {
      data: await this.db.districtAccessGrant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
  async grant(input: GrantDistrictAccessDto, principal: Principal) {
    if (
      !hasRole(principal, 'DISTRICT_MANAGER') ||
      !principal.districtIds.includes(input.districtId)
    )
      throw new ForbiddenException(
        'Only the District Manager of this district can grant access',
      );
    const deputy = await this.db.platformAccount.findUnique({
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
    if (expiresAt <= startsAt || expiresAt <= new Date())
      throw new BadRequestException(
        'End time must be later than start time and now',
      );
    return this.db.$transaction(async (tx) => {
      const grant = await tx.districtAccessGrant.create({
        data: {
          districtId: input.districtId,
          deputyId: input.deputyId,
          reason: input.reason,
          startsAt,
          expiresAt,
          grantedById: principal.id,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'DISTRICT_ACCESS_GRANTED',
          targetId: grant.id,
          districtId: input.districtId,
          detail: `View only until ${expiresAt.toISOString()}. ${input.reason}`,
        },
      });
      return grant;
    });
  }
  async revoke(id: string, principal: Principal) {
    const grant = await this.db.districtAccessGrant.findUnique({
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
    return this.db.$transaction(async (tx) => {
      await tx.districtAccessGrant.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'DISTRICT_ACCESS_REVOKED',
          targetId: id,
          districtId: grant.districtId,
        },
      });
      return { revoked: true };
    });
  }
  async audit(principal: Principal) {
    const districts = readableDistrictIds(principal);
    const where = hasRole(principal, 'HQ_ADMIN')
      ? {}
      : {
          OR: [
            { societyId: { in: principal.societyIds } },
            ...(districts.length ? [{ districtId: { in: districts } }] : []),
          ],
        };
    return {
      data: await this.db.platformAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    };
  }
}
