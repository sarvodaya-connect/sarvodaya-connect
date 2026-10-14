/** SC-29: Fictional development fixtures. Never use real client or operational data here. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SocietyStatus } from '../src/generated/prisma/client.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for local seed');
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed with NODE_ENV=production');
const parsed = new URL(url);
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  throw new Error('SC-29 seed is restricted to local PostgreSQL hosts');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const districtData = [
  { id: '29000000-0000-4000-8000-000000000001', code: 'DEMO-N', nameEn: 'Fictional North District' },
  { id: '29000000-0000-4000-8000-000000000002', code: 'DEMO-C', nameEn: 'Fictional Central District' },
  { id: '29000000-0000-4000-8000-000000000003', code: 'DEMO-S', nameEn: 'Fictional South District' },
] as const;

const societyData = [
  { id: '29000000-0000-4000-8000-000000000101', societyCode: 'DEMO-SOC-001', nameEn: 'Example Sunrise Society', districtId: districtData[0].id, status: SocietyStatus.ACTIVE, village: 'Imaginary Sunrise Village', addressLine: '1 Fictional Lane', dsDivision: 'Demo Division A', gnDivision: 'Demo GN A', latitude: 7.3, longitude: 80.6, establishedOn: new Date('2020-01-15T00:00:00.000Z') },
  { id: '29000000-0000-4000-8000-000000000102', societyCode: 'DEMO-SOC-002', nameEn: 'Example Bluebird Society', districtId: districtData[0].id, status: SocietyStatus.UNDER_REVIEW, village: 'Imaginary Bluebird Hamlet', addressLine: '2 Sample Road' },
  { id: '29000000-0000-4000-8000-000000000103', societyCode: 'DEMO-SOC-003', nameEn: 'Example Lotus Society', districtId: districtData[1].id, status: SocietyStatus.ACTIVE, village: 'Imaginary Lotus Village', addressLine: '3 Fictional Street', latitude: 7.0, longitude: 80.4 },
  { id: '29000000-0000-4000-8000-000000000104', societyCode: 'DEMO-SOC-004', nameEn: 'Example Lantern Society', districtId: districtData[1].id, status: SocietyStatus.INACTIVE },
  { id: '29000000-0000-4000-8000-000000000105', societyCode: 'DEMO-SOC-005', nameEn: 'Example Riverstone Society', districtId: districtData[2].id, status: SocietyStatus.SUSPENDED, village: 'Imaginary Riverstone Hamlet', addressLine: '5 Example Avenue' },
  { id: '29000000-0000-4000-8000-000000000106', societyCode: 'DEMO-SOC-006', nameEn: 'Example Starlight Society', districtId: districtData[2].id, status: SocietyStatus.UNDER_REVIEW },
] as const;

const contactData = [
  { id: '29000000-0000-4000-8000-000000000201', societyId: societyData[0].id, label: 'Fictional Coordinator', email: 'sunrise@example.com', isPrimary: true },
  { id: '29000000-0000-4000-8000-000000000202', societyId: societyData[0].id, label: 'Fictional Secondary Contact', email: 'sunrise-alt@example.com', isPrimary: false },
  { id: '29000000-0000-4000-8000-000000000203', societyId: societyData[2].id, label: 'Fictional Coordinator', email: 'lotus@example.com', isPrimary: true },
  { id: '29000000-0000-4000-8000-000000000204', societyId: societyData[4].id, label: 'Fictional Contact', email: 'riverstone@example.com', isPrimary: true },
] as const;

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const row of districtData) {
      await tx.district.upsert({ where: { id: row.id }, create: row, update: { code: row.code, nameEn: row.nameEn } });
    }
    for (const row of societyData) {
      await tx.society.upsert({ where: { id: row.id }, create: row, update: row });
    }
    for (const row of contactData) {
      await tx.societyContact.upsert({ where: { id: row.id }, create: row, update: row });
    }
  });
  console.log(`SC-29 seed complete: ${districtData.length} fictional districts, ${societyData.length} fictional societies, ${contactData.length} fictional contacts.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
