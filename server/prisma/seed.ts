import {
  PrismaClient, TaskStatus, TaskPriority, TaskVisibility,
  BulletinCategory, BulletinPriority, NotificationType, AssignmentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hash(pw, 12);
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

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
    },
  });
  const director = await prisma.user.upsert({
    where: { email: 'director.retail@sangroup.id' },
    update: {},
    create: {
      email: 'director.retail@sangroup.id', username: 'director.retail',
      password: await hash('password123'), fullName: 'Andi Pratama', phone: '08111111111',
      roleId: roleDirector, divisionId: divRetail, isActive: true,
    },
  });
  const pm = await prisma.user.upsert({
    where: { email: 'pm@sangroup.id' },
    update: {},
    create: {
      email: 'pm@sangroup.id', username: 'property.manager',
      password: await hash('password123'), fullName: 'Dimas Wijaya', phone: '08111222222',
      roleId: rolePM, divisionId: divProperty, isActive: true,
    },
  });
  const hr = await prisma.user.upsert({
    where: { email: 'hr@sangroup.id' },
    update: {},
    create: {
      email: 'hr@sangroup.id', username: 'hr.manager',
      password: await hash('password123'), fullName: 'Sari Dewi', phone: '08122222222',
      roleId: roleHR, divisionId: divHR, isActive: true,
    },
  });
  const finance = await prisma.user.upsert({
    where: { email: 'finance@sangroup.id' },
    update: {},
    create: {
      email: 'finance@sangroup.id', username: 'finance.manager',
      password: await hash('password123'), fullName: 'Budi Santoso', phone: '08133333333',
      roleId: roleFinance, divisionId: divFinance, isActive: true,
    },
  });
  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@sangroup.id' },
    update: {},
    create: {
      email: 'engineer@sangroup.id', username: 'chief.engineer',
      password: await hash('password123'), fullName: 'Reza Maulana', phone: '08144444444',
      roleId: roleChief, divisionId: divEngineering, isActive: true,
    },
  });
  console.log('✅ Users created');

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
  ]});
  console.log('✅ Notifications created');

  console.log('\n🎉 Seeding selesai!');
  console.log('─────────────────────────────────────────');
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
