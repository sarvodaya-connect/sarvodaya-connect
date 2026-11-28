/**
 * Shared setup for the database tests: the API as main.ts configures it, a
 * fictional district and society layout, platform accounts with logins, and
 * the cleanup that removes them again.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const TEST_PASSWORD = 'test-password-123';

/** Boots the whole API with the global prefix, validation and error filter. */
export async function createDbTestApp(): Promise<{
  app: INestApplication;
  db: PrismaService;
}> {
  process.env.NIC_ENCRYPTION_KEY = '22'.repeat(32);
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  return { app, db: app.get(PrismaService) };
}

/** Creates a North and a Central district and active societies in them. */
export async function seedDistrictsAndSocieties<K extends string>(
  db: PrismaService,
  opts: {
    suffix: string;
    codePrefix: string;
    north: string;
    central: string;
    societies: readonly (readonly [key: K, id: string, districtId: string])[];
  },
): Promise<void> {
  const { suffix, codePrefix, north, central } = opts;
  await db.district.createMany({
    data: [
      { id: north, code: `N${suffix}`, nameEn: `Fictional North ${suffix}` },
      {
        id: central,
        code: `C${suffix}`,
        nameEn: `Fictional Central ${suffix}`,
      },
    ],
  });
  await db.society.createMany({
    data: opts.societies.map(([key, id, districtId]) => ({
      id,
      societyCode: `${codePrefix}${key.toUpperCase()}-${suffix}`,
      nameEn: `Fictional ${key} ${suffix}`,
      districtId,
      status: 'ACTIVE' as const,
    })),
  });
}

/** Builds platform account rows, named with the prefix, that log in with TEST_PASSWORD. */
export const testAccountFor =
  (usernamePrefix: string) =>
  (
    id: string,
    role: string,
    opts: { districtId?: string; societyIds?: string[] } = {},
  ) => ({
    id,
    username: `${usernamePrefix}.${role.toLowerCase()}.${id.slice(0, 6)}`,
    displayName: `Fictional ${role}`,
    phone: '+94000000000',
    role,
    status: 'ACTIVE',
    passwordHash: passwordHash(TEST_PASSWORD),
    districtId: opts.districtId ?? null,
    societyIds: opts.societyIds ?? [],
  });

/** Logs every account in and returns its bearer token by key. */
export async function loginAll<K extends string>(
  app: INestApplication,
  db: PrismaService,
  ids: Record<K, string>,
): Promise<Record<K, string>> {
  const tokens = {} as Record<K, string>;
  for (const key of Object.keys(ids) as K[]) {
    const { username } = await db.platformAccount.findUniqueOrThrow({
      where: { id: ids[key] },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/identity/login')
      .send({ username, password: TEST_PASSWORD })
      .expect(201);
    tokens[key] = login.body.token;
  }
  return tokens;
}

/** Removes the accounts, their audit trail and grants, societies and districts. */
export async function removeTestScope(
  db: PrismaService,
  scope: {
    accountIds: string[];
    societyIds: string[];
    districtIds: string[];
  },
): Promise<void> {
  const { accountIds } = scope;
  await db.platformAuditEvent.deleteMany({
    where: { actorId: { in: accountIds } },
  });
  await db.districtAccessGrant.deleteMany({
    where: { deputyId: { in: accountIds } },
  });
  await db.platformAccount.deleteMany({ where: { id: { in: accountIds } } });
  await db.society.deleteMany({ where: { id: { in: scope.societyIds } } });
  await db.district.deleteMany({ where: { id: { in: scope.districtIds } } });
}
