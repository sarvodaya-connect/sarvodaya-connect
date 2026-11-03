import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service.js';
config({ path: '../../.env', quiet: true });
/**
 * Cognito: links the first HQ account to a Cognito user an administrator has
 * already created in the user pool (with a permanent password). HQ then
 * creates every other account from the dashboard (D16i). No password is read
 * or stored here. Refuses when an HQ account already exists.
 */
const username = process.env.BOOTSTRAP_HQ_USERNAME;
if (!username || !/^[a-z0-9][a-z0-9._-]{2,99}$/.test(username))
  throw new Error(
    'Set BOOTSTRAP_HQ_USERNAME to the lowercase Cognito username',
  );
const subject = process.env.BOOTSTRAP_HQ_COGNITO_SUB?.trim();
if (!subject || !/^[0-9a-f-]{36}$/i.test(subject))
  throw new Error(
    "Set BOOTSTRAP_HQ_COGNITO_SUB to the Cognito user's sub (aws cognito-idp admin-get-user … shows it)",
  );
const db = new PrismaService(new ConfigService());
try {
  await db.$transaction(
    async (tx) => {
      if (await tx.platformAccount.count({ where: { role: 'HQ_ADMIN' } }))
        throw new Error(
          'HQ already exists. Create other accounts from the dashboard.',
        );
      const account = await tx.platformAccount.create({
        data: {
          username,
          displayName: process.env.BOOTSTRAP_HQ_NAME ?? 'HQ Administrator',
          phone: process.env.BOOTSTRAP_HQ_PHONE ?? '+94000000000',
          role: 'HQ_ADMIN',
          status: 'ACTIVE',
          providerSubject: subject,
          passwordSetAt: new Date(),
          passwordSetCount: 1,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: account.id,
          action: 'COGNITO_HQ_LINKED',
          targetId: account.id,
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  process.stdout.write(
    `HQ account ${username} linked to its Cognito user. Sign in on the dashboard with the Cognito password.\n`,
  );
} finally {
  await db.$disconnect();
}
