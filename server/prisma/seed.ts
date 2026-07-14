import {
  PrismaClient, TaskStatus, TaskPriority, TaskVisibility,
  BulletinCategory, BulletinPriority, NotificationType, AssignmentStatus,
  WorkOrderStatus, WorkOrderPriority, WorkOrderCategory,
  AttendanceStatus, LeaveStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hash(pw, 12);
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

// Deterministic PRNG so every seed run produces the same demo dataset.
let rngState = 20260714;
function rng(): number {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Jakarta calendar date (YYYY-MM-DD) of a JS Date. */
const jktDateStr = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
/** UTC-midnight Date for a YYYY-MM-DD string — the @db.Date representation. */
const dateOnly = (s: string) => new Date(s + 'T00:00:00.000Z');
/** Date at HH:MM WIB on the given calendar day (setUTCHours handles day rollover). */
const atWIB = (day: string, h: number, m: number) => {
  const t = new Date(day + 'T00:00:00.000Z');
  t.setUTCHours(h - 7, m, 0, 0);
  return t;
};

const FIRST_NAMES = ['Agus', 'Bella', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hendra', 'Indah', 'Joko', 'Kartika', 'Lukman', 'Maya', 'Niko', 'Oktavia', 'Putra', 'Qori', 'Rina', 'Surya', 'Tania', 'Umar', 'Vina', 'Wawan', 'Yanti', 'Zaki', 'Ayu', 'Bagus', 'Cahya', 'Dian', 'Erik', 'Fitri', 'Galih', 'Hesti', 'Irfan', 'Juni', 'Kevin', 'Lina', 'Mira', 'Nanda', 'Oscar', 'Prita', 'Rendi', 'Sinta', 'Tono', 'Ulfa', 'Vito', 'Winda', 'Yusuf', 'Zahra', 'Arif'];
const LAST_NAMES  = ['Saputra', 'Wulandari', 'Hidayat', 'Lestari', 'Nugroho', 'Rahayu', 'Kurniawan', 'Anggraini', 'Firmansyah', 'Puspita', 'Ramadhan', 'Safitri', 'Gunawan', 'Handayani', 'Prasetyo', 'Melati', 'Setiawan', 'Utami', 'Wibowo', 'Maharani', 'Santoso', 'Pertiwi', 'Hakim', 'Novita', 'Pratama'];

/** Tanggal Jakarta sebagai UTC-midnight Date — format yang dipakai kolom myDayDate (@db.Date). */
const jakartaDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000);
  return new Date(d.toISOString().slice(0, 10));
};

/**
 * Look up role id — roles are dynamic (manageable via admin UI), so try the
 * candidate slugs first, then fall back to any role at the given level.
 */
async function getRoleId(slugCandidates: string[], fallbackLevel: number): Promise<string> {
  for (const slug of slugCandidates) {
    const role = await prisma.role.findUnique({ where: { slug } });
    if (role) return role.id;
  }
  const byLevel = await prisma.role.findFirst({ where: { level: fallbackLevel }, orderBy: { position: 'asc' } });
  if (byLevel) return byLevel.id;
  throw new Error(`No role found for slugs [${slugCandidates.join(', ')}] or level ${fallbackLevel}.`);
}

/** Look up division id by slug — divisions are seeded via migration SQL */
async function getDivisionId(slug: string): Promise<string> {
  const division = await prisma.division.findUnique({ where: { slug } });
  if (!division) throw new Error(`Division slug '${slug}' not found. Run the migration first.`);
  return division.id;
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Lookup role and division IDs (seeded via migration) ────
  const [
    roleSuper, rolePM, roleHR, roleFinance, roleChief, roleDirector,
    divManagement, divProperty, divHR, divFinance, divEngineering, divRetail,
  ] = await Promise.all([
    getRoleId(['SUPER_ADMIN'], 1),
    getRoleId(['PROPERTY_MANAGER', 'KEPALA_DIVISI'], 4),
    getRoleId(['HR_MANAGER', 'KEPALA_DIVISI'], 4),
    getRoleId(['FINANCE_MANAGER', 'KEPALA_DIVISI'], 4),
    getRoleId(['CHIEF_ENGINEER', 'KEPALA_UNIT'], 5),
    getRoleId(['DIRECTOR', 'DIREKTUR'], 2),
    getDivisionId('MANAGEMENT'),
    getDivisionId('PROPERTY'),
    getDivisionId('HR'),
    getDivisionId('FINANCE'),
    getDivisionId('ENGINEERING'),
    getDivisionId('RETAIL'),
  ]);

  // ── Users ──────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sangroup.id' },
    update: {},
    create: {
      email: 'admin@sangroup.id', username: 'superadmin',
      password: await hash('admin123'), fullName: 'Super Admin', phone: '08100000000',
      roleId: roleSuper, divisionId: divManagement, isActive: true,
      joinDate: new Date('2023-01-09T00:00:00.000Z'),
    },
  });
  const director = await prisma.user.upsert({
    where: { email: 'director.retail@sangroup.id' },
    update: {},
    create: {
      email: 'director.retail@sangroup.id', username: 'director.retail',
      password: await hash('password123'), fullName: 'Andi Pratama', phone: '08111111111',
      roleId: roleDirector, divisionId: divRetail, isActive: true,
      joinDate: new Date('2022-06-01T00:00:00.000Z'),
    },
  });
  const pm = await prisma.user.upsert({
    where: { email: 'pm@sangroup.id' },
    update: {},
    create: {
      email: 'pm@sangroup.id', username: 'property.manager',
      password: await hash('password123'), fullName: 'Dimas Wijaya', phone: '08111222222',
      roleId: rolePM, divisionId: divProperty, isActive: true,
      joinDate: new Date('2024-02-15T00:00:00.000Z'),
    },
  });
  const hr = await prisma.user.upsert({
    where: { email: 'hr@sangroup.id' },
    update: {},
    create: {
      email: 'hr@sangroup.id', username: 'hr.manager',
      password: await hash('password123'), fullName: 'Sari Dewi', phone: '08122222222',
      roleId: roleHR, divisionId: divHR, isActive: true,
      joinDate: new Date('2023-09-01T00:00:00.000Z'),
    },
  });
  const finance = await prisma.user.upsert({
    where: { email: 'finance@sangroup.id' },
    update: {},
    create: {
      email: 'finance@sangroup.id', username: 'finance.manager',
      password: await hash('password123'), fullName: 'Budi Santoso', phone: '08133333333',
      roleId: roleFinance, divisionId: divFinance, isActive: true,
      joinDate: new Date('2024-11-20T00:00:00.000Z'),
    },
  });
  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@sangroup.id' },
    update: {},
    create: {
      email: 'engineer@sangroup.id', username: 'chief.engineer',
      password: await hash('password123'), fullName: 'Reza Maulana', phone: '08144444444',
      roleId: roleChief, divisionId: divEngineering, isActive: true,
      joinDate: new Date('2026-03-01T00:00:00.000Z'),
    },
  });
  console.log('✅ Users created');

  // ── Role coverage: every role gets at least 2 active users ──
  // Roles are dynamic (admin UI), so read them from the DB instead of
  // hardcoding slugs. Names/emails are deterministic dummy data.
  const allRoles = await prisma.role.findMany({ include: { division: true } });
  const divisions = await prisma.division.findMany();
  const usedNames = new Set<string>();
  const extraUsers: typeof admin[] = [];

  for (const role of allRoles) {
    const have = await prisma.user.count({ where: { roleId: role.id, isActive: true } });
    for (let i = have; i < 2; i++) {
      let first = pick(FIRST_NAMES); let last = pick(LAST_NAMES);
      while (usedNames.has(first + last)) { first = pick(FIRST_NAMES); last = pick(LAST_NAMES); }
      usedNames.add(first + last);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@sangroup.id`;
      // joinDate spread: mostly 1–3 years tenure, ~20% under a year so the
      // unpaid-leave tenure rule shows up naturally in the demo.
      const monthsAgo = rng() < 0.2 ? randInt(2, 10) : randInt(13, 40);
      const join = new Date(); join.setUTCMonth(join.getUTCMonth() - monthsAgo); join.setUTCDate(randInt(1, 28));
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email, username: `${first.toLowerCase()}.${last.toLowerCase()}`,
          password: await hash('password123'),
          fullName: `${first} ${last}`,
          phone: `08${randInt(11, 99)}${randInt(1000000, 9999999)}`,
          roleId: role.id,
          divisionId: role.divisionId ?? pick(divisions).id,
          isActive: true,
          joinDate: dateOnly(join.toISOString().slice(0, 10)),
        },
      });
      extraUsers.push(user);
    }
  }
  console.log(`✅ Role coverage: ${extraUsers.length} extra users created (>=2 per role)`);

  // ── Clear previous seed data ───────────────────────────────
  await prisma.notification.deleteMany({});
  await prisma.bulletinReadStatus.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.bulletin.deleteMany({});
  await prisma.stickyNote.deleteMany({});
  await prisma.taskList.deleteMany({});
  await prisma.databaseLink.deleteMany({});
  await prisma.databaseFolder.deleteMany({});
  console.log('✅ Previous seed data cleared');

  // ── Task Lists ─────────────────────────────────────────────
  const listRenovasi = await prisma.taskList.create({
    data: { name: 'Renovasi Tower A', color: '#f97316', icon: null, position: 0, userId: pm.id },
  });
  const listRekrutmen = await prisma.taskList.create({
    data: { name: 'Rekrutmen Q2 2026', color: '#ec4899', icon: null, position: 0, userId: hr.id },
  });
  const listKeuangan = await prisma.taskList.create({
    data: { name: 'Closing Keuangan Juni', color: '#10b981', icon: null, position: 0, userId: finance.id },
  });
  console.log('✅ Task lists created');

  // ── Tasks ──────────────────────────────────────────────────
  // Model personal-first:
  //   visibility : PRIVATE = "Hanya Saya" (default) | DIVISION | PUBLIC
  //   isPrivate  : "Rahasia" — disembunyikan juga dari atasan (tetap dihitung statistik)
  //   myDayDate  : tanggal task masuk My Day (reset harian)
  //   isImportant: flag bintang, independen dari My Day

  // 1) Assignment ACCEPTED + di My Day hari ini + subtasks + link + komentar
  //    Dibagikan ke divisi creator (muncul di All Tasks → Per Divisi → Management)
  const taskAudit = await prisma.task.create({ data: {
    title: 'Audit Laporan Keuangan Q1 2026',
    description: 'Review menyeluruh laporan keuangan Q1 sebelum diserahkan ke owner.\n\n**Fokus:**\n- Neraca\n- Arus kas\n- Laba rugi',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT,
    isImportant: true, myDayDate: jakartaDate(0),
    dueDate: days(0), visibility: TaskVisibility.DIVISION,
    assignmentStatus: AssignmentStatus.ACCEPTED,
    userId: admin.id, assignedToId: finance.id, listId: listKeuangan.id, position: 0,
  }});
  await prisma.task.create({ data: { title: 'Review neraca keuangan', status: TaskStatus.DONE, priority: TaskPriority.HIGH, completedAt: days(-1), userId: finance.id, parentTaskId: taskAudit.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Cek laporan arus kas', status: TaskStatus.DONE, priority: TaskPriority.HIGH, completedAt: days(-1), userId: finance.id, parentTaskId: taskAudit.id, position: 1 }});
  await prisma.task.create({ data: { title: 'Validasi laporan laba rugi', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueDate: days(0), userId: finance.id, parentTaskId: taskAudit.id, position: 2 }});
  await prisma.task.create({ data: { title: 'Presentasi hasil audit ke manajemen', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, dueDate: days(2), userId: finance.id, parentTaskId: taskAudit.id, position: 3 }});
  await prisma.taskLink.create({ data: { url: 'https://docs.google.com/spreadsheets', title: 'Spreadsheet Laporan Q1 2026', taskId: taskAudit.id }});
  await prisma.taskComment.create({ data: { content: 'Data Q1 sudah dikompilasi. Neraca dan arus kas selesai, tinggal laba rugi.', taskId: taskAudit.id, userId: finance.id }});
  await prisma.taskComment.create({ data: { content: 'Pastikan sudah include depresiasi aset Tower B. Jangan sampai kelewat.', taskId: taskAudit.id, userId: admin.id }});

  // 2) Assignment PENDING — banner Accept/Reject di assignee, circle terkunci
  const taskLift = await prisma.task.create({ data: {
    title: 'Koordinasi Pemeliharaan Lift Tower B',
    description: 'Jadwalkan pemeliharaan rutin 3 unit lift Tower B bersama vendor.',
    status: TaskStatus.TODO, priority: TaskPriority.HIGH,
    dueDate: days(1), visibility: TaskVisibility.PRIVATE,
    assignmentStatus: AssignmentStatus.PENDING,
    userId: admin.id, assignedToId: engineer.id, position: 0,
  }});
  await prisma.task.create({ data: { title: 'Hubungi vendor lift untuk jadwal', status: TaskStatus.TODO, priority: TaskPriority.HIGH, userId: engineer.id, parentTaskId: taskLift.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Konfirmasi jadwal ke manajemen gedung', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, userId: engineer.id, parentTaskId: taskLift.id, position: 1 }});

  // 3) Important + My Day sekaligus (sekarang bisa, dua flag independen)
  const taskOnboard = await prisma.task.create({ data: {
    title: 'Onboarding 3 Staff Baru Divisi Property',
    description: 'Persiapkan semua kebutuhan onboarding untuk 3 staff baru yang bergabung tanggal 15 Juni.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH,
    isImportant: true, myDayDate: jakartaDate(0),
    dueDate: days(3), visibility: TaskVisibility.DIVISION,
    assignmentStatus: AssignmentStatus.ACCEPTED,
    userId: admin.id, assignedToId: hr.id, listId: listRekrutmen.id, position: 0,
  }});
  await prisma.task.create({ data: { title: 'Siapkan kontrak kerja dan NDA', status: TaskStatus.DONE, priority: TaskPriority.HIGH, completedAt: days(-1), userId: hr.id, parentTaskId: taskOnboard.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Buat akun email dan akses sistem', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueDate: days(2), userId: hr.id, parentTaskId: taskOnboard.id, position: 1 }});
  await prisma.task.create({ data: { title: 'Jadwalkan sesi orientasi dan tour gedung', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, dueDate: days(3), userId: hr.id, parentTaskId: taskOnboard.id, position: 2 }});
  await prisma.taskComment.create({ data: { content: 'Kontrak sudah ditandatangani ketiganya. Sekarang proses akun sistem.', taskId: taskOnboard.id, userId: hr.id }});

  // 4) Assignment REJECTED — banner merah dengan alasan penolakan di creator
  await prisma.task.create({ data: {
    title: 'Rekap Lembur Karyawan Bulan Mei',
    description: 'Kompilasi data lembur seluruh divisi untuk payroll Juni.',
    status: TaskStatus.TODO, priority: TaskPriority.MEDIUM,
    dueDate: days(2), visibility: TaskVisibility.PRIVATE,
    assignmentStatus: AssignmentStatus.REJECTED,
    assignmentNote: 'Mohon maaf, minggu ini saya full di onboarding staff baru. Usul dialihkan ke tim payroll.',
    userId: admin.id, assignedToId: null, position: 1,
  }});

  // 5) PENDING lintas divisi — director assign ke admin
  await prisma.task.create({ data: {
    title: 'Review Kontrak Sewa Tenant Baru Lantai 12',
    description: 'Tenant baru akan menempati lantai 12 per 1 Juli.',
    status: TaskStatus.TODO, priority: TaskPriority.MEDIUM,
    dueDate: days(5), visibility: TaskVisibility.PRIVATE,
    assignmentStatus: AssignmentStatus.PENDING,
    userId: director.id, assignedToId: admin.id, position: 0,
  }});

  // 6) RAHASIA — isPrivate: tersembunyi dari atasan, tetap dihitung statistik
  await prisma.task.create({ data: {
    title: 'Draft Proyeksi Cash Flow Q3 2026',
    description: 'Masih draft kasar, belum siap dilihat siapapun.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM,
    myDayDate: jakartaDate(0),
    dueDate: days(3), isPrivate: true, visibility: TaskVisibility.PRIVATE,
    userId: finance.id, position: 0,
  }});

  // 7) Task pribadi default ("Hanya Saya") — contoh paling umum
  await prisma.task.create({ data: {
    title: 'Follow up invoice vendor AC',
    status: TaskStatus.TODO, priority: TaskPriority.MEDIUM,
    dueDate: days(1), visibility: TaskVisibility.PRIVATE,
    userId: finance.id, position: 1,
  }});
  await prisma.task.create({ data: {
    title: 'Negosiasi kontrak vendor parkir 2027',
    status: TaskStatus.TODO, priority: TaskPriority.LOW,
    dueDate: days(12), visibility: TaskVisibility.PRIVATE,
    userId: pm.id, position: 2,
  }});

  // 8) Carry-over My Day kemarin yang belum selesai → muncul di panel Suggestions
  await prisma.task.create({ data: {
    title: 'Servis pompa air rooftop Tower A',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH,
    myDayDate: jakartaDate(-1),
    dueDate: days(0), visibility: TaskVisibility.PRIVATE,
    userId: engineer.id, position: 0,
  }});

  // 9) Overdue + Important → muncul di Suggestions, bucket Overdue, dan calendar merah
  await prisma.task.create({ data: {
    title: 'Kirim Laporan Utilitas ke Owner',
    description: 'Laporan konsumsi listrik, air, dan gas bulan Mei 2026.',
    status: TaskStatus.TODO, priority: TaskPriority.URGENT,
    isImportant: true,
    dueDate: days(-2), visibility: TaskVisibility.PRIVATE,
    userId: admin.id, position: 3,
  }});

  // 10) PUBLIC — muncul di All Tasks → Semua Staff untuk seluruh karyawan
  await prisma.task.create({ data: {
    title: 'Pengumpulan Data BPJS Seluruh Karyawan',
    description: 'Seluruh karyawan harap submit data BPJS terbaru ke HR sebelum 20 Juni.\n\nForm: [Link Google Form](https://forms.google.com)',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH,
    dueDate: days(8), visibility: TaskVisibility.PUBLIC,
    userId: hr.id, position: 1,
  }});
  await prisma.task.create({ data: {
    title: 'Sosialisasi Sistem Internal SAN Group',
    description: 'Demo penggunaan task management, bulletin, dan database link ke semua divisi.',
    status: TaskStatus.DONE, priority: TaskPriority.MEDIUM,
    completedAt: days(-3),
    visibility: TaskVisibility.PUBLIC,
    userId: admin.id, position: 4,
  }});

  // 11) DIVISION — proyek renovasi milik PM, dibagikan ke divisi Property
  await prisma.task.create({ data: {
    title: 'Update SOP Prosedur Evakuasi Darurat',
    status: TaskStatus.DONE, priority: TaskPriority.MEDIUM,
    completedAt: days(-2), visibility: TaskVisibility.DIVISION,
    userId: pm.id, listId: listRenovasi.id, position: 0,
  }});
  const taskCat = await prisma.task.create({ data: {
    title: 'Pengecatan Ulang Lobby dan Koridor Tower A',
    description: 'Pengecatan ulang area lobby lantai 1 dan koridor lantai 2-5.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM,
    dueDate: days(6), visibility: TaskVisibility.DIVISION,
    assignmentStatus: AssignmentStatus.ACCEPTED,
    userId: pm.id, assignedToId: engineer.id, listId: listRenovasi.id, position: 1,
  }});
  await prisma.task.create({ data: { title: 'Finalisasi pilihan warna dengan manajemen', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, completedAt: days(-1), userId: engineer.id, parentTaskId: taskCat.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Pembelian material cat dan alat', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, dueDate: days(1), userId: engineer.id, parentTaskId: taskCat.id, position: 1 }});
  await prisma.task.create({ data: { title: 'Pelaksanaan pengecatan', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, dueDate: days(5), userId: engineer.id, parentTaskId: taskCat.id, position: 2 }});
  // Historical tasks: months of completed work so statistics, calendar, and
  // the work-duration report have data. (Dates rely on helpers defined above;
  // history window matches the HRIS attendance window further below.)
  const TASK_TITLES = [
    'Rekonsiliasi rekening operasional bulan lalu', 'Update database kontak vendor',
    'Inspeksi rutin APAR seluruh lantai', 'Perpanjangan polis asuransi gedung',
    'Review draft kontrak vendor cleaning', 'Input data meteran listrik & air bulanan',
    'Follow up piutang tenant lantai 8', 'Persiapan dokumen audit internal',
    'Pembaruan data karyawan di sistem BPJS', 'Evaluasi vendor keamanan triwulan',
    'Penyusunan jadwal maintenance preventif', 'Rekap pengeluaran petty cash mingguan',
    'Koordinasi perbaikan area parkir motor', 'Sosialisasi jalur evakuasi ke tenant baru',
    'Pengecekan stok ATK dan pengadaan ulang', 'Update SOP penerimaan tamu lobby',
    'Verifikasi tagihan vendor lift bulan lalu', 'Persiapan meeting bulanan dengan owner',
    'Penataan arsip kontrak tenant 2025', 'Kalibrasi timbangan loading dock',
    'Pelaporan pajak PPh 21 bulanan', 'Screening kandidat staff engineering',
    'Perbaikan minor furniture ruang meeting', 'Pembuatan laporan okupansi bulanan',
  ];
  {
    const now7t = new Date(Date.now() + 7 * 3_600_000);
    const tStart = new Date(Date.UTC(now7t.getUTCFullYear(), now7t.getUTCMonth() - 3, 1));
    const totalDays = Math.floor((Date.now() - tStart.getTime()) / 86_400_000);
    const everyone = [admin, director, pm, hr, finance, engineer, ...extraUsers];
    for (const [i, title] of TASK_TITLES.entries()) {
      const owner = everyone[Math.floor(rng() * everyone.length)];
      const createdOffset = randInt(3, totalDays - 1);
      const created = new Date(Date.now() - createdOffset * 86_400_000);
      const done = rng() < 0.8;
      const started = new Date(created.getTime() + randInt(2, 24) * 3_600_000);
      const completed = new Date(started.getTime() + randInt(4, 72) * 3_600_000);
      await prisma.task.create({ data: {
        title,
        status: done ? TaskStatus.DONE : rng() < 0.5 ? TaskStatus.IN_PROGRESS : TaskStatus.TODO,
        priority: [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.MEDIUM, TaskPriority.HIGH][randInt(0, 3)],
        visibility: rng() < 0.3 ? TaskVisibility.DIVISION : TaskVisibility.PRIVATE,
        userId: owner.id,
        position: 10 + i,
        createdAt: created,
        startedAt: done || rng() < 0.5 ? started : null,
        completedAt: done ? completed : null,
        dueDate: done ? completed : days(randInt(1, 10)),
      }});
    }
    console.log(`✅ Historical tasks created (${TASK_TITLES.length})`);
  }
  console.log('✅ Tasks, subtasks, links & comments created');

  // ── Sticky Notes ───────────────────────────────────────────
  await prisma.stickyNote.createMany({ data: [
    { title: 'Meeting Owner — Rabu', content: 'Rabu 10 Juni, 15:00 di ruang direksi.\nAgenda: Progress Q2, rencana renovasi, update rekrutmen.', color: 'yellow', isPinned: true, position: 0, userId: admin.id },
    { title: 'Kontak Darurat PLN', content: 'PLN Icon+ 24 jam: 123\nEmail: iconpln-jakarta@pln.co.id\nNo. Pelanggan: 542-1000-0001', color: 'blue', isPinned: true, position: 1, userId: admin.id },
    { title: null, content: 'Perpanjang kontrak vendor security — jatuh tempo 30 Juni 2026.', color: 'pink', isPinned: false, position: 2, userId: admin.id },
    { title: 'Kontak Vendor Lift', content: 'Schindler Indonesia\nTelp: 021-5500-1234\nPIC: Pak Hendra', color: 'green', isPinned: false, position: 0, userId: pm.id },
    { title: 'Checklist Akhir Bulan', content: '- Laporan utilitas (tgl 25)\n- Rekap absensi (tgl 27)\n- Review invoice vendor (tgl 28)', color: 'purple', isPinned: true, position: 3, userId: admin.id },
    { title: null, content: 'Target Q2: reduce biaya operasional 10% vs Q1.', color: 'orange', isPinned: false, position: 1, userId: finance.id },
  ]});
  console.log('✅ Sticky notes created');

  // ── Bulletins ──────────────────────────────────────────────
  const bulletinHoliday = await prisma.bulletin.create({ data: {
    title: 'Libur Nasional — Hari Raya Idul Adha 1447 H',
    content: 'Diberitahukan kepada seluruh karyawan SAN Group bahwa perusahaan akan libur pada hari Senin, 9 Juni 2026 dalam rangka Hari Raya Idul Adha 1447 H. Operasional kantor kembali normal pada Selasa, 10 Juni 2026.',
    category: BulletinCategory.HOLIDAY, priority: BulletinPriority.IMPORTANT,
    isPublished: true, publishedAt: days(-3), expiresAt: days(4),
    authorId: admin.id,
  }});

  const bulletinMaint = await prisma.bulletin.create({ data: {
    title: 'Pemeliharaan Lift Tower A — Sabtu 7 Juni 2026',
    content: 'Tim engineering akan melaksanakan pemeliharaan rutin tahunan pada 3 unit lift Tower A. Jadwal: Sabtu, 7 Juni 2026 pukul 07.00 hingga 14.00 WIB.',
    category: BulletinCategory.MAINTENANCE, priority: BulletinPriority.URGENT,
    isPublished: true, publishedAt: days(-5), expiresAt: days(1),
    authorId: pm.id,
  }});

  await prisma.bulletin.create({ data: {
    title: 'SAN Group Internal System — Resmi Diluncurkan',
    content: 'Dengan bangga kami memperkenalkan SAN Group Internal Management System. Fitur: Task Management, Bulletin Board, Sticky Notes, Database Links.',
    category: BulletinCategory.ANNOUNCEMENT, priority: BulletinPriority.NORMAL,
    isPublished: true, publishedAt: days(-7), expiresAt: null,
    authorId: admin.id,
  }});

  await prisma.bulletin.create({ data: {
    title: 'Pembaruan Kebijakan Absensi Per 1 Juli 2026',
    content: 'Mulai 1 Juli 2026, berlaku kebijakan absensi yang diperbarui. Check-in maksimal pukul 08.30 WIB. WFH diperbolehkan maksimal 2 hari per minggu.',
    category: BulletinCategory.ANNOUNCEMENT, priority: BulletinPriority.IMPORTANT,
    isPublished: true, publishedAt: days(-1), expiresAt: null,
    authorId: hr.id,
  }});
  // Historical bulletins across previous months.
  const OLD_BULLETINS: [string, string, BulletinCategory, BulletinPriority, number][] = [
    ['Hasil Fogging Area Gedung — Terima Kasih atas Kerjasamanya', 'Fogging seluruh area gedung telah selesai dilaksanakan Sabtu kemarin. Terima kasih atas kerjasama seluruh tenant dan karyawan.', BulletinCategory.MAINTENANCE, BulletinPriority.NORMAL, -20],
    ['Pemadaman Listrik PLN Terjadwal — Genset Standby', 'PLN akan melakukan pemeliharaan jaringan. Genset gedung akan otomatis mengambil alih. Simpan pekerjaan Anda secara berkala.', BulletinCategory.MAINTENANCE, BulletinPriority.URGENT, -35],
    ['Pembagian THR dan Jadwal Cuti Bersama', 'THR akan dibayarkan H-10. Cuti bersama mengikuti keputusan pemerintah — cek kalender HRIS untuk detail tanggal.', BulletinCategory.ANNOUNCEMENT, BulletinPriority.IMPORTANT, -50],
    ['Uji Coba Alarm Kebakaran Tahunan', 'Uji coba sistem alarm kebakaran akan dilakukan Jumat pukul 10.00. Tidak perlu evakuasi — ini hanya pengujian.', BulletinCategory.MAINTENANCE, BulletinPriority.IMPORTANT, -60],
    ['Program Medical Check-Up Karyawan 2026', 'MCU tahunan bekerjasama dengan RS Premier. Jadwal per divisi menyusul dari HR. Fasilitas ditanggung perusahaan.', BulletinCategory.ANNOUNCEMENT, BulletinPriority.NORMAL, -75],
    ['Renovasi Lobby Tower A Dimulai', 'Renovasi lobby dimulai bulan ini, akses masuk sementara dialihkan ke pintu samping. Mohon maaf atas ketidaknyamanannya.', BulletinCategory.ANNOUNCEMENT, BulletinPriority.IMPORTANT, -85],
  ];
  for (const [title, content, category, priority, offset] of OLD_BULLETINS) {
    await prisma.bulletin.create({ data: {
      title, content, category, priority,
      isPublished: true, publishedAt: days(offset), expiresAt: days(offset + 14),
      authorId: pick([admin, hr, pm]).id,
      createdAt: days(offset),
    }});
  }
  console.log('✅ Bulletins created');

  // ── Read status ────────────────────────────────────────────
  await prisma.bulletinReadStatus.createMany({ data: [
    { bulletinId: bulletinHoliday.id, userId: admin.id },
    { bulletinId: bulletinHoliday.id, userId: hr.id },
    { bulletinId: bulletinMaint.id,   userId: admin.id },
    { bulletinId: bulletinMaint.id,   userId: engineer.id },
  ]});
  console.log('✅ Bulletin read statuses created');

  // ── Database Folders & Links ───────────────────────────────
  const folderHR = await prisma.databaseFolder.create({
    data: { name: 'HR & People', icon: null, color: '#ec4899', position: 0, createdById: admin.id },
  });
  const folderFinance = await prisma.databaseFolder.create({
    data: { name: 'Finance', icon: null, color: '#10b981', position: 1, createdById: admin.id },
  });
  const folderProperty = await prisma.databaseFolder.create({
    data: { name: 'Property & Operasional', icon: null, color: '#3b82f6', position: 2, createdById: admin.id },
  });
  const folderLegal = await prisma.databaseFolder.create({
    data: { name: 'Legal & Perizinan', icon: null, color: '#8b5cf6', position: 3, createdById: admin.id },
  });
  const folderMgmt = await prisma.databaseFolder.create({
    data: { name: 'Manajemen', icon: null, color: '#6366f1', position: 4, createdById: admin.id },
  });

  await prisma.databaseLink.createMany({ data: [
    { title: 'Google Drive HR',             url: 'https://drive.google.com',                description: 'Folder utama dokumen HR',                   folderId: folderHR.id,       position: 0, createdById: admin.id },
    { title: 'BPJS Ketenagakerjaan Online', url: 'https://sso.bpjsketenagakerjaan.go.id', description: 'Portal BPJS karyawan',                       folderId: folderHR.id,       position: 1, createdById: admin.id },
    { title: 'Payroll & Slip Gaji',         url: 'https://drive.google.com',                description: 'Rekap gaji dan slip bulanan',                folderId: folderHR.id,       position: 2, createdById: hr.id    },
    { title: 'Accurate Online',             url: 'https://accurate.id',                     description: 'Software akuntansi utama',                   folderId: folderFinance.id,  position: 0, createdById: admin.id },
    { title: 'KlikBCA Corporate',           url: 'https://klikbca.com',                     description: 'Internet banking rekening operasional',       folderId: folderFinance.id,  position: 1, createdById: admin.id },
    { title: 'E-Filing DJP Online',         url: 'https://djponline.pajak.go.id',           description: 'Pelaporan pajak perusahaan',                  folderId: folderFinance.id,  position: 2, createdById: finance.id },
    { title: 'SOP Operasional Gedung',      url: 'https://drive.google.com',                description: 'Kumpulan SOP teknis dan prosedur operasional', folderId: folderProperty.id, position: 0, createdById: pm.id    },
    { title: 'CCTV Monitoring',             url: 'http://192.168.1.100',                    description: 'Dashboard remote monitoring CCTV',             folderId: folderProperty.id, position: 1, createdById: pm.id    },
    { title: 'Portal PLN Icon+',            url: 'https://iconpln.co.id',                   description: 'Monitoring tagihan listrik gedung',             folderId: folderProperty.id, position: 2, createdById: engineer.id },
    { title: 'SIMBG — Izin Bangunan',       url: 'https://simbg.pu.go.id',                 description: 'Sistem Informasi Manajemen Bangunan Gedung',   folderId: folderLegal.id,    position: 0, createdById: admin.id },
    { title: 'OSS — Perizinan Berusaha',    url: 'https://oss.go.id',                       description: 'Portal perizinan usaha online pemerintah',     folderId: folderLegal.id,    position: 1, createdById: admin.id },
    { title: 'Looker Studio Dashboard',     url: 'https://lookerstudio.google.com',         description: 'Laporan kinerja operasional bulanan',           folderId: folderMgmt.id,     position: 0, createdById: admin.id },
    { title: 'Google Workspace Admin',      url: 'https://admin.google.com',                description: 'Kelola akun email dan akses G Suite',           folderId: folderMgmt.id,     position: 1, createdById: admin.id },
  ]});
  console.log('✅ Database folders & links created');

  // ── HRIS ───────────────────────────────────────────────────
  await prisma.compOffGrant.deleteMany({});
  await prisma.shiftChangeRequest.deleteMany({});
  await prisma.lateExcuseRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.officeLocation.deleteMany({});
  await prisma.shift.deleteMany({});

  // Shifts
  // Kebijakan client: jam kerja 09:00–18:00
  const shiftOffice = await prisma.shift.create({ data: { name: 'Office Staff', startTime: '09:00', endTime: '18:00', lateThresholdMinutes: 0, isDefault: true, color: '#3b82f6' } });
  await prisma.shift.create({ data: { name: 'Security', startTime: '07:00', endTime: '19:00', lateThresholdMinutes: 0, color: '#ef4444' } });
  await prisma.shift.create({ data: { name: 'Shift Siang', startTime: '12:00', endTime: '21:00', lateThresholdMinutes: 0, color: '#f59e0b' } });

  // Office Locations
  const locHead = await prisma.officeLocation.create({ data: { name: 'Head Office - Jakarta', address: 'Jakarta Selatan', lat: -6.2297, lng: 106.8295, radiusMeters: 150 } });
  await prisma.officeLocation.create({ data: { name: 'Site - Properti A', address: 'Tangerang Selatan', lat: -6.3297, lng: 106.7295, radiusMeters: 200 } });

  // Everyone in the demo — the 6 named logins plus the role-coverage users.
  // Read from the DB so re-runs (where upsert skips creation) still cover all.
  const staff = await prisma.user.findMany({ where: { isActive: true } });

  // Assign shifts: mostly office, a few on Security / Shift Siang for variety.
  const shiftSecurity = await prisma.shift.findFirst({ where: { name: 'Security' } });
  const shiftSiang    = await prisma.shift.findFirst({ where: { name: 'Shift Siang' } });
  const shiftOf = new Map<string, { id: string; startH: number }>();
  for (let i = 0; i < staff.length; i++) {
    const shift = i >= staff.length - 2 && shiftSecurity ? shiftSecurity
                : i >= staff.length - 4 && shiftSiang    ? shiftSiang
                : shiftOffice;
    shiftOf.set(staff[i].id, { id: shift.id, startH: Number(shift.startTime.split(':')[0]) });
    await prisma.user.update({ where: { id: staff[i].id }, data: { shiftId: shift.id } });
  }
  console.log('✅ Shifts & office locations created');

  // Fixed-date national holidays (movable ones — Idul Fitri, Nyepi, Waisak,
  // etc. — must be entered yearly by HR via the Holidays admin page).
  const seedYear = new Date().getFullYear();
  const FIXED_HOLIDAYS: [number, number, string][] = [
    [1, 1,   "New Year's Day"],
    [5, 1,   'Labour Day'],
    [6, 1,   'Pancasila Day'],
    [8, 17,  'Independence Day'],
    [12, 25, 'Christmas Day'],
  ];
  for (const [m, d, name] of FIXED_HOLIDAYS) {
    await prisma.holiday.create({
      data: { date: new Date(Date.UTC(seedYear, m - 1, d)), name },
    });
  }
  console.log('✅ Fixed-date holidays created');

  // Leave types
  // Kebijakan client: kuota 12/tahun, carry-over hangus akhir Maret, kuota aktif setelah 1 tahun kerja
  const ltAnnual = await prisma.leaveType.create({ data: { name: 'Annual Leave',    slug: 'ANNUAL',      color: '#6366f1', maxDaysPerYear: 12, isPaid: true, requiresDoc: false, allowCarryOver: true, tenureMonthsRequired: 12, position: 0 } });
  // Sakit > 1 hari wajib surat dokter
  const ltSick   = await prisma.leaveType.create({ data: { name: 'Sick Leave',      slug: 'SICK',        color: '#ef4444', maxDaysPerYear: 0,  isPaid: true, requiresDoc: true, requiresDocAfterDays: 1, position: 1 } });
  const ltEmerg  = await prisma.leaveType.create({ data: { name: 'Emergency Leave', slug: 'EMERGENCY',   color: '#f97316', maxDaysPerYear: 3,  isPaid: true, requiresDoc: false, position: 2 } });
  const ltWFH    = await prisma.leaveType.create({ data: { name: 'WFH Special',     slug: 'WFH_SPECIAL', color: '#3b82f6', maxDaysPerYear: 6,  isPaid: true, requiresDoc: false, position: 3 } });
  // Cuti resmi/pemerintah (nikah dll) — selalu wajib lampiran pendukung
  await prisma.leaveType.create({ data: { name: 'Special Leave',    slug: 'SPECIAL',     color: '#8b5cf6', maxDaysPerYear: 0,  isPaid: true, requiresDoc: true, requiresDocAfterDays: 0, position: 4 } });
  // Ganti off — saldo dari grant HRD (kerja weekend/tanggal merah), bukan kuota tahunan
  await prisma.leaveType.create({ data: { name: 'Comp Off',         slug: 'COMP_OFF',    color: '#10b981', maxDaysPerYear: 0,  isPaid: true, requiresDoc: false, earnedBalance: true, position: 5 } });

  // ── Demo history window: first day of month, 3 months back → today ──
  const todayStr  = jktDateStr(new Date());
  const seedYr    = Number(todayStr.slice(0, 4));
  const now7      = new Date(Date.now() + 7 * 3_600_000);
  const histStart = new Date(Date.UTC(now7.getUTCFullYear(), now7.getUTCMonth() - 3, 1));
  const holidaySet = new Set(
    (await prisma.holiday.findMany()).map((h) => h.date.toISOString().slice(0, 10)),
  );
  const isWorkday = (s: string) => {
    const d = dateOnly(s).getUTCDay();
    return d !== 0 && d !== 6 && !holidaySet.has(s);
  };
  const addDays = (s: string, n: number) => {
    const d = dateOnly(s); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  /** n-th workday on/after s. */
  const nextWorkday = (s: string) => { let d = s; while (!isWorkday(d)) d = addDays(d, 1); return d; };
  const listWorkdays = (from: string, to: string) => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d)) out.push(d);
    return out;
  };
  const histWorkdays = listWorkdays(histStart.toISOString().slice(0, 10), todayStr);

  // ── Leave requests: months of history, every status ────────
  const reviewers = [admin, hr];
  const leaveOnDate = new Map<string, string>(); // `${userId}|${date}` → leave type name
  const used    = new Map<string, number>();     // `${userId}|${typeId}` → approved days
  const pending = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);

  const LEAVE_REASONS: Record<string, string[]> = {
    ANNUAL:      ['Liburan keluarga ke Bali.', 'Acara pernikahan saudara di luar kota.', 'Keperluan keluarga.', 'Mengurus dokumen penting di kampung halaman.', 'Refreshing setelah project selesai.'],
    SICK:        ['Demam dan flu, sudah periksa ke dokter.', 'Sakit maag kambuh, istirahat sesuai anjuran dokter.', 'Migrain berat.', 'Tipes, perlu rawat jalan.'],
    EMERGENCY:   ['Orang tua masuk rumah sakit mendadak.', 'Banjir di rumah, perlu evakuasi barang.', 'Kecelakaan ringan, mengurus asuransi.'],
    WFH_SPECIAL: ['Menunggu kedatangan teknisi internet di rumah.', 'Anak sakit, kerja dari rumah sambil menjaga.', 'Cuaca ekstrem, jalan banjir.'],
    SPECIAL:     ['Menikah — sesuai kebijakan cuti resmi.', 'Istri melahirkan.', 'Keluarga inti meninggal dunia.'],
  };
  const typeBySlug = { ANNUAL: ltAnnual, SICK: ltSick, EMERGENCY: ltEmerg, WFH_SPECIAL: ltWFH } as const;
  const ltSpecial = await prisma.leaveType.findUnique({ where: { slug: 'SPECIAL' } });
  const ltCompOff = await prisma.leaveType.findUnique({ where: { slug: 'COMP_OFF' } });

  const leaveRows: object[] = [];
  const monthsSince = (d: Date | null, ref: Date) =>
    d ? (ref.getUTCFullYear() - d.getUTCFullYear()) * 12 + (ref.getUTCMonth() - d.getUTCMonth()) : 999;

  for (const u of staff) {
    const howMany = rng() < 0.35 ? 2 : rng() < 0.85 ? 1 : 0;
    for (let i = 0; i < howMany; i++) {
      const roll = rng();
      const slug = roll < 0.45 ? 'ANNUAL' : roll < 0.65 ? 'SICK' : roll < 0.75 ? 'EMERGENCY' : roll < 0.92 ? 'WFH_SPECIAL' : 'SPECIAL';
      const lt   = slug === 'SPECIAL' ? ltSpecial! : typeBySlug[slug as keyof typeof typeBySlug];
      const startIdx = randInt(0, Math.max(0, histWorkdays.length - 12));
      const start = histWorkdays[startIdx];
      const dur   = slug === 'EMERGENCY' || slug === 'WFH_SPECIAL' ? 1 : randInt(1, 3);
      const wdays = listWorkdays(start, addDays(start, dur + 3)).slice(0, dur);
      const end   = wdays[wdays.length - 1];
      if (wdays.some((d) => leaveOnDate.has(`${u.id}|${d}`)) || end >= todayStr) continue;

      const sRoll  = rng();
      const status = sRoll < 0.72 ? LeaveStatus.APPROVED : sRoll < 0.86 ? LeaveStatus.REJECTED : LeaveStatus.CANCELLED;
      const reviewer = pick(reviewers);
      const isUnpaid = slug === 'ANNUAL' && monthsSince(u.joinDate, dateOnly(start)) < 12;
      const needsDoc = slug === 'SPECIAL' || (slug === 'SICK' && dur > 1);

      leaveRows.push({
        userId: u.id, leaveTypeId: lt.id,
        startDate: dateOnly(start), endDate: dateOnly(end), totalDays: dur,
        reason: pick(LEAVE_REASONS[slug]),
        status, isUnpaid,
        attachmentUrl:  needsDoc ? `https://picsum.photos/seed/leave-${leaveRows.length}/800/1100` : null,
        attachmentName: needsDoc ? (slug === 'SICK' ? 'surat-dokter.jpg' : 'dokumen-pendukung.jpg') : null,
        reviewedById: status === LeaveStatus.CANCELLED ? null : reviewer.id,
        reviewedAt:   status === LeaveStatus.CANCELLED ? null : atWIB(addDays(start, -randInt(1, 3)), randInt(9, 17), randInt(0, 59)),
        reviewNote:   status === LeaveStatus.REJECTED ? pick(['Beban kerja tim sedang tinggi, mohon jadwalkan ulang.', 'Bentrok dengan deadline project, coba minggu berikutnya.', 'Kuota tim yang cuti minggu itu sudah penuh.']) : null,
        createdAt: atWIB(addDays(start, -randInt(3, 10)), randInt(8, 17), randInt(0, 59)),
      });
      if (status === LeaveStatus.APPROVED) {
        wdays.forEach((d) => leaveOnDate.set(`${u.id}|${d}`, lt.name));
        if (!isUnpaid && (lt.maxDaysPerYear > 0)) bump(used, `${u.id}|${lt.id}`, dur);
      }
    }
  }

  // A few PENDING requests in the near future so reviewers see a queue.
  const pendingSeed: [typeof admin, typeof ltAnnual, number, string][] = [
    [engineer,      ltAnnual, 3, 'Pernikahan adik di Yogyakarta.'],
    [pm,            ltEmerg,  1, 'Orang tua masuk rumah sakit mendadak.'],
    [extraUsers[2] ?? finance, ltAnnual, 2, 'Liburan keluarga akhir bulan.'],
    [extraUsers[5] ?? hr,      ltWFH,    1, 'Menunggu renovasi rumah selesai.'],
  ];
  for (const [u, lt, dur, reason] of pendingSeed) {
    const start = nextWorkday(addDays(todayStr, randInt(2, 8)));
    const wdays = listWorkdays(start, addDays(start, dur + 3)).slice(0, dur);
    leaveRows.push({
      userId: u.id, leaveTypeId: lt.id,
      startDate: dateOnly(start), endDate: dateOnly(wdays[wdays.length - 1]), totalDays: dur,
      reason, status: LeaveStatus.PENDING,
      createdAt: atWIB(todayStr, 8, randInt(0, 45)),
    });
    if (lt.maxDaysPerYear > 0) bump(pending, `${u.id}|${lt.id}`, dur);
  }
  await prisma.leaveRequest.createMany({ data: leaveRows as never });

  // ── Comp-off: HR grants + one consumed request ──────────────
  const compOffTargets = [engineer, extraUsers[0] ?? pm, extraUsers[7] ?? finance];
  const compOffGranted = new Map<string, number>();
  for (const [i, target] of compOffTargets.entries()) {
    const daysGranted = randInt(1, 2);
    await prisma.compOffGrant.create({ data: {
      userId: target.id, days: daysGranted,
      reason: pick(['Lembur persiapan acara 17 Agustus di gedung.', 'Kerja weekend saat maintenance listrik total.', 'Standby saat tanggal merah untuk kunjungan owner.']),
      grantedById: hr.id,
      createdAt: atWIB(histWorkdays[randInt(10, 30)] ?? todayStr, randInt(9, 17), 0),
    }});
    bump(compOffGranted, target.id, daysGranted);
    // First grantee already used 1 day of it (APPROVED history).
    if (i === 0 && ltCompOff) {
      const start = histWorkdays[Math.floor(histWorkdays.length * 0.7)];
      await prisma.leaveRequest.create({ data: {
        userId: target.id, leaveTypeId: ltCompOff.id,
        startDate: dateOnly(start), endDate: dateOnly(start), totalDays: 1,
        reason: 'Pakai ganti off dari kerja weekend kemarin.',
        status: LeaveStatus.APPROVED,
        reviewedById: hr.id, reviewedAt: atWIB(addDays(start, -1), 14, 0),
        createdAt: atWIB(addDays(start, -2), 10, 0),
      }});
      leaveOnDate.set(`${target.id}|${start}`, 'Comp Off');
      bump(used, `${target.id}|${ltCompOff.id}`, 1);
    }
  }

  // ── Balances for everyone, consistent with the requests above ──
  const balanceRows: object[] = [];
  for (const u of staff) {
    for (const lt of [ltAnnual, ltEmerg, ltWFH]) {
      balanceRows.push({
        userId: u.id, leaveTypeId: lt.id, year: seedYr,
        totalDays: lt.maxDaysPerYear,
        usedDays:  used.get(`${u.id}|${lt.id}`) ?? 0,
        pendingDays: pending.get(`${u.id}|${lt.id}`) ?? 0,
      });
    }
    if (ltCompOff && compOffGranted.has(u.id)) {
      balanceRows.push({
        userId: u.id, leaveTypeId: ltCompOff.id, year: seedYr,
        totalDays: compOffGranted.get(u.id)!,
        usedDays:  used.get(`${u.id}|${ltCompOff.id}`) ?? 0,
        pendingDays: 0,
      });
    }
  }
  await prisma.leaveBalance.createMany({ data: balanceRows as never });
  console.log(`✅ HRIS leave: ${leaveRows.length} requests, ${balanceRows.length} balances, ${compOffTargets.length} comp-off grants`);

  // ── Shift change requests: all statuses ────────────────────
  if (shiftSiang && shiftSecurity) {
    const scSeed = [
      { u: extraUsers[1] ?? engineer, shift: shiftSiang,    status: 'APPROVED',  note: 'Disetujui, efektif minggu depan.' },
      { u: extraUsers[3] ?? pm,       shift: shiftSecurity, status: 'REJECTED',  note: 'Formasi security sudah penuh bulan ini.' },
      { u: extraUsers[4] ?? finance,  shift: shiftSiang,    status: 'PENDING',   note: null },
      { u: extraUsers[6] ?? hr,       shift: shiftSiang,    status: 'CANCELLED', note: null },
    ] as const;
    for (const [i, sc] of scSeed.entries()) {
      const reviewed = sc.status === 'APPROVED' || sc.status === 'REJECTED';
      await prisma.shiftChangeRequest.create({ data: {
        userId: sc.u.id, requestedShiftId: sc.shift.id,
        effectiveDate: dateOnly(sc.status === 'PENDING' ? nextWorkday(addDays(todayStr, 7)) : histWorkdays[20 + i * 5] ?? todayStr),
        reason: pick(['Jadwal antar-jemput anak sekolah berubah.', 'Menyesuaikan jadwal kuliah malam.', 'Rotasi tugas tim.', 'Kondisi kesehatan, disarankan dokter kerja siang.']),
        status: sc.status as never,
        reviewNote: sc.note,
        reviewedById: reviewed ? hr.id : null,
        reviewedAt:   reviewed ? atWIB(histWorkdays[22 + i * 5] ?? todayStr, 15, 0) : null,
      }});
    }
  }

  // ── Late excuses: approved (neutralised), pending, rejected ──
  const lateExcuseDay = histWorkdays[histWorkdays.length - 4] ?? todayStr;
  await prisma.lateExcuseRequest.create({ data: {
    userId: engineer.id, date: dateOnly(lateExcuseDay), expectedTime: '10:30',
    reason: 'Antar orang tua kontrol rutin ke rumah sakit pagi.',
    status: 'APPROVED', reviewedById: hr.id, reviewedAt: atWIB(addDays(lateExcuseDay, -1), 16, 20),
    createdAt: atWIB(addDays(lateExcuseDay, -1), 15, 45),
  }});
  await prisma.lateExcuseRequest.create({ data: {
    userId: extraUsers[8]?.id ?? pm.id, date: dateOnly(histWorkdays[histWorkdays.length - 8] ?? todayStr), expectedTime: '09:45',
    reason: 'Ban mobil bocor di tol.',
    status: 'APPROVED', reviewedById: admin.id, reviewedAt: atWIB(histWorkdays[histWorkdays.length - 8] ?? todayStr, 7, 30),
  }});
  await prisma.lateExcuseRequest.create({ data: {
    userId: extraUsers[9]?.id ?? finance.id, date: dateOnly(nextWorkday(addDays(todayStr, 1))), expectedTime: '10:00',
    reason: 'Jadwal vaksin anak pagi hari.',
    status: 'PENDING', createdAt: atWIB(todayStr, 9, 10),
  }});
  await prisma.lateExcuseRequest.create({ data: {
    userId: extraUsers[10]?.id ?? director.id, date: dateOnly(histWorkdays[histWorkdays.length - 6] ?? todayStr), expectedTime: '11:00',
    reason: 'Urusan pribadi.',
    status: 'REJECTED', reviewNote: 'Alasan kurang jelas, mohon detailkan.',
    reviewedById: hr.id, reviewedAt: atWIB(histWorkdays[histWorkdays.length - 7] ?? todayStr, 17, 0),
  }});
  console.log('✅ HRIS shift changes & late excuses created');

  // ── Attendance: full history for every workday in the window ──
  const OUT_OF_AREA_REASONS = ['Kunjungan tenant di site Properti A.', 'Meeting dengan vendor di kantor mereka.', 'Survey lokasi untuk project baru.', 'Ambil dokumen di notaris.'];
  const attendanceRows: object[] = [];
  let photoCounter = 0;
  const recentCutoff = addDays(todayStr, -14);

  for (const day of histWorkdays) {
    const isToday = day === todayStr;
    for (const u of staff) {
      const shift = shiftOf.get(u.id)!;

      // Approved leave that day → PERMISSION record, no check-in.
      const leaveName = leaveOnDate.get(`${u.id}|${day}`);
      if (leaveName) {
        attendanceRows.push({
          userId: u.id, date: dateOnly(day),
          status: AttendanceStatus.PERMISSION, isLate: false, lateMinutes: 0,
          note: leaveName, shiftId: shift.id,
        });
        continue;
      }

      // Today: ~15% haven't shown up yet (no record at all).
      if (isToday && rng() < 0.15) continue;

      const roll = rng();
      if (!isToday && roll < 0.02) {
        attendanceRows.push({
          userId: u.id, date: dateOnly(day),
          status: AttendanceStatus.ABSENT, isLate: false, lateMinutes: 0, shiftId: shift.id,
        });
        continue;
      }

      const isWFH  = roll >= 0.02 && roll < 0.07;
      const isLate = !isWFH && rng() < 0.15;
      const lateMinutes = isLate ? randInt(5, 75) : 0;
      const inMin  = isLate ? lateMinutes : -randInt(2, 25); // minutes relative to shift start
      const checkIn = atWIB(day, shift.startH, 0);
      checkIn.setUTCMinutes(checkIn.getUTCMinutes() + inMin);

      const hasCheckedOut = !isToday;
      const checkOut = new Date(checkIn.getTime() + (9 * 60 + randInt(-20, 50)) * 60_000);
      const workMinutes = hasCheckedOut ? Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000) : null;

      const outOfArea = !isWFH && rng() < 0.03;
      const includePhoto = !isWFH && day >= recentCutoff;

      attendanceRows.push({
        userId: u.id, date: dateOnly(day),
        checkIn, checkOut: hasCheckedOut ? checkOut : null,
        status: isWFH ? AttendanceStatus.WFH : isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        isLate, lateMinutes, workMinutes,
        note: isWFH ? 'WFH' : null,
        lat: isWFH ? null : locHead.lat + (rng() - 0.5) * (outOfArea ? 0.05 : 0.001),
        lng: isWFH ? null : locHead.lng + (rng() - 0.5) * (outOfArea ? 0.05 : 0.001),
        locationName: isWFH ? null : outOfArea ? 'Jl. BSD Raya, Serpong, Tangerang Selatan' : 'Head Office - Jakarta',
        isOutOfArea: outOfArea,
        outOfAreaReason: outOfArea ? pick(OUT_OF_AREA_REASONS) : null,
        officeLocationId: isWFH || outOfArea ? null : locHead.id,
        photoUrl: includePhoto ? `https://i.pravatar.cc/300?u=${u.id.slice(0, 8)}-${photoCounter++}` : null,
        shiftId: shift.id,
      });
    }
  }
  // The engineer's approved late excuse: that day he came at 10:20 but is NOT
  // flagged late (excuse neutralises it) — matches the service behaviour.
  const excuseIdx = attendanceRows.findIndex(
    (r: any) => r.userId === engineer.id && r.date.toISOString().slice(0, 10) === lateExcuseDay && r.checkIn,
  );
  if (excuseIdx >= 0) {
    const r = attendanceRows[excuseIdx] as any;
    r.checkIn = atWIB(lateExcuseDay, 10, 20);
    r.status = AttendanceStatus.PRESENT; r.isLate = false; r.lateMinutes = 0;
    if (r.checkOut) r.workMinutes = Math.floor((r.checkOut.getTime() - r.checkIn.getTime()) / 60_000);
  }
  await prisma.attendance.createMany({ data: attendanceRows as never, skipDuplicates: true });
  console.log(`✅ HRIS attendance: ${attendanceRows.length} records across ${histWorkdays.length} workdays`);

  // ── Work Orders ────────────────────────────────────────────
  // Clear previous WO seed data
  await prisma.workOrderAttachment.deleteMany({});
  await prisma.workOrderHistory.deleteMany({});
  await prisma.workOrder.deleteMany({});

  // 1) DONE — AC lantai 3 selesai diperbaiki (ELECTRICAL, oleh engineer)
  const woAC = await prisma.workOrder.create({ data: {
    code: 'WO/2026/001',
    title: 'Kerusakan AC Ruang Meeting Lantai 3',
    description: 'AC tidak bisa dinyalakan sejak pagi. Ruang meeting tidak dapat digunakan untuk rapat direksi siang ini.',
    status: WorkOrderStatus.DONE,
    priority: WorkOrderPriority.URGENT,
    category: WorkOrderCategory.ELECTRICAL,
    location: 'Tower A — Lantai 3, Ruang Meeting Utama',
    dueDate: days(-1),
    completedAt: days(-1),
    notes: 'Kapasitor kompresor diganti. Unit berjalan normal kembali.',
    reportedById: admin.id,
    assignedToId: engineer.id,
    history: { create: [
      { fromStatus: null,                      toStatus: WorkOrderStatus.OPEN,        note: 'Work order dibuat',                                        changedById: admin.id,    createdAt: days(-3) },
      { fromStatus: WorkOrderStatus.OPEN,      toStatus: WorkOrderStatus.ASSIGNED,    note: 'Ditugaskan ke Chief Engineer',                             changedById: admin.id,    createdAt: days(-3) },
      { fromStatus: WorkOrderStatus.ASSIGNED,  toStatus: WorkOrderStatus.IN_PROGRESS, note: 'Teknisi sudah di lokasi, sedang pengecekan awal',           changedById: engineer.id, createdAt: days(-2) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.PENDING_PARTS, note: 'Kapasitor kompresor rusak, perlu spare part',           changedById: engineer.id, createdAt: days(-2) },
      { fromStatus: WorkOrderStatus.PENDING_PARTS, toStatus: WorkOrderStatus.IN_PROGRESS, note: 'Spare part sudah tersedia, pengerjaan dilanjutkan',     changedById: engineer.id, createdAt: days(-1) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.DONE,       note: 'Kapasitor diganti, AC berjalan normal. Sudah diuji coba.', changedById: engineer.id, createdAt: days(-1) },
    ]},
  }});

  // 2) IN_PROGRESS — kebocoran pipa toilet lantai 2 (PLUMBING)
  const woLeak = await prisma.workOrder.create({ data: {
    code: 'WO/2026/002',
    title: 'Kebocoran Pipa Air Toilet Pria Lantai 2',
    description: 'Air merembes dari sambungan pipa di bawah wastafel. Lantai sudah tergenang, risiko terpeleset.',
    status: WorkOrderStatus.IN_PROGRESS,
    priority: WorkOrderPriority.HIGH,
    category: WorkOrderCategory.PLUMBING,
    location: 'Tower A — Lantai 2, Toilet Pria',
    dueDate: days(1),
    reportedById: pm.id,
    assignedToId: engineer.id,
    history: { create: [
      { fromStatus: null,                      toStatus: WorkOrderStatus.OPEN,        note: 'Work order dibuat',                      changedById: pm.id,       createdAt: days(-1) },
      { fromStatus: WorkOrderStatus.OPEN,      toStatus: WorkOrderStatus.ASSIGNED,    note: 'Ditugaskan ke Chief Engineer',            changedById: admin.id,    createdAt: days(-1) },
      { fromStatus: WorkOrderStatus.ASSIGNED,  toStatus: WorkOrderStatus.IN_PROGRESS, note: 'Pengecekan lokasi kebocoran sedang dilakukan', changedById: engineer.id, createdAt: days(0) },
    ]},
  }});

  // 3) PENDING_PARTS — sistem HVAC lobby perlu filter baru (HVAC)
  const woHVAC = await prisma.workOrder.create({ data: {
    code: 'WO/2026/003',
    title: 'Filter HVAC Lobby Utama Perlu Diganti',
    description: 'Kualitas udara lobby menurun, bau tidak sedap. Cek filter HVAC menunjukkan sudah sangat kotor dan perlu penggantian.',
    status: WorkOrderStatus.PENDING_PARTS,
    priority: WorkOrderPriority.MEDIUM,
    category: WorkOrderCategory.HVAC,
    location: 'Tower A — Lobby Lantai 1',
    dueDate: days(3),
    notes: 'Menunggu pengiriman filter HEPA ukuran 24x24x4. PO sudah diajukan ke procurement.',
    reportedById: engineer.id,
    assignedToId: engineer.id,
    history: { create: [
      { fromStatus: null,                      toStatus: WorkOrderStatus.OPEN,            note: 'Work order dibuat',                                  changedById: engineer.id, createdAt: days(-4) },
      { fromStatus: WorkOrderStatus.OPEN,      toStatus: WorkOrderStatus.ASSIGNED,        note: 'Self-assigned untuk pengecekan',                     changedById: engineer.id, createdAt: days(-4) },
      { fromStatus: WorkOrderStatus.ASSIGNED,  toStatus: WorkOrderStatus.IN_PROGRESS,     note: 'Inspeksi dilakukan, filter confirmed perlu diganti', changedById: engineer.id, createdAt: days(-3) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.PENDING_PARTS, note: 'Menunggu spare part filter HEPA dari supplier',      changedById: engineer.id, createdAt: days(-2) },
    ]},
  }});

  // 4) ASSIGNED — lampu parkir basement mati (ELECTRICAL)
  const woLamp = await prisma.workOrder.create({ data: {
    code: 'WO/2026/004',
    title: 'Lampu Parkir Basement B2 Mati Sebagian',
    description: '6 unit lampu di area parkir B2 sektor C tidak menyala. Area menjadi gelap dan membahayakan pengguna parkir di malam hari.',
    status: WorkOrderStatus.ASSIGNED,
    priority: WorkOrderPriority.HIGH,
    category: WorkOrderCategory.ELECTRICAL,
    location: 'Basement B2 — Sektor C',
    dueDate: days(2),
    reportedById: admin.id,
    assignedToId: engineer.id,
    history: { create: [
      { fromStatus: null,                 toStatus: WorkOrderStatus.OPEN,     note: 'Work order dibuat',        changedById: admin.id, createdAt: days(-1) },
      { fromStatus: WorkOrderStatus.OPEN, toStatus: WorkOrderStatus.ASSIGNED, note: 'Ditugaskan ke Chief Engineer', changedById: admin.id, createdAt: days(-1) },
    ]},
  }});

  // 5) OPEN — retak di dinding tangga darurat (CIVIL)
  const woCivil = await prisma.workOrder.create({ data: {
    code: 'WO/2026/005',
    title: 'Retak Dinding Tangga Darurat Tower B Lantai 5',
    description: 'Ditemukan retakan horizontal sekitar 30cm pada dinding tangga darurat lantai 5. Perlu assessment struktural segera.',
    status: WorkOrderStatus.OPEN,
    priority: WorkOrderPriority.URGENT,
    category: WorkOrderCategory.CIVIL,
    location: 'Tower B — Tangga Darurat Lantai 5',
    dueDate: days(1),
    reportedById: pm.id,
    assignedToId: null,
    history: { create: [
      { fromStatus: null, toStatus: WorkOrderStatus.OPEN, note: 'Work order dibuat, menunggu assignment teknisi', changedById: pm.id, createdAt: days(0) },
    ]},
  }});

  // 6) OPEN — kebersihan area parkir (CLEANING)
  await prisma.workOrder.create({ data: {
    code: 'WO/2026/006',
    title: 'Pembersihan Menyeluruh Area Parkir Basement B1',
    description: 'Area parkir B1 perlu pembersihan berkala. Debu dan kotoran menumpuk di sudut-sudut dan marka lantai sudah pudar.',
    status: WorkOrderStatus.OPEN,
    priority: WorkOrderPriority.LOW,
    category: WorkOrderCategory.CLEANING,
    location: 'Basement B1 — Seluruh Area',
    dueDate: days(7),
    reportedById: pm.id,
    assignedToId: null,
    history: { create: [
      { fromStatus: null, toStatus: WorkOrderStatus.OPEN, note: 'Work order dibuat', changedById: pm.id, createdAt: days(0) },
    ]},
  }});

  // 7) DONE — penggantian kunci pintu server room (SECURITY)
  const woSecurity = await prisma.workOrder.create({ data: {
    code: 'WO/2026/007',
    title: 'Penggantian Kunci Pintu Server Room',
    description: 'Kunci pintu server room mengalami kerusakan mekanisme. Pintu tidak bisa dikunci dari dalam.',
    status: WorkOrderStatus.DONE,
    priority: WorkOrderPriority.URGENT,
    category: WorkOrderCategory.SECURITY,
    location: 'Tower A — Lantai 4, Server Room',
    dueDate: days(-5),
    completedAt: days(-5),
    notes: 'Kunci diganti dengan model mortise lock baru. Kunci cadangan diserahkan ke admin dan GM.',
    reportedById: admin.id,
    assignedToId: engineer.id,
    history: { create: [
      { fromStatus: null,                      toStatus: WorkOrderStatus.OPEN,        note: 'Work order dibuat',                            changedById: admin.id,    createdAt: days(-7) },
      { fromStatus: WorkOrderStatus.OPEN,      toStatus: WorkOrderStatus.ASSIGNED,    note: 'Ditugaskan ke Chief Engineer',                 changedById: admin.id,    createdAt: days(-7) },
      { fromStatus: WorkOrderStatus.ASSIGNED,  toStatus: WorkOrderStatus.IN_PROGRESS, note: 'Teknisi locksmith sudah dipanggil ke lokasi',  changedById: engineer.id, createdAt: days(-6) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.DONE,      note: 'Kunci baru terpasang dan berfungsi normal',    changedById: engineer.id, createdAt: days(-5) },
    ]},
  }});

  // 8) CANCELLED — rencana pengecatan yang dibatalkan
  await prisma.workOrder.create({ data: {
    code: 'WO/2026/008',
    title: 'Pengecatan Ulang Tangga Darurat Tower A',
    description: 'Cat tangga darurat Tower A sudah pudar dan mengelupas di beberapa titik.',
    status: WorkOrderStatus.CANCELLED,
    priority: WorkOrderPriority.LOW,
    category: WorkOrderCategory.CIVIL,
    location: 'Tower A — Semua Lantai Tangga Darurat',
    dueDate: days(-2),
    notes: 'Dibatalkan — pengecatan dijadwalkan ulang bersamaan dengan proyek renovasi Tower A bulan depan agar lebih efisien.',
    reportedById: pm.id,
    assignedToId: null,
    history: { create: [
      { fromStatus: null,                 toStatus: WorkOrderStatus.OPEN,      note: 'Work order dibuat',                                    changedById: pm.id,    createdAt: days(-10) },
      { fromStatus: WorkOrderStatus.OPEN, toStatus: WorkOrderStatus.CANCELLED, note: 'Dijadwalkan ulang ke proyek renovasi Tower A bulan depan', changedById: admin.id, createdAt: days(-8) },
    ]},
  }});

  // 9) VALIDATED — laporan gas divalidasi PM, belum ditugaskan ke teknisi
  await prisma.workOrder.create({ data: {
    code: 'WO/2026/009',
    title: 'Laporan Kebocoran Gas Dapur Kantin Karyawan',
    description: 'Tercium bau gas menyengat di area dapur kantin. Perlu pengecekan segera oleh tim teknis sebelum area dibuka kembali.',
    status: WorkOrderStatus.VALIDATED,
    priority: WorkOrderPriority.URGENT,
    category: WorkOrderCategory.OTHER,
    location: 'Tower A — Lantai 1, Kantin Karyawan',
    dueDate: days(0),
    reportedById: hr.id,
    assignedToId: null,
    history: { create: [
      { fromStatus: null,                    toStatus: WorkOrderStatus.OPEN,      note: 'Work order dibuat',                                                          changedById: hr.id, createdAt: days(0) },
      { fromStatus: WorkOrderStatus.OPEN,    toStatus: WorkOrderStatus.VALIDATED, note: 'Dikonfirmasi valid oleh Property Manager, menunggu penugasan teknisi.', changedById: pm.id, createdAt: days(0) },
    ]},
  }});

  // 10) PENDING_REVIEW — panel listrik sudah diperbaiki, menunggu verifikasi reviewer
  const woPanel = await prisma.workOrder.create({ data: {
    code: 'WO/2026/010',
    title: 'Kerusakan Panel Listrik Utama Gedung B',
    description: 'Panel listrik utama gedung B mengeluarkan percikan api kecil saat beban puncak. Berpotensi bahaya kebakaran.',
    status: WorkOrderStatus.PENDING_REVIEW,
    priority: WorkOrderPriority.URGENT,
    category: WorkOrderCategory.ELECTRICAL,
    location: 'Tower B — Ruang Panel Listrik Lantai 1',
    dueDate: days(-1),
    reportedById: admin.id,
    assignedToId: engineer.id,
    attachments: { create: [
      { type: 'BEFORE', fileName: 'panel-before.jpg', filePath: 'https://picsum.photos/seed/wo010-before/800/600', fileSize: 245678, mimeType: 'image/jpeg', uploadedById: admin.id,    createdAt: days(-2) },
      { type: 'AFTER',  fileName: 'panel-after.jpg',  filePath: 'https://picsum.photos/seed/wo010-after/800/600',  fileSize: 268123, mimeType: 'image/jpeg', uploadedById: engineer.id, createdAt: days(0)  },
    ]},
    history: { create: [
      { fromStatus: null,                        toStatus: WorkOrderStatus.OPEN,           note: 'Work order dibuat',                                            changedById: admin.id,    createdAt: days(-2) },
      { fromStatus: WorkOrderStatus.OPEN,        toStatus: WorkOrderStatus.ASSIGNED,       note: 'Ditugaskan ke Chief Engineer',                                 changedById: admin.id,    createdAt: days(-2) },
      { fromStatus: WorkOrderStatus.ASSIGNED,    toStatus: WorkOrderStatus.IN_PROGRESS,    note: 'Perbaikan panel sedang dikerjakan',                            changedById: engineer.id, createdAt: days(-1) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.PENDING_REVIEW, note: 'Panel sudah diperbaiki dan diuji aman. Menunggu verifikasi.', changedById: engineer.id, createdAt: days(0)  },
    ]},
  }});

  // 11) DONE via review approval — genset cadangan, lengkap dengan video "before" & foto "after"
  const woGenset = await prisma.workOrder.create({ data: {
    code: 'WO/2026/011',
    title: 'Perbaikan Genset Cadangan Tower A',
    description: 'Genset cadangan tidak menyala otomatis saat listrik PLN padam minggu lalu. Perlu diagnosa dan perbaikan.',
    status: WorkOrderStatus.DONE,
    priority: WorkOrderPriority.HIGH,
    category: WorkOrderCategory.ELECTRICAL,
    location: 'Tower A — Ruang Genset Basement',
    dueDate: days(-3),
    completedAt: days(-1),
    closedAt: days(-1),
    reportedById: pm.id,
    assignedToId: engineer.id,
    reviewedById: admin.id,
    reviewedAt: days(-1),
    reviewNotes: 'Sudah diuji coba manual dan otomatis, genset menyala normal saat simulasi pemadaman. Approved.',
    attachments: { create: [
      { type: 'BEFORE', fileName: 'genset-before.mp4', filePath: 'https://www.w3schools.com/html/mov_bbb.mp4',       fileSize: 1583231, mimeType: 'video/mp4',  uploadedById: pm.id,       createdAt: days(-5) },
      { type: 'AFTER',  fileName: 'genset-after.jpg',   filePath: 'https://picsum.photos/seed/wo011-after/800/600', fileSize: 301245,  mimeType: 'image/jpeg', uploadedById: engineer.id, createdAt: days(-2) },
    ]},
    history: { create: [
      { fromStatus: null,                        toStatus: WorkOrderStatus.OPEN,           note: 'Work order dibuat',                                                         changedById: pm.id,       createdAt: days(-5) },
      { fromStatus: WorkOrderStatus.OPEN,        toStatus: WorkOrderStatus.ASSIGNED,       note: 'Ditugaskan ke Chief Engineer',                                              changedById: admin.id,    createdAt: days(-5) },
      { fromStatus: WorkOrderStatus.ASSIGNED,    toStatus: WorkOrderStatus.IN_PROGRESS,    note: 'Diagnosa & perbaikan genset dimulai',                                       changedById: engineer.id, createdAt: days(-4) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.PENDING_REVIEW, note: 'Genset sudah diperbaiki, video kondisi awal & foto hasil perbaikan terlampir.', changedById: engineer.id, createdAt: days(-2) },
      { fromStatus: WorkOrderStatus.PENDING_REVIEW, toStatus: WorkOrderStatus.DONE,        note: 'Sudah diuji coba manual dan otomatis, genset menyala normal. Approved.',      changedById: admin.id,    createdAt: days(-1) },
    ]},
  }});

  // 12) REJECTED sekali, kembali IN_PROGRESS — AC presisi ruang server perlu pengerjaan ulang
  const woServerAC = await prisma.workOrder.create({ data: {
    code: 'WO/2026/012',
    title: 'Pendinginan AC Presisi Ruang Server Data Center',
    description: 'Suhu ruang server data center di atas ambang batas standar, berisiko terhadap perangkat server.',
    status: WorkOrderStatus.IN_PROGRESS,
    priority: WorkOrderPriority.URGENT,
    category: WorkOrderCategory.HVAC,
    location: 'Tower A — Lantai 4, Ruang Server',
    dueDate: days(1),
    reportedById: admin.id,
    assignedToId: engineer.id,
    reviewedById: admin.id,
    reviewedAt: days(-1),
    reviewNotes: 'Suhu masih di atas standar 22°C setelah pengecekan awal. Tolong cek ulang thermostat dan tambahan unit pendingin cadangan.',
    attachments: { create: [
      { type: 'BEFORE', fileName: 'server-room-before.jpg',    filePath: 'https://picsum.photos/seed/wo012-before/800/600', fileSize: 212345, mimeType: 'image/jpeg', uploadedById: admin.id,    createdAt: days(-3) },
      { type: 'AFTER',  fileName: 'server-room-after-v1.jpg',  filePath: 'https://picsum.photos/seed/wo012-after1/800/600', fileSize: 198765, mimeType: 'image/jpeg', uploadedById: engineer.id, createdAt: days(-1) },
    ]},
    history: { create: [
      { fromStatus: null,                        toStatus: WorkOrderStatus.OPEN,           note: 'Work order dibuat',                                            changedById: admin.id,    createdAt: days(-3) },
      { fromStatus: WorkOrderStatus.OPEN,        toStatus: WorkOrderStatus.ASSIGNED,       note: 'Ditugaskan ke Chief Engineer',                                 changedById: admin.id,    createdAt: days(-3) },
      { fromStatus: WorkOrderStatus.ASSIGNED,    toStatus: WorkOrderStatus.IN_PROGRESS,    note: 'Servis unit AC presisi dimulai',                               changedById: engineer.id, createdAt: days(-2) },
      { fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.PENDING_REVIEW, note: 'Unit AC presisi sudah diservis, suhu sudah turun ke 24°C.',    changedById: engineer.id, createdAt: days(-1) },
      { fromStatus: WorkOrderStatus.PENDING_REVIEW, toStatus: WorkOrderStatus.IN_PROGRESS, note: 'Suhu masih di atas standar 22°C. Perlu cek ulang thermostat.', changedById: admin.id,    createdAt: days(-1) },
    ]},
  }});

  // ── Historical work orders: months of closed/active WOs ─────
  const WO_TEMPLATES: [string, string, WorkOrderCategory][] = [
    ['Perbaikan Exhaust Fan Toilet Lantai %F', 'Exhaust fan tidak berputar, sirkulasi udara buruk.', WorkOrderCategory.ELECTRICAL],
    ['Servis Rutin Unit AC Lantai %F', 'Jadwal servis berkala unit AC split — pembersihan filter dan cek freon.', WorkOrderCategory.HVAC],
    ['Keran Wastafel Bocor Pantry Lantai %F', 'Keran menetes terus meski sudah ditutup rapat.', WorkOrderCategory.PLUMBING],
    ['Penggantian Lampu Koridor Lantai %F', 'Beberapa titik lampu koridor mati atau berkedip.', WorkOrderCategory.ELECTRICAL],
    ['Perbaikan Pintu Akses Kartu Lantai %F', 'Card reader tidak merespons, pintu harus dibuka manual.', WorkOrderCategory.SECURITY],
    ['Pembersihan Kaca Fasad Zona %F', 'Pembersihan berkala kaca fasad eksterior gedung.', WorkOrderCategory.CLEANING],
    ['Perbaikan Plafon Bocor Lantai %F', 'Plafon gypsum bernoda air, dicurigai rembesan dari lantai atas.', WorkOrderCategory.CIVIL],
    ['Kalibrasi Sensor Smoke Detector Lantai %F', 'Pemeriksaan tahunan sensor asap sesuai standar K3.', WorkOrderCategory.OTHER],
    ['Perbaikan Pompa Booster Air Tower %T', 'Tekanan air lantai atas menurun, pompa booster perlu dicek.', WorkOrderCategory.PLUMBING],
    ['Pengecekan Grounding Panel Lantai %F', 'Audit grounding berkala untuk keamanan instalasi listrik.', WorkOrderCategory.ELECTRICAL],
  ];
  const woAssignees = [engineer, extraUsers[1] ?? engineer, extraUsers[11] ?? engineer].filter(Boolean);
  const woReporters = [admin, pm, hr, director, extraUsers[3] ?? pm];
  let woCounter = 12;
  const woMkHistory = (openDay: string, doneDay: string | null, reporter: typeof admin, assignee: typeof admin, finalStatus: WorkOrderStatus) => {
    const h: object[] = [
      { fromStatus: null, toStatus: WorkOrderStatus.OPEN, note: 'Work order dibuat', changedById: reporter.id, createdAt: atWIB(openDay, randInt(8, 11), randInt(0, 59)) },
    ];
    if (finalStatus === WorkOrderStatus.CANCELLED) {
      h.push({ fromStatus: WorkOrderStatus.OPEN, toStatus: WorkOrderStatus.CANCELLED, note: 'Dibatalkan — duplikat / dijadwalkan ulang.', changedById: admin.id, createdAt: atWIB(addDays(openDay, 1), 10, 0) });
      return h;
    }
    h.push({ fromStatus: WorkOrderStatus.OPEN, toStatus: WorkOrderStatus.ASSIGNED, note: 'Ditugaskan ke teknisi', changedById: admin.id, createdAt: atWIB(openDay, randInt(12, 15), 0) });
    if (finalStatus === WorkOrderStatus.ASSIGNED) return h;
    const workDay = addDays(openDay, 1);
    h.push({ fromStatus: WorkOrderStatus.ASSIGNED, toStatus: WorkOrderStatus.IN_PROGRESS, note: 'Pengerjaan dimulai', changedById: assignee.id, createdAt: atWIB(workDay, randInt(8, 10), 0) });
    if (finalStatus === WorkOrderStatus.IN_PROGRESS) return h;
    if (doneDay) {
      h.push({ fromStatus: WorkOrderStatus.IN_PROGRESS, toStatus: WorkOrderStatus.PENDING_REVIEW, note: 'Pengerjaan selesai, menunggu verifikasi.', changedById: assignee.id, createdAt: atWIB(doneDay, randInt(13, 16), 0) });
      h.push({ fromStatus: WorkOrderStatus.PENDING_REVIEW, toStatus: WorkOrderStatus.DONE, note: 'Hasil diverifikasi, work order ditutup.', changedById: admin.id, createdAt: atWIB(doneDay, randInt(16, 18), 0) });
    }
    return h;
  };

  for (let i = 0; i < 28; i++) {
    const [titleT, desc, category] = WO_TEMPLATES[i % WO_TEMPLATES.length];
    const title = titleT.replace('%F', String(randInt(1, 12))).replace('%T', pick(['A', 'B']));
    const openDay = histWorkdays[randInt(0, histWorkdays.length - 6)];
    // Weighted: mostly DONE history; a handful still active.
    const sRoll = rng();
    const finalStatus = sRoll < 0.72 ? WorkOrderStatus.DONE
      : sRoll < 0.80 ? WorkOrderStatus.CANCELLED
      : sRoll < 0.88 ? WorkOrderStatus.IN_PROGRESS
      : WorkOrderStatus.ASSIGNED;
    const doneDay = finalStatus === WorkOrderStatus.DONE ? addDays(openDay, randInt(1, 5)) : null;
    const reporter = pick(woReporters);
    const assignee = finalStatus === WorkOrderStatus.CANCELLED ? null : pick(woAssignees);
    woCounter++;
    await prisma.workOrder.create({ data: {
      code: `WO/${seedYr}/${String(woCounter).padStart(3, '0')}`,
      title, description: desc,
      status: finalStatus,
      priority: pick([WorkOrderPriority.LOW, WorkOrderPriority.MEDIUM, WorkOrderPriority.MEDIUM, WorkOrderPriority.HIGH, WorkOrderPriority.URGENT]),
      category,
      location: `Tower ${pick(['A', 'B'])} — Lantai ${randInt(1, 12)}`,
      dueDate: atWIB(addDays(openDay, randInt(2, 7)), 17, 0),
      completedAt: doneDay ? atWIB(doneDay, 16, 0) : null,
      closedAt:    doneDay ? atWIB(doneDay, 17, 0) : null,
      notes: finalStatus === WorkOrderStatus.DONE ? 'Pekerjaan selesai dan sudah diuji.' : null,
      reportedById: reporter.id,
      assignedToId: assignee?.id ?? null,
      reviewedById: doneDay ? admin.id : null,
      reviewedAt:   doneDay ? atWIB(doneDay, 17, 0) : null,
      createdAt: atWIB(openDay, randInt(8, 11), 0),
      history: { create: woMkHistory(openDay, doneDay, reporter, assignee ?? admin, finalStatus) as never },
    }});
  }
  // Keep the app's code generator ahead of everything we just seeded.
  await prisma.$executeRaw`
    INSERT INTO work_order_sequences (year, counter) VALUES (${seedYr}, ${woCounter})
    ON CONFLICT (year) DO UPDATE SET counter = ${woCounter}
  `;
  console.log(`✅ Work orders & histories created (${woCounter} total, sequence synced)`);

  // ── Notifications ──────────────────────────────────────────
  await prisma.notification.createMany({ data: [
    { type: NotificationType.TASK_ASSIGNED,  title: 'Task Baru Ditugaskan', message: 'Super Admin menugaskan kamu: "Audit Laporan Keuangan Q1 2026".', link: '/tasks', isRead: false, userId: finance.id,   actorId: admin.id   },
    { type: NotificationType.TASK_ASSIGNED,  title: 'Task Baru Ditugaskan', message: 'Super Admin menugaskan kamu: "Koordinasi Pemeliharaan Lift Tower B". Due besok.', link: '/tasks', isRead: false, userId: engineer.id, actorId: admin.id   },
    { type: NotificationType.TASK_ASSIGNED,  title: 'Task Baru Ditugaskan', message: 'Andi Pratama menugaskan kamu: "Review Kontrak Sewa Tenant Baru Lantai 12".', link: '/tasks', isRead: false, userId: admin.id,    actorId: director.id },
    { type: NotificationType.TASK_ASSIGNED,  title: 'Task Diterima',        message: 'Sari Dewi menerima task "Onboarding 3 Staff Baru Divisi Property".', link: '/tasks', isRead: false, userId: admin.id,    actorId: hr.id      },
    { type: NotificationType.TASK_ASSIGNED,  title: 'Task Ditolak',         message: 'Sari Dewi menolak task "Rekap Lembur Karyawan Bulan Mei": Mohon maaf, minggu ini saya full di onboarding staff baru.', link: '/tasks', isRead: false, userId: admin.id, actorId: hr.id },
    { type: NotificationType.BULLETIN_URGENT, title: 'Pengumuman Urgent',   message: 'Dimas Wijaya memposting: "Pemeliharaan Lift Tower A — Sabtu 7 Juni 2026".', link: '/bulletin', isRead: false, userId: admin.id, actorId: pm.id  },
    { type: NotificationType.SYSTEM,         title: 'Selamat Datang',       message: 'Akun kamu sudah aktif. Mulai kelola tugas dan baca pengumuman.', link: '/dashboard', isRead: true, userId: finance.id, actorId: null },
    { type: NotificationType.TASK_COMPLETED, title: 'Task Selesai',         message: 'Reza Maulana menyelesaikan subtask "Finalisasi pilihan warna dengan manajemen".', link: '/tasks', isRead: false, userId: pm.id, actorId: engineer.id },
    // HRIS notifications
    { type: NotificationType.LEAVE_SUBMITTED, title: 'Pengajuan Cuti Baru',  message: 'Reza Maulana mengajukan Cuti Tahunan (3 hari) mulai Jun 28.',    link: '/hris/leave', isRead: false, userId: admin.id,   actorId: engineer.id },
    { type: NotificationType.LEAVE_SUBMITTED, title: 'Pengajuan Cuti Baru',  message: 'Dimas Wijaya mengajukan Darurat (1 hari) mulai Jun 26.',          link: '/hris/leave', isRead: false, userId: admin.id,   actorId: pm.id       },
    { type: NotificationType.LEAVE_APPROVED,  title: 'Cuti Disetujui',       message: 'Super Admin menyetujui pengajuan Cuti Tahunan kamu.',             link: '/hris/leave', isRead: false, userId: hr.id,      actorId: admin.id    },
    { type: NotificationType.LEAVE_APPROVED,  title: 'Cuti Disetujui',       message: 'Super Admin menyetujui pengajuan Sakit kamu.',                    link: '/hris/leave', isRead: true,  userId: finance.id, actorId: admin.id    },
    { type: NotificationType.LEAVE_REJECTED,  title: 'Cuti Ditolak',         message: 'Super Admin menolak pengajuan Cuti Tahunan: Tidak bisa disetujui minggu ini.', link: '/hris/leave', isRead: false, userId: director.id, actorId: admin.id },
    // WO notifications
    { type: NotificationType.WO_ASSIGNED,      title: 'Work Order Ditugaskan',    message: 'Super Admin menugaskan kamu: "Kerusakan AC Ruang Meeting Lantai 3". Prioritas URGENT.',          link: `/work-orders/${woAC.id}`,       isRead: true,  userId: engineer.id, actorId: admin.id    },
    { type: NotificationType.WO_ASSIGNED,      title: 'Work Order Ditugaskan',    message: 'Super Admin menugaskan kamu: "Lampu Parkir Basement B2 Mati Sebagian". Due 2 hari lagi.',        link: `/work-orders/${woLamp.id}`,     isRead: false, userId: engineer.id, actorId: admin.id    },
    { type: NotificationType.WO_COMPLETED,     title: 'Work Order Selesai',       message: 'Reza Maulana menyelesaikan WO "Kerusakan AC Ruang Meeting Lantai 3".',                          link: `/work-orders/${woAC.id}`,       isRead: false, userId: admin.id,    actorId: engineer.id },
    { type: NotificationType.WO_COMPLETED,     title: 'Work Order Selesai',       message: 'Reza Maulana menyelesaikan WO "Penggantian Kunci Pintu Server Room".',                          link: `/work-orders/${woSecurity.id}`, isRead: true,  userId: admin.id,    actorId: engineer.id },
    { type: NotificationType.WO_STATUS_CHANGED, title: 'Status WO Diperbarui',   message: 'WO "Kebocoran Pipa Air Toilet Pria Lantai 2" — status menjadi: IN PROGRESS.',                   link: `/work-orders/${woLeak.id}`,     isRead: false, userId: pm.id,       actorId: engineer.id },
    { type: NotificationType.WO_STATUS_CHANGED, title: 'Status WO Diperbarui',   message: 'WO "Filter HVAC Lobby Utama Perlu Diganti" — status menjadi: PENDING PARTS. Menunggu spare part.', link: `/work-orders/${woHVAC.id}`,  isRead: false, userId: admin.id,    actorId: engineer.id },
    { type: NotificationType.WO_ASSIGNED,      title: 'Work Order Baru Dilaporkan', message: 'Dimas Wijaya membuat WO urgent: "Retak Dinding Tangga Darurat Tower B Lantai 5". Belum ada assignee.', link: `/work-orders/${woCivil.id}`, isRead: false, userId: admin.id, actorId: pm.id },
    { type: NotificationType.WO_STATUS_CHANGED, title: 'Menunggu Review',        message: 'Reza Maulana mengirim WO "Kerusakan Panel Listrik Utama Gedung B" untuk direview.',              link: `/work-orders/${woPanel.id}`,     isRead: false, userId: admin.id,    actorId: engineer.id },
    { type: NotificationType.WO_COMPLETED,     title: 'Work Order Disetujui',    message: 'Super Admin menyetujui WO "Perbaikan Genset Cadangan Tower A" — sudah ditutup.',                  link: `/work-orders/${woGenset.id}`,    isRead: false, userId: engineer.id, actorId: admin.id    },
    { type: NotificationType.WO_STATUS_CHANGED, title: 'Work Order Ditolak',      message: 'Super Admin menolak hasil pengerjaan "Pendinginan AC Presisi Ruang Server Data Center": Suhu masih di atas standar.', link: `/work-orders/${woServerAC.id}`, isRead: false, userId: engineer.id, actorId: admin.id },
  ]});
  console.log('✅ Notifications created');

  console.log('\n🎉 Seeding selesai!');
  console.log('─────────────────────────────────────────');
  console.log(`Users total       : ${staff.length} aktif (>=2 per role, password123)`);
  console.log('Login credentials:');
  console.log('  Super Admin      : admin@sangroup.id / admin123');
  console.log('  Director Retail  : director.retail@sangroup.id / password123');
  console.log('  Property Manager : pm@sangroup.id / password123');
  console.log('  HR Manager       : hr@sangroup.id / password123');
  console.log('  Finance Manager  : finance@sangroup.id / password123');
  console.log('  Chief Engineer   : engineer@sangroup.id / password123');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
