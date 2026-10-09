import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// The repository .env file holds DATABASE_URL (see src/app.module.ts).
config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'),
  quiet: true,
});

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env at the repository root.',
  );
}

// Safety guard: this fictional data may only be written to a local database.
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
if (!localHosts.includes(new URL(connectionString).hostname)) {
  throw new Error('Refusing to seed a database that is not on localhost.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Provisional district list (ISO 3166-2:LK codes). To be confirmed with Sarvodaya.
const districts: Array<[string, string]> = [
  ['LK-11', 'Colombo'],
  ['LK-12', 'Gampaha'],
  ['LK-13', 'Kalutara'],
  ['LK-21', 'Kandy'],
  ['LK-22', 'Matale'],
  ['LK-23', 'Nuwara Eliya'],
  ['LK-31', 'Galle'],
  ['LK-32', 'Matara'],
  ['LK-33', 'Hambantota'],
  ['LK-41', 'Jaffna'],
  ['LK-42', 'Kilinochchi'],
  ['LK-43', 'Mannar'],
  ['LK-44', 'Vavuniya'],
  ['LK-45', 'Mullaitivu'],
  ['LK-51', 'Batticaloa'],
  ['LK-52', 'Ampara'],
  ['LK-53', 'Trincomalee'],
  ['LK-61', 'Kurunegala'],
  ['LK-62', 'Puttalam'],
  ['LK-71', 'Anuradhapura'],
  ['LK-72', 'Polonnaruwa'],
  ['LK-81', 'Badulla'],
  ['LK-82', 'Monaragala'],
  ['LK-91', 'Ratnapura'],
  ['LK-92', 'Kegalle'],
];

type Status = 'ACTIVE' | 'INACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED';

// Entirely fictional societies: [district code, latitude, longitude, status].
// Coordinates are approximate and only used for map testing.
const societySeeds: Array<[string, number, number, Status]> = [
  ['LK-11', 6.9271, 79.8612, 'ACTIVE'],
  ['LK-11', 6.902, 79.878, 'ACTIVE'],
  ['LK-12', 7.0873, 79.9925, 'ACTIVE'],
  ['LK-12', 7.11, 80.02, 'UNDER_REVIEW'],
  ['LK-21', 7.2906, 80.6337, 'ACTIVE'],
  ['LK-21', 7.26, 80.6, 'INACTIVE'],
  ['LK-31', 6.0535, 80.221, 'ACTIVE'],
  ['LK-41', 9.6615, 80.0255, 'ACTIVE'],
  ['LK-51', 7.717, 81.7, 'UNDER_REVIEW'],
  ['LK-61', 7.4863, 80.3647, 'ACTIVE'],
  ['LK-61', 7.51, 80.33, 'SUSPENDED'],
  ['LK-71', 8.3114, 80.4037, 'ACTIVE'],
];

async function main() {
  const districtIds = new Map<string, string>();
  for (const [code, nameEn] of districts) {
    const district = await prisma.district.upsert({
      where: { code },
      update: { nameEn },
      create: { code, nameEn },
    });
    districtIds.set(code, district.id);
  }

  for (const [index, seed] of societySeeds.entries()) {
    const [districtCode, latitude, longitude, status] = seed;
    const number = index + 1;
    const padded = String(number).padStart(4, '0');
    const societyCode = `DEMO-${padded}`;

    const data = {
      nameEn: `Fictional Demo Society ${number}`,
      districtId: districtIds.get(districtCode)!,
      dsDivision: `Demo DS Division ${number}`,
      gnDivision: `Demo GN Division ${number}`,
      village: `Demo Village ${number}`,
      addressLine: `${number} Example Road, Demo Village ${number}`,
      latitude,
      longitude,
      establishedOn: new Date(Date.UTC(1995 + number, number % 12, 1)),
      status,
    };

    const society = await prisma.society.upsert({
      where: { societyCode },
      update: data,
      create: { societyCode, ...data },
    });

    await prisma.societyContact.deleteMany({
      where: { societyId: society.id },
    });
    await prisma.societyContact.createMany({
      data: [
        {
          societyId: society.id,
          label: 'Main office',
          phone: `+94 70 000 ${padded}`,
          email: `demo-${padded}@example.org`,
          isPrimary: true,
        },
        ...(number % 3 === 0
          ? [
              {
                societyId: society.id,
                label: 'Secondary',
                phone: `+94 70 001 ${padded}`,
                email: null,
                isPrimary: false,
              },
            ]
          : []),
      ],
    });
  }

  const [districtCount, societyCount, contactCount] = await Promise.all([
    prisma.district.count(),
    prisma.society.count(),
    prisma.societyContact.count(),
  ]);
  console.log(
    `Seed complete: ${districtCount} districts, ${societyCount} societies, ${contactCount} contacts.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
