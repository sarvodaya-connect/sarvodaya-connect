import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { authProviderName } from '../auth/cognito-authentication.provider.js';
import {
  COGNITO_ACCOUNT_ADMIN,
  CognitoAdminError,
  type CognitoAccountAdmin,
} from '../auth/cognito-account-admin.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  hasRole,
  readableDistrictIds,
  type Principal,
  type UserRole,
} from '../auth/principal.js';
import type { AuditType } from './identity.dto.js';
import type {
  AccountDetailsDto,
  CreateAccountDto,
  LoginDto,
  SetAccountPasswordDto,
  AuditQueryDto,
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

const SHORT_ROLE: Record<string, string> = {
  SOCIETY_OFFICER: 'Society Officer',
  PROGRAMME_COORDINATOR: 'SPC',
  DEPUTY_DISTRICT_MANAGER: 'DDM',
  DISTRICT_MANAGER: 'DM',
  HQ_ADMIN: 'HQ',
};

/** V5 D24 "Type" filter: which audit actions each group covers. */
const AUDIT_ACTIONS: Record<AuditType, readonly string[]> = {
  SOCIETY: [
    'SOCIETY_CREATED',
    'SOCIETY_PROFILE_UPDATED',
    'SOCIETY_MEMBERSHIP_UPDATED',
    'SOCIETY_STAFF_ASSIGNED',
  ],
  EXCO: ['SOCIETY_COUNCIL_UPDATED', 'MEMBER_NIC_UPDATED'],
  GRADE: [
    'GRADE_CHANGE_REQUESTED',
    'GRADE_CHANGE_APPROVED',
    'GRADE_CHANGE_REJECTED',
    'SOCIETY_GRADE_CHANGED',
  ],
  ACCOUNTS: [
    'ACCOUNT_CREATED',
    'ACCOUNT_SCOPE_UPDATED',
    'ACCOUNT_PASSWORD_CHANGED',
    'ACCOUNT_DISABLED',
    'LOCAL_HQ_BOOTSTRAPPED',
    'COGNITO_HQ_LINKED',
  ],
  ACCESS: [
    'DISTRICT_ACCESS_GRANTED',
    'DISTRICT_ACCESS_REVOKED',
    'DISTRICT_SOCIETY_OPENED',
    'MEMBER_NIC_REVEALED',
  ],
  RECORDS: [
    'ANNUAL_SUMMARY_UPDATED',
    'AUDIT_REPORT_UPLOADED',
    'DOCUMENT_UPLOADED',
    'WORK_PLAN_UPDATED',
  ],
  ASSISTANT: ['SARVOAI_QUESTION'],
};
const AUDIT_TYPE_OF: Record<string, AuditType> = Object.fromEntries(
  Object.entries(AUDIT_ACTIONS).flatMap(([type, actions]) =>
    actions.map((action) => [action, type as AuditType]),
  ),
);
const LOCKOUT_MS = 15 * 60_000;

/** HQ-facing messages for Cognito refusals; never the password or AWS detail. */
function cognitoFailure(error: unknown): Error {
  if (!(error instanceof CognitoAdminError)) return error as Error;
  switch (error.reason) {
    case 'INVALID_PASSWORD':
      return new BadRequestException(
        'The sign-in service did not accept this password. Use at least 10 characters with a number, and try again.',
      );
    case 'NOT_FOUND':
      return new ConflictException(
        'The sign-in for this account was removed while it was being set up. Set a new password to finish it.',
      );
    default:
      return new ServiceUnavailableException(
        'The sign-in service could not be reached. Nothing was changed for sign-in; try again in a few minutes.',
      );
  }
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  /** Chosen once at start-up, like the authentication provider itself. */
  private readonly cognito: boolean;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    @Inject(COGNITO_ACCOUNT_ADMIN)
    private readonly cognitoAdmin: CognitoAccountAdmin,
  ) {
    this.cognito = authProviderName(config) === 'cognito';
  }

  /**
   * After the database already refuses the account's tokens, also revoke its
   * Cognito refresh tokens (and disable it, if asked). A failure here is logged
   * by account id only: the API keeps refusing the old sign-in either way.
   */
  private async cognitoFollowUp(
    accountId: string,
    username: string,
    disable = false,
  ) {
    if (!this.cognito) return;
    try {
      if (disable) await this.cognitoAdmin.disable(username);
      await this.cognitoAdmin.signOut(username);
    } catch (error) {
      this.logger.warn(
        `Cognito ${disable ? 'disable and ' : ''}sign-out did not finish for account ${accountId}: ${error instanceof CognitoAdminError ? error.reason : 'unknown error'}`,
      );
    }
  }

  /** Local passwords and accounts: development and tests only, and never alongside Cognito. */
  private localOnly() {
    if (
      !['development', 'test'].includes(this.config.get('NODE_ENV') ?? '') ||
      this.cognito
    ) {
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
    if (this.cognito) return this.createCognitoAccount(input, principal);
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
      return {
        id: created.id,
        username: created.username,
        status: created.status,
      };
    });
    return { account, delivery: 'MANUAL_HANDOVER' };
  }
  /**
   * V5 D16 with Amazon Cognito. The account row is saved first as PENDING (it
   * cannot sign in), then the Cognito user is found or created, given HQ's
   * permanent password and linked by its `sub`. Each step can be repeated, so
   * if any step fails HQ submits the same form again and it resumes: no
   * duplicate Cognito users and no account linked to someone else's sign-in.
   */
  private async createCognitoAccount(
    input: CreateAccountDto,
    principal: Principal,
  ) {
    this.hq(principal);
    await this.validateScope(input);
    this.validatePassword(input.password, input.username);
    const details = {
      displayName: input.displayName,
      phone: input.phone,
      email: input.email,
      role: input.role,
      districtId: input.districtId ?? null,
      societyIds: input.societyIds,
    };
    const existing = await this.db.platformAccount.findUnique({
      where: { username: input.username },
    });
    if (existing && (existing.status !== 'PENDING' || existing.providerSubject))
      throw new ConflictException('Username is already in use');
    // A PENDING row is an earlier attempt that did not finish: resume it.
    const pending = existing
      ? await this.db.platformAccount.update({
          where: { id: existing.id },
          data: details,
        })
      : await this.db.platformAccount.create({
          data: {
            ...details,
            username: input.username,
            status: 'PENDING',
          },
        });
    const subject = await this.cognitoSignIn(pending, input.password);
    const account = await this.db.$transaction(async (tx) => {
      const created = await tx.platformAccount.update({
        where: { id: pending.id },
        data: {
          providerSubject: subject,
          passwordHash: null,
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
      return {
        id: created.id,
        username: created.username,
        status: created.status,
      };
    });
    return { account, delivery: 'MANUAL_HANDOVER' };
  }
  /**
   * Finds or creates the Cognito user for this account, checks it is not
   * someone else's, then sets HQ's permanent password and enables it. Safe to
   * repeat. Returns the Cognito `sub` to store in `provider_subject`.
   */
  private async cognitoSignIn(
    account: { id: string; username: string; providerSubject: string | null },
    password: string,
  ): Promise<string> {
    let subject: string;
    try {
      subject =
        (await this.cognitoAdmin.findSubject(account.username)) ??
        (await this.cognitoAdmin
          .createUser(account.username)
          .catch(async (error) => {
            // Created by a parallel request a moment ago: use that user.
            const raced =
              error instanceof CognitoAdminError &&
              error.reason === 'USERNAME_EXISTS'
                ? await this.cognitoAdmin.findSubject(account.username)
                : null;
            if (!raced) throw error;
            return raced;
          }));
    } catch (error) {
      throw cognitoFailure(error);
    }
    const linked = await this.db.platformAccount.findUnique({
      where: { providerSubject: subject },
      select: { id: true },
    });
    if (
      (linked && linked.id !== account.id) ||
      (account.providerSubject && account.providerSubject !== subject)
    ) {
      // Never point two accounts at one sign-in; the password is left unchanged.
      this.logger.warn(
        `Cognito user for account ${account.id} does not match its link (linked account ${linked?.id ?? 'none'})`,
      );
      throw new ConflictException(
        'This username belongs to a different person in the sign-in service. Choose a different username, or ask the AWS administrator to check the user pool.',
      );
    }
    try {
      await this.cognitoAdmin.setPassword(account.username, password);
      await this.cognitoAdmin.enable(account.username);
    } catch (error) {
      throw cognitoFailure(error);
    }
    return subject;
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
    const result = await this.db.$transaction(async (tx) => {
      const account = await tx.platformAccount.update({
        where: { id },
        data: {
          displayName: input.displayName,
          phone: input.phone,
          email: input.email,
          role: input.role,
          districtId: input.districtId ?? null,
          societyIds: input.societyIds,
          sessionsRevokedAt: new Date(),
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
    await this.cognitoFollowUp(id, current.username);
    return result;
  }
  async setPassword(
    id: string,
    input: SetAccountPasswordDto,
    principal: Principal,
  ) {
    if (!this.cognito) this.localOnly();
    this.hq(principal);
    const account = await this.db.platformAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    this.validatePassword(input.password, account.username);
    // Cognito: permanent, so the person signs in with it straight away (V5 D16).
    // This also finishes an account whose creation stopped part-way (PENDING).
    const subject = this.cognito
      ? await this.cognitoSignIn(account, input.password)
      : undefined;
    await this.db.$transaction(async (tx) => {
      await tx.platformAccount.update({
        where: { id },
        data: {
          ...(subject ? { providerSubject: subject } : {}),
          passwordHash: this.cognito ? null : passwordHash(input.password),
          sessionsRevokedAt: new Date(),
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
    await this.cognitoFollowUp(id, account.username);
    return { status: 'ACTIVE' };
  }
  async disableAccount(id: string, principal: Principal) {
    this.hq(principal);
    if (id === principal.id)
      throw new BadRequestException('You cannot disable your own account');
    const current = await this.db.platformAccount.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Account not found');
    const result = await this.db.$transaction(async (tx) => {
      await tx.platformAccount.update({
        where: { id },
        data: { status: 'INACTIVE', sessionsRevokedAt: new Date() },
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
    if (current.providerSubject)
      await this.cognitoFollowUp(id, current.username, true);
    return result;
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
      select: {
        id: true,
        districtId: true,
        startsAt: true,
        expiresAt: true,
        grantedById: true,
      },
    });
    const grantors = grants.length
      ? await this.db.platformAccount.findMany({
          where: { id: { in: [...new Set(grants.map((g) => g.grantedById))] } },
          select: { id: true, displayName: true },
        })
      : [];
    const grantorName = new Map(grantors.map((a) => [a.id, a.displayName]));
    return {
      id: account.id,
      displayName: account.displayName,
      roles: [account.role as UserRole],
      districtIds: account.districtId ? [account.districtId] : [],
      societyIds: account.societyIds,
      delegatedDistrictAccess: grants.map((g) => ({
        grantId: g.id,
        districtId: g.districtId,
        startsAt: g.startsAt.toISOString(),
        expiresAt: g.expiresAt.toISOString(),
        grantedByName: grantorName.get(g.grantedById),
      })),
    };
  }
  /** V5 PR 10: the account linked to a Cognito user (`provider_subject`), with roles and scope from the database. */
  async principalForSubject(
    subject: string,
    authTime?: number,
  ): Promise<Principal | null> {
    const account = await this.db.platformAccount.findUnique({
      where: { providerSubject: subject },
      select: { id: true, sessionsRevokedAt: true },
    });
    if (!account) return null;
    // A sign-in from before a password reset, scope change or disable is over,
    // even if Cognito has refreshed its access token since (auth_time is kept).
    if (
      account.sessionsRevokedAt &&
      (authTime === undefined ||
        authTime < Math.floor(account.sessionsRevokedAt.getTime() / 1000))
    )
      return null;
    return this.principalFor(account.id);
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
  /**
   * V5 D24 change & access log, within the viewer's scope (HQ national).
   * Entries name the person, their role and the society or account changed;
   * details never contain NICs, passwords or credentials.
   */
  async audit(
    principal: Principal,
    query: AuditQueryDto = {},
    now = new Date(),
  ) {
    const districts = readableDistrictIds(principal);
    const scope = hasRole(principal, 'HQ_ADMIN')
      ? {}
      : {
          OR: [
            { societyId: { in: principal.societyIds } },
            ...(districts.length ? [{ districtId: { in: districts } }] : []),
          ],
        };
    const q = query.q?.trim();
    const [societyMatches, accountMatches] = q
      ? await Promise.all([
          this.db.society.findMany({
            where: {
              OR: [
                { nameEn: { contains: q, mode: 'insensitive' } },
                { societyCode: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
            take: 200,
          }),
          this.db.platformAccount.findMany({
            where: {
              OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { username: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
            take: 200,
          }),
        ])
      : [[], []];
    const rows = await this.db.platformAuditEvent.findMany({
      where: {
        AND: [
          scope,
          query.districtId ? { districtId: query.districtId } : {},
          query.type ? { action: { in: [...AUDIT_ACTIONS[query.type]] } } : {},
          query.role ? { actorRole: query.role } : {},
          query.days
            ? {
                createdAt: {
                  gte: new Date(now.getTime() - query.days * 24 * 3600_000),
                },
              }
            : {},
          q
            ? {
                OR: [
                  { societyId: { in: societyMatches.map((row) => row.id) } },
                  { actorId: { in: accountMatches.map((row) => row.id) } },
                  { targetId: { in: accountMatches.map((row) => row.id) } },
                  { actorName: { contains: q, mode: 'insensitive' as const } },
                ],
              }
            : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const ids = (pick: (row: (typeof rows)[number]) => string | null) => [
      ...new Set(rows.map(pick).filter((id): id is string => Boolean(id))),
    ];
    const uuid = /^[0-9a-f-]{36}$/i;
    const [accounts, societies, districtRows, requests] = await Promise.all([
      this.db.platformAccount.findMany({
        where: {
          id: {
            in: [
              ...ids((row) => row.actorId),
              ...ids((row) => row.targetId),
            ].filter((id) => uuid.test(id)),
          },
        },
        select: { id: true, displayName: true, role: true },
      }),
      this.db.society.findMany({
        where: { id: { in: ids((row) => row.societyId) } },
        select: { id: true, nameEn: true, societyCode: true },
      }),
      this.db.district.findMany({
        where: { id: { in: ids((row) => row.districtId) } },
        select: { id: true, nameEn: true },
      }),
      this.db.gradeChangeRequest.findMany({
        where: {
          id: {
            in: rows
              .filter(
                (row) =>
                  row.action === 'GRADE_CHANGE_REQUESTED' &&
                  uuid.test(row.targetId),
              )
              .map((row) => row.targetId),
          },
        },
        select: { id: true, status: true, decidedByName: true },
      }),
    ]);
    const account = new Map(accounts.map((row) => [row.id, row]));
    const society = new Map(societies.map((row) => [row.id, row]));
    const district = new Map(districtRows.map((row) => [row.id, row.nameEn]));
    const request = new Map(requests.map((row) => [row.id, row]));
    return {
      data: rows.map((row) => {
        const actor = account.get(row.actorId);
        const target = account.get(row.targetId);
        const place = row.societyId ? society.get(row.societyId) : undefined;
        const decision =
          row.action === 'GRADE_CHANGE_REQUESTED'
            ? request.get(row.targetId)
            : undefined;
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          action: row.action,
          type: AUDIT_TYPE_OF[row.action] ?? null,
          actor: {
            displayName: row.actorName ?? actor?.displayName ?? 'Unknown user',
            role: row.actorRole ?? actor?.role ?? null,
          },
          // The society, or for account changes the person and role, or the district.
          scope: place
            ? place.nameEn
            : row.societyId
              ? 'Removed record'
              : target && row.action.startsWith('ACCOUNT_')
                ? `${target.displayName} · ${SHORT_ROLE[target.role] ?? target.role}`
                : row.districtId
                  ? district.has(row.districtId)
                    ? `${district.get(row.districtId)} District`
                    : 'Removed record'
                  : 'National',
          // Only link to societies that still exist.
          societyId: place ? row.societyId : null,
          detail: row.detail,
          approvedBy: [
            'GRADE_CHANGE_APPROVED',
            'GRADE_CHANGE_REJECTED',
            'SOCIETY_GRADE_CHANGED',
          ].includes(row.action)
            ? (row.actorName ?? actor?.displayName ?? null)
            : decision
              ? decision.status === 'PENDING'
                ? 'Waiting'
                : decision.decidedByName
              : null,
        };
      }),
    };
  }
}
