/**
 * Seed real tenant/unit data for the 3 properties, extracted from the
 * client's actual floor-plan layouts:
 *   - Layout Green Terrace Maret 2026.pdf
 *   - Layout The Amboja 31 Mar 2026.pdf
 *   - The aloon - aloon Layout 31032026.pdf
 *
 * A handful of small/blurry logos on the source PDFs couldn't be read with
 * full confidence — those rows carry a note asking leasing to verify the
 * name via the CRUD UI rather than guessing silently.
 *
 * Idempotent: upserts on the (location, block, unitNo) unique key, so this
 * can be re-run safely after fixing a row here.
 *
 * Run with: npx tsx prisma/seed-tenants.ts
 */
import { PrismaClient, TenantLocation, TenantStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface Row {
  block: string;
  unitNo: string;
  name: string | null;
  status: TenantStatus;
  area?: number;
  notes?: string;
}

const GREEN_TERRACE: Row[] = [
  // Block A
  { block: 'Block A', unitNo: '1',  name: 'CaMa Tailor & Fashion',            status: 'ACTIVE' },
  { block: 'Block A', unitNo: '2',  name: 'Amanaia — Citarasa Tradisional Indonesia', status: 'ACTIVE' },
  { block: 'Block A', unitNo: '3',  name: 'Pizza Hut',                        status: 'ACTIVE', area: 338 },
  { block: 'Block A', unitNo: '5',  name: 'Solaria',                          status: 'ACTIVE', area: 337 },
  { block: 'Block A', unitNo: '3A', name: 'Kopi Tarik Edwin',                 status: 'ACTIVE', area: 337 },
  { block: 'Block A', unitNo: '6',  name: 'J.CO Donuts & Mako Coffee',        status: 'ACTIVE', area: 360 },
  // Block B
  { block: 'Block B', unitNo: '5',   name: 'Daily',                          status: 'ACTIVE', area: 265 },
  { block: 'Block B', unitNo: '6',   name: 'Deuseyo',                        status: 'ACTIVE', area: 58 },
  { block: 'Block B', unitNo: '7&8', name: 'Bank Mandiri',                   status: 'ACTIVE', area: 148, notes: 'Nama dari logo — mohon verifikasi.' },
  { block: 'Block B', unitNo: '9',   name: 'A&W',                            status: 'ACTIVE', area: 200 },
  // Block C
  { block: 'Block C', unitNo: '1',       name: 'HEMA',  status: 'ACTIVE', area: 110 },
  { block: 'Block C', unitNo: '7',       name: 'Century', status: 'ACTIVE', area: 65 },
  { block: 'Block C', unitNo: '8',       name: 'Bakmi GM', status: 'ACTIVE', area: 55 },
  { block: 'Block C', unitNo: '9',       name: 'Bakmi GM', status: 'ACTIVE', area: 55 },
  { block: 'Block C', unitNo: 'Plaza C', name: 'NONIK Salon', status: 'ACTIVE', area: 400 },
  // Block D
  { block: 'Block D', unitNo: '1',        name: 'Medikids',         status: 'ACTIVE', area: 212 },
  { block: 'Block D', unitNo: '2',        name: 'Medikids',         status: 'ACTIVE', area: 212 },
  { block: 'Block D', unitNo: '3',        name: 'Tekko',            status: 'ACTIVE', area: 212 },
  { block: 'Block D', unitNo: '5',        name: 'Tekko',            status: 'ACTIVE', area: 212 },
  { block: 'Block D', unitNo: '6',        name: 'Sunda Restaurant', status: 'ACTIVE', area: 127 },
  { block: 'Block D', unitNo: 'Anchor',   name: 'AZKO / Electronic City', status: 'ACTIVE', area: 954.5 },
  { block: 'Block D', unitNo: 'MM Juice', name: 'MM Juice',         status: 'ACTIVE', area: 71.6 },
  { block: 'Block D', unitNo: '14',       name: 'Starbucks',        status: 'ACTIVE', area: 108 },
  { block: 'Block D', unitNo: '15',       name: 'Starbucks',        status: 'ACTIVE', area: 108 },
  { block: 'Block D', unitNo: '18',       name: 'Double Shot',      status: 'ACTIVE', area: 48 },
  { block: 'Block D', unitNo: '21',       name: 'Vito',             status: 'ACTIVE', area: 41.3 },
];

// Units whose identifying key changed shape between the first seed pass and
// this corrected one (e.g. a misread unit number) — upsert can't "rename" a
// unique key, so the stale row is deleted before the corrected one is created.
const RENAMED_AWAY: { location: TenantLocation; block: string; unitNo: string }[] = [
  { location: 'GREEN_TERRACE', block: 'Block A', unitNo: '5A' },
  { location: 'THE_AMBOJA', block: 'Ground Floor', unitNo: '3' },
];

const THE_AMBOJA: Row[] = [
  // Lower Ground
  { block: 'Lower Ground', unitNo: '1',  name: 'Imperial Kitchen & Dimsum', status: 'ACTIVE', area: 197 },
  { block: 'Lower Ground', unitNo: '2',  name: null, status: 'VACANT', area: 48 },
  { block: 'Lower Ground', unitNo: '3',  name: null, status: 'VACANT', area: 100 },
  { block: 'Lower Ground', unitNo: '3A', name: null, status: 'VACANT', area: 900 },
  // Ground Floor
  { block: 'Ground Floor', unitNo: '1',        name: 'Pizza Piaco',              status: 'ACTIVE', area: 78 },
  { block: 'Ground Floor', unitNo: '1 Studio', name: 'Studio Karate & Ballet',   status: 'ACTIVE' },
  { block: 'Ground Floor', unitNo: '3A',       name: 'Croco',                    status: 'ACTIVE', area: 192 },
  { block: 'Ground Floor', unitNo: '3',        name: null,                       status: 'VACANT', area: 98 },
  { block: 'Ground Floor', unitNo: '5',        name: null,                       status: 'VACANT', area: 122 },
  { block: 'Ground Floor', unitNo: '8',        name: null,                       status: 'VACANT', area: 65 },
  { block: 'Ground Floor', unitNo: '06',       name: '06 Cafe',                  status: 'ACTIVE', area: 122 },
  { block: 'Ground Floor', unitNo: 'GF-Cafe',  name: "The People's Cafe",        status: 'ACTIVE', area: 153 },
  { block: 'Ground Floor', unitNo: '10',       name: 'Alash Beauty Studio',      status: 'ACTIVE', area: 30 },
  { block: 'Ground Floor', unitNo: '09',       name: null,                       status: 'VACANT', area: 59, notes: 'Slot didesain untuk Desserts/Snacks.' },
  // Upper Ground
  { block: 'Upper Ground', unitNo: '1',  name: null, status: 'VACANT', area: 66 },
  { block: 'Upper Ground', unitNo: '2',  name: 'Shichida',          status: 'ACTIVE', area: 84 },
  { block: 'Upper Ground', unitNo: '3',  name: 'Bebek Tepi Sawah',  status: 'ACTIVE', area: 220 },
  { block: 'Upper Ground', unitNo: '3A', name: null, status: 'VACANT', area: 106 },
  { block: 'Upper Ground', unitNo: '6',  name: 'Katsu Sen',         status: 'ACTIVE', area: 106 },
  { block: 'Upper Ground', unitNo: '7',  name: 'Fork',              status: 'ACTIVE', area: 106 },
  { block: 'Upper Ground', unitNo: '9',  name: 'Teras Barbershop',  status: 'ACTIVE', area: 30 },
  // 1st Floor
  { block: '1st Floor', unitNo: '2',  name: null, status: 'VACANT', area: 148 },
  { block: '1st Floor', unitNo: '3',  name: null, status: 'VACANT', area: 214 },
  { block: '1st Floor', unitNo: '5',  name: null, status: 'VACANT', area: 300 },
  { block: '1st Floor', unitNo: '1',  name: 'Anytime Fitness', status: 'ACTIVE' },
];

const ALOON_ALOON: Row[] = [
  // Ground Floor
  { block: 'Ground Floor', unitNo: '1',   name: 'SK-LO',   status: 'ACTIVE', area: 170, notes: 'Nama dari logo — mohon verifikasi.' },
  { block: 'Ground Floor', unitNo: '2',   name: 'hello',   status: 'ACTIVE', area: 69 },
  { block: 'Ground Floor', unitNo: '3',   name: 'Samsung', status: 'ACTIVE', area: 57.5 },
  { block: 'Ground Floor', unitNo: '8&9', name: 'HK',      status: 'ACTIVE', area: 103.5, notes: 'Nama dari logo — mohon verifikasi.' },
  { block: 'Ground Floor', unitNo: '5',   name: null,      status: 'VACANT', area: 188 },
  { block: 'Ground Floor', unitNo: '6',   name: 'Guardian', status: 'ACTIVE', area: 119 },
  { block: 'Ground Floor', unitNo: '7',   name: null,      status: 'VACANT', area: 190 },
  { block: 'Ground Floor', unitNo: '3A',  name: 'Solaria', status: 'ACTIVE', area: 182 },
  { block: 'Ground Floor', unitNo: '10',  name: 'Borobudur', status: 'ACTIVE', area: 13, notes: 'Nama dari logo — mohon verifikasi.' },
  // Upper Ground
  { block: 'Upper Ground', unitNo: '1',   name: 'Senyawaa', status: 'ACTIVE', area: 138 },
  { block: 'Upper Ground', unitNo: '2',   name: null, status: 'VACANT', area: 80 },
  { block: 'Upper Ground', unitNo: '3',   name: null, status: 'VACANT', area: 76 },
  { block: 'Upper Ground', unitNo: '3A',  name: null, status: 'VACANT', area: 76 },
  { block: 'Upper Ground', unitNo: '5',   name: null, status: 'VACANT', area: 104 },
  { block: 'Upper Ground', unitNo: '7 (39m2)', name: null, status: 'VACANT', area: 39 },
  { block: 'Upper Ground', unitNo: '7 Teazzi', name: 'Teazzi', status: 'ACTIVE', area: 42 },
  { block: 'Upper Ground', unitNo: '8',   name: null, status: 'VACANT', area: 39 },
  { block: 'Upper Ground', unitNo: '12',  name: null, status: 'VACANT', area: 200 },
  { block: 'Upper Ground', unitNo: '12A', name: null, status: 'VACANT', area: 144 },
  { block: 'Upper Ground', unitNo: '11',  name: 'Ayam Goreng Pemuda Surabaya', status: 'ACTIVE', area: 84 },
  { block: 'Upper Ground', unitNo: '10',  name: 'Optik Seis', status: 'ACTIVE', area: 84 },
  { block: 'Upper Ground', unitNo: '9',   name: null, status: 'VACANT', area: 87 },
  // LT 1
  { block: 'LT 1', unitNo: 'Cinema',  name: 'Cinema XXI',               status: 'ACTIVE', area: 703 },
  { block: 'LT 1', unitNo: '1',       name: 'Oma Liem',                 status: 'ACTIVE', area: 128 },
  { block: 'LT 1', unitNo: '2',       name: null,                       status: 'VACANT', area: 129 },
  { block: 'LT 1', unitNo: '3,3A&6',  name: 'Imperial Kitchen & Dimsum', status: 'ACTIVE', area: 180 },
  { block: 'LT 1', unitNo: '7',       name: 'Mitra Gamesindo — Area Playground', status: 'ACTIVE', area: 312 },
  { block: 'LT 1', unitNo: '8',       name: null, status: 'VACANT', area: 394, notes: 'Area foodcourt — bukan tenant tunggal.' },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@sangroup.id' }, select: { id: true } });
  if (!admin) throw new Error('Super admin user (admin@sangroup.id) not found — run the main seed first.');

  for (const stale of RENAMED_AWAY) {
    await prisma.tenant.deleteMany({ where: stale });
  }

  const sets: [TenantLocation, Row[]][] = [
    ['GREEN_TERRACE', GREEN_TERRACE],
    ['THE_AMBOJA', THE_AMBOJA],
    ['ALOON_ALOON', ALOON_ALOON],
  ];

  let count = 0;
  for (const [location, rows] of sets) {
    for (const row of rows) {
      await prisma.tenant.upsert({
        where: { location_block_unitNo: { location, block: row.block, unitNo: row.unitNo } },
        create: {
          location, block: row.block, unitNo: row.unitNo,
          name: row.name, status: row.status, area: row.area, notes: row.notes,
          createdById: admin.id,
        },
        update: {
          name: row.name, status: row.status, area: row.area, notes: row.notes,
        },
      });
      count++;
    }
  }

  console.log(`✅ Seeded ${count} tenant/unit records across ${sets.length} properties.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
