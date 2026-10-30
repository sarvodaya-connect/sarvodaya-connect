import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service.js';
config({ path: '../../.env', quiet: true });
if (!['development', 'test'].includes(process.env.NODE_ENV ?? ''))
  throw new Error('Local bootstrap is disabled outside development/test');
const username = process.env.BOOTSTRAP_HQ_USERNAME;
if (!username || !/^[a-z0-9][a-z0-9._-]{2,99}$/.test(username))
  throw new Error('Set BOOTSTRAP_HQ_USERNAME to a lowercase username');
const db = new PrismaService(new ConfigService());
try {
  const credential = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 72 * 3600_000);
  await db.$transaction(
    async (tx) => {
      if (await tx.platformAccount.count({ where: { role: 'HQ_ADMIN' } }))
        throw new Error('HQ already exists. Use the HQ invitation screen.');
      const account = await tx.platformAccount.create({
        data: {
          username,
          displayName:
            process.env.BOOTSTRAP_HQ_NAME ?? 'Local HQ Administrator',
          phone: process.env.BOOTSTRAP_HQ_PHONE ?? '+94000000000',
          role: 'HQ_ADMIN',
        },
      });
      await tx.accountInvitation.create({
        data: {
          accountId: account.id,
          tokenHash: createHash('sha256').update(credential).digest('hex'),
          method: 'LINK',
          expiresAt,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: account.id,
          action: 'LOCAL_HQ_BOOTSTRAPPED',
          targetId: account.id,
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  process.stdout.write(
    `HQ account created. Username: ${username}\nOne-time activation credential (shown once): ${credential}\nExpires: ${expiresAt.toISOString()}\nOpen the dashboard /activate page and enter this credential.\n`,
  );
} finally {
  await db.$disconnect();
}
