import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { passwordHash } from '../src/identity/identity.service.js';
config({ path: '../../.env', quiet: true });
if (!['development', 'test'].includes(process.env.NODE_ENV ?? ''))
  throw new Error('Local bootstrap is disabled outside development/test');
const username = process.env.BOOTSTRAP_HQ_USERNAME;
if (!username || !/^[a-z0-9][a-z0-9._-]{2,99}$/.test(username))
  throw new Error('Set BOOTSTRAP_HQ_USERNAME to a lowercase username');
// V5: HQ accounts have a permanent password. It is read from the environment
// (for example with `read -rs BOOTSTRAP_HQ_PASSWORD`) and never printed.
const password = process.env.BOOTSTRAP_HQ_PASSWORD ?? '';
if (
  password.length < 10 ||
  password.length > 128 ||
  !/\d/.test(password) ||
  password.toLowerCase() === username
)
  throw new Error(
    'Set BOOTSTRAP_HQ_PASSWORD: at least 10 characters with a number, different from the username',
  );
const db = new PrismaService(new ConfigService());
try {
  await db.$transaction(
    async (tx) => {
      if (await tx.platformAccount.count({ where: { role: 'HQ_ADMIN' } }))
        throw new Error('HQ already exists. Create other accounts from the dashboard.');
      const account = await tx.platformAccount.create({
        data: {
          username,
          displayName:
            process.env.BOOTSTRAP_HQ_NAME ?? 'Local HQ Administrator',
          phone: process.env.BOOTSTRAP_HQ_PHONE ?? '+94000000000',
          role: 'HQ_ADMIN',
          status: 'ACTIVE',
          passwordHash: passwordHash(password),
          passwordSetAt: new Date(),
          passwordSetCount: 1,
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
    `HQ account created. Username: ${username}\nSign in on the dashboard with this username and the password you set.\n`,
  );
} finally {
  await db.$disconnect();
}
