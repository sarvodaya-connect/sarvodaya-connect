import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  AccountDetailsDto,
  CreateAccountDto,
  GrantDistrictAccessDto,
  LoginDto,
  SetAccountPasswordDto,
  UpdateAccountDto,
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

/** V5 D01 / M03e: one message for every failed sign-in, so it never reveals
 * whether the username exists. */
export const SIGN_IN_FAILED =
  'The username or password is not correct. Check them and try again.';
export const SIGN_IN_LOCKED =
  'Too many attempts. Try again in 15 minutes, or ask HQ to set a new password.';
const MAX_FAILED_SIGN_INS = 5;
const LOCKOUT_MS = 15 * 60_000;

@Injectable()
export class IdentityService {
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
  private hq(principal: Principal) {
    if (!hasRole(principal, 'HQ_ADMIN'))
      throw new ForbiddenException('HQ access required');
  }
  private async validateScope(input: AccountDetailsDto) {
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
        select: { id: true, nameEn: true, code: true },
        orderBy: { nameEn: 'asc' },
      }),
      this.db.society.findMany({
        select: { id: true, nameEn: true, societyCode: true, districtId: true },
        orderBy: { nameEn: 'asc' },
      }),
    ]);
    return { districts, societies };
  }
  async accounts(principal: Principal, now = new Date()) {
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
        passwordSetAt: true,
        passwordSetCount: true,
      },
    });
    // V5 D16 marks a DDM whose temporary district-wide view is active now.
    const grants = await this.db.districtAccessGrant.findMany({
      where: {
        deputyId: { in: rows.map((row) => row.id) },
        revokedAt: null,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: { deputyId: true },
    });
    const temporary = new Set(grants.map((grant) => grant.deputyId));
    return {
      data: rows.map((row) => ({
        ...row,
        temporaryDistrictView: temporary.has(row.id),
      })),
    };
  }
  async createAccount(input: CreateAccountDto, principal: Principal) {
    this.localOnly();
    this.hq(principal);
    await this.validateScope(input);
    if (
      await this.db.platformAccount.findUnique({
        where: { username: input.username },
      })
    )
      throw new ConflictException('Username is already in use');
    this.validatePassword(input.password, input.username);
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
          passwordHash: passwordHash(input.password),
          passwordSetAt: new Date(),
          passwordSetCount: 1,
          status: 'ACTIVE',
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'ACCOUNT_CREATED',
          targetId: created.id,
          districtId: created.districtId,
          detail: `Role ${created.role}; initial password set by HQ`,
        },
      });
      return { id: created.id, username: created.username, status: created.status };
    });
    return { account, delivery: 'MANUAL_HANDOVER' };
  }
  private validatePassword(password: string, username: string) {
    if (
      password.length < 10 ||
      password.length > 128 ||
      !/\d/.test(password) ||
      password.toLowerCase() === username.toLowerCase()
    ) {
      throw new BadRequestException(
        'Use at least 10 characters with a number, different from the username',
      );
    }
  }
  async updateAccount(
    id: string,
    input: UpdateAccountDto,
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
  async setPassword(
    id: string,
    input: SetAccountPasswordDto,
    principal: Principal,
  ) {
    this.localOnly();
    this.hq(principal);
    const account = await this.db.platformAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    this.validatePassword(input.password, account.username);
    await this.db.$transaction(async (tx) => {
      await tx.platformAccount.update({
        where: { id },
        data: {
          passwordHash: passwordHash(input.password),
          passwordSetAt: new Date(),
          passwordSetCount: { increment: 1 },
          failedLoginCount: 0,
          lockedUntil: null,
          status: 'ACTIVE',
        },
      });
      await tx.accountSession.deleteMany({ where: { accountId: id } });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          action: 'ACCOUNT_PASSWORD_CHANGED',
          targetId: id,
          districtId: account.districtId,
          detail: 'HQ set a replacement password; existing sessions revoked',
        },
      });
    });
    return { status: 'ACTIVE' };
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
  async login(input: LoginDto, now = new Date()) {
    this.localOnly();
    const username = input.username.trim().toLowerCase();
    const account = await this.db.platformAccount.findUnique({
      where: { username },
    });
    if (account?.lockedUntil && account.lockedUntil > now)
      throw new UnauthorizedException(SIGN_IN_LOCKED);
    // A dummy hash keeps the timing the same when the username is unknown.
    const matches = passwordMatches(
      input.password,
      account?.passwordHash ?? passwordHash('unused-dummy-password'),
    );
    if (!account || account.status !== 'ACTIVE' || !matches) {
      if (account) {
        const failed = account.failedLoginCount + 1;
        await this.db.platformAccount.update({
          where: { id: account.id },
          data:
            failed >= MAX_FAILED_SIGN_INS
              ? {
                  failedLoginCount: 0,
                  lockedUntil: new Date(now.getTime() + LOCKOUT_MS),
                }
              : { failedLoginCount: failed },
        });
      }
      throw new UnauthorizedException(SIGN_IN_FAILED);
    }
    if (account.failedLoginCount || account.lockedUntil)
      await this.db.platformAccount.update({
        where: { id: account.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    const token = randomBytes(32).toString('base64url');
    await this.db.accountSession.create({
      data: {
        accountId: account.id,
        tokenHash: digest(token),
        expiresAt: new Date(now.getTime() + 8 * 3600_000),
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
