/** SC-29: Fictional development fixtures. Never use real client or operational data here. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SocietyStatus, MembershipCategory } from '../src/generated/prisma/client.ts';
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

const assignmentData = [
  { id: '29000000-0000-4000-8000-000000000601', societyId: societyData[0].id, role: 'SOCIETY_OFFICER' as const, userId: 'demo-officer-sunrise', assignedById: 'demo-hq-admin' },
  { id: '29000000-0000-4000-8000-000000000602', societyId: societyData[0].id, role: 'SPC' as const, userId: 'demo-programme-coordinator', assignedById: 'demo-hq-admin' },
  { id: '29000000-0000-4000-8000-000000000603', societyId: societyData[1].id, role: 'SPC' as const, userId: 'demo-programme-coordinator', assignedById: 'demo-hq-admin' },
  { id: '29000000-0000-4000-8000-000000000604', societyId: societyData[2].id, role: 'SOCIETY_OFFICER' as const, userId: 'demo-officer-lotus', assignedById: 'demo-hq-admin' },
  { id: '29000000-0000-4000-8000-000000000605', societyId: societyData[2].id, role: 'SPC' as const, userId: 'demo-programme-coordinator', assignedById: 'demo-hq-admin' },
] as const;

const councilTypes = [
  ...Array<MembershipCategory>(3).fill(MembershipCategory.CHILDREN),
  ...Array<MembershipCategory>(3).fill(MembershipCategory.YOUTH),
  ...Array<MembershipCategory>(3).fill(MembershipCategory.MOTHERS),
  ...Array<MembershipCategory>(9).fill(MembershipCategory.ORDINARY),
  ...Array<MembershipCategory>(7).fill(MembershipCategory.ELDERS_COUNCIL),
];
const demoCouncil = councilTypes.map((seatType, index) => ({
  id: `29000000-0000-4000-8000-${String(301 + index).padStart(12, '0')}`,
  societyId: societyData[0].id,
  seatNumber: index + 1,
  fullName: `Demo Council Member ${String(index + 1).padStart(2, '0')}`,
  position: ['President', 'Secretary', 'Treasurer'][index] ?? 'Council Member',
  seatType,
  age: seatType === MembershipCategory.CHILDREN ? 10 + (index % 4) : seatType === MembershipCategory.YOUTH ? 18 + (index % 7) : null,
  isActive: true,
  isPrimaryContact: index === 0,
}));
const demoMembership = [
  { category: MembershipCategory.CHILDREN, female: 178, male: 164 },
  { category: MembershipCategory.YOUTH, female: 246, male: 219 },
  { category: MembershipCategory.MOTHERS, female: 526, male: 0 },
  { category: MembershipCategory.ORDINARY, female: 1485, male: 1328 },
  { category: MembershipCategory.ELDERS_COUNCIL, female: 82, male: 65 },
].map((row) => ({ societyId: societyData[0].id, year: 2026, ...row }));

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const row of districtData) {
      await tx.district.upsert({ where: { id: row.id }, create: row, update: { code: row.code, nameEn: row.nameEn } });
    }
    for (const row of societyData) {
      await tx.society.upsert({ where: { id: row.id }, create: row, update: row });
    }
    for (const row of assignmentData) {
      await tx.societyAssignment.upsert({
        where: { societyId_role_userId: { societyId: row.societyId, role: row.role, userId: row.userId } },
        create: row,
        update: { assignedById: row.assignedById, revokedAt: null },
      });
    }
    for (const row of contactData) {
      await tx.societyContact.upsert({ where: { id: row.id }, create: row, update: row });
    }
    await tx.societyCouncilMember.deleteMany({ where: { societyId: societyData[0].id } });
    await tx.societyCouncilMember.createMany({ data: demoCouncil });
    for (const row of demoMembership) {
      await tx.societyMembershipCount.upsert({
        where: { societyId_year_category: { societyId: row.societyId, year: row.year, category: row.category } },
        create: row,
        update: { female: row.female, male: row.male },
      });
    }
    await tx.emergencyIncident.upsert({
      where: { id: '29000000-0000-4000-8000-000000000501' },
      create: {
        id: '29000000-0000-4000-8000-000000000501',
        districtId: districtData[0].id,
        title: 'Demo flood response · Sunrise district',
        type: 'FLOOD',
        severity: 'HIGH',
        description: 'Fictional rainfall has affected several roads and households. Use this record to exercise the local emergency workflow.',
        location: 'Imaginary Sunrise Village',
        latitude: 7.3,
        longitude: 80.6,
        createdById: 'demo-dm-north',
      },
      update: { title: 'Demo flood response · Sunrise district', status: 'ACTIVE' },
    });
    await tx.emergencyAssessment.upsert({
      where: { createdById_clientMutationId: { createdById: 'demo-officer-sunrise', clientMutationId: '29000000-0000-4000-8000-000000000502' } },
      create: {
        incidentId: '29000000-0000-4000-8000-000000000501',
        societyId: societyData[0].id,
        clientMutationId: '29000000-0000-4000-8000-000000000502',
        status: 'SUBMITTED',
        observedAt: new Date('2026-10-20T08:00:00.000Z'),
        peopleAffected: 42,
        householdsAffected: 11,
        displacedPeople: 6,
        infrastructureNotes: 'Fictional demo: one footbridge closed.',
        urgentNeeds: 'Fictional demo: drinking water and dry food.',
        notes: 'Example field assessment; no real incident data.',
        createdById: 'demo-officer-sunrise',
      },
      update: {},
    });
    await tx.emergencyResponseAction.upsert({
      where: { createdById_clientMutationId: { createdById: 'demo-dm-north', clientMutationId: '29000000-0000-4000-8000-000000000503' } },
      create: {
        incidentId: '29000000-0000-4000-8000-000000000501',
        societyId: societyData[0].id,
        clientMutationId: '29000000-0000-4000-8000-000000000503',
        title: 'Coordinate drinking-water delivery',
        description: 'Fictional demonstration response assignment.',
        status: 'IN_PROGRESS',
        createdById: 'demo-dm-north',
      },
      update: {},
    });
    await tx.emergencySituationReport.upsert({
      where: { createdById_clientMutationId: { createdById: 'demo-officer-sunrise', clientMutationId: '29000000-0000-4000-8000-000000000504' } },
      create: {
        incidentId: '29000000-0000-4000-8000-000000000501',
        societyId: societyData[0].id,
        clientMutationId: '29000000-0000-4000-8000-000000000504',
        status: 'SUBMITTED',
        summary: 'Fictional demo: water is receding, with six residents temporarily displaced.',
        needs: 'Fictional demo: clean water, dry food and transport.',
        createdById: 'demo-officer-sunrise',
      },
      update: {},
    });
  });
  console.log(`SC-29 seed complete: ${districtData.length} fictional districts, ${societyData.length} fictional societies, ${assignmentData.length} fictional staff assignments, ${contactData.length} fictional contacts, ${demoCouncil.length} fictional council seats, ${demoMembership.length} fictional membership categories and one fictional emergency-response scenario.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
