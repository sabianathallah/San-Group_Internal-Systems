import {
  PrismaClient, TaskStatus, TaskPriority, TaskVisibility,
  BulletinCategory, BulletinPriority, NotificationType, AssignmentStatus,
  WorkOrderStatus, WorkOrderPriority, WorkOrderCategory,
  AttendanceStatus, LeaveStatus, OvertimeStatus,
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

  // ── HRIS ───────────────────────────────────────────────────
  await prisma.overtimeRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.officeLocation.deleteMany({});
  await prisma.shift.deleteMany({});

  // Shifts
  const shiftOffice = await prisma.shift.create({ data: { name: 'Office Staff', startTime: '08:00', endTime: '17:00', lateThresholdMinutes: 0, isDefault: true, color: '#3b82f6' } });
  await prisma.shift.create({ data: { name: 'Security', startTime: '07:00', endTime: '19:00', lateThresholdMinutes: 0, color: '#ef4444' } });
  await prisma.shift.create({ data: { name: 'Shift Siang', startTime: '12:00', endTime: '21:00', lateThresholdMinutes: 0, color: '#f59e0b' } });

  // Office Locations
  const locHead = await prisma.officeLocation.create({ data: { name: 'Head Office - Jakarta', address: 'Jakarta Selatan', lat: -6.2297, lng: 106.8295, radiusMeters: 150 } });
  await prisma.officeLocation.create({ data: { name: 'Site - Properti A', address: 'Tangerang Selatan', lat: -6.3297, lng: 106.7295, radiusMeters: 200 } });

  // Assign default shift to all users
  for (const u of [admin, director, pm, hr, finance, engineer]) {
    await prisma.user.update({ where: { id: u.id }, data: { shiftId: shiftOffice.id } });
  }
  console.log('✅ Shifts & office locations created');

  // Leave types
  const ltAnnual = await prisma.leaveType.create({ data: { name: 'Annual Leave',    slug: 'ANNUAL',      color: '#6366f1', maxDaysPerYear: 12, isPaid: true, requiresDoc: false, position: 0 } });
  const ltSick   = await prisma.leaveType.create({ data: { name: 'Sick Leave',      slug: 'SICK',        color: '#ef4444', maxDaysPerYear: 0,  isPaid: true, requiresDoc: true,  position: 1 } });
  const ltEmerg  = await prisma.leaveType.create({ data: { name: 'Emergency Leave', slug: 'EMERGENCY',   color: '#f97316', maxDaysPerYear: 3,  isPaid: true, requiresDoc: false, position: 2 } });
  const ltWFH    = await prisma.leaveType.create({ data: { name: 'WFH Special',     slug: 'WFH_SPECIAL', color: '#3b82f6', maxDaysPerYear: 6,  isPaid: true, requiresDoc: false, position: 3 } });

  // Leave balances (year 2026) for all 6 users
  const allUsers = [admin, director, pm, hr, finance, engineer];
  for (const u of allUsers) {
    await prisma.leaveBalance.create({ data: { userId: u.id, leaveTypeId: ltAnnual.id, year: 2026, totalDays: 12, usedDays: 3, pendingDays: 0 } });
    await prisma.leaveBalance.create({ data: { userId: u.id, leaveTypeId: ltEmerg.id,  year: 2026, totalDays: 3,  usedDays: 0, pendingDays: 0 } });
    await prisma.leaveBalance.create({ data: { userId: u.id, leaveTypeId: ltWFH.id,    year: 2026, totalDays: 6,  usedDays: 2, pendingDays: 0 } });
  }

  // Leave requests
  // 1) APPROVED — hr ambil cuti tahunan bulan lalu
  await prisma.leaveRequest.create({ data: {
    userId: hr.id, leaveTypeId: ltAnnual.id,
    startDate: days(-15), endDate: days(-13), totalDays: 3,
    reason: 'Keperluan keluarga di luar kota.',
    status: LeaveStatus.APPROVED,
    reviewedById: admin.id, reviewedAt: days(-17),
    reviewNote: 'Disetujui. Pastikan handover ke rekan sebelum cuti.',
  }});
  // 2) APPROVED — finance sakit
  await prisma.leaveRequest.create({ data: {
    userId: finance.id, leaveTypeId: ltSick.id,
    startDate: days(-5), endDate: days(-4), totalDays: 2,
    reason: 'Demam dan flu sejak 2 hari lalu. Sudah periksa ke dokter.',
    status: LeaveStatus.APPROVED,
    reviewedById: admin.id, reviewedAt: days(-6),
  }});
  // 3) PENDING — engineer minta cuti tahunan
  const lrPending = await prisma.leaveRequest.create({ data: {
    userId: engineer.id, leaveTypeId: ltAnnual.id,
    startDate: days(3), endDate: days(5), totalDays: 3,
    reason: 'Pernikahan adik di Yogyakarta.',
    status: LeaveStatus.PENDING,
  }});
  // 4) PENDING — pm darurat
  const lrPending2 = await prisma.leaveRequest.create({ data: {
    userId: pm.id, leaveTypeId: ltEmerg.id,
    startDate: days(1), endDate: days(1), totalDays: 1,
    reason: 'Orang tua masuk rumah sakit mendadak.',
    status: LeaveStatus.PENDING,
  }});
  // 5) REJECTED — director
  await prisma.leaveRequest.create({ data: {
    userId: director.id, leaveTypeId: ltAnnual.id,
    startDate: days(-2), endDate: days(0), totalDays: 2,
    reason: 'Perlu istirahat setelah closing Q2.',
    status: LeaveStatus.REJECTED,
    reviewedById: admin.id, reviewedAt: days(-3),
    reviewNote: 'Tidak bisa disetujui minggu ini karena ada meeting direksi. Coba jadwalkan minggu depan.',
  }});
  console.log('✅ HRIS leave types, balances & requests created');

  // Attendance — 10 hari terakhir untuk semua user
  const checkInHour  = (h: number, m: number) => new Date(Date.UTC(2026, 5, 26 - 10, h, m)); // base date
  for (let d = 9; d >= 0; d--) {
    const dateOffset = -d;
    const dateVal = new Date(Date.now() + dateOffset * 86_400_000);
    // Skip weekend
    const dayOfWeek = dateVal.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (const u of allUsers) {
      // Randomize a bit
      const lateChance = Math.random();
      const isLate = lateChance > 0.8;
      const checkInMin = isLate ? 90 + Math.floor(Math.random() * 30) : 60 + Math.floor(Math.random() * 25);
      const checkInTime = new Date(dateVal);
      checkInTime.setUTCHours(1, checkInMin, 0, 0); // ~08:00-09:30 WIB

      const checkOutTime = new Date(dateVal);
      checkOutTime.setUTCHours(10, 0 + Math.floor(Math.random() * 30), 0, 0); // ~17:00-17:30 WIB

      const workMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
      const status = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      const lateMinutes = isLate ? checkInMin - 90 : 0;

      const dateOnly = new Date(dateVal.toISOString().slice(0, 10) + 'T00:00:00.000Z');

      await prisma.attendance.upsert({
        where: { userId_date: { userId: u.id, date: dateOnly } },
        update: {},
        create: {
          userId: u.id, date: dateOnly,
          checkIn: checkInTime, checkOut: checkOutTime,
          status, isLate, lateMinutes, workMinutes,
          shiftId: shiftOffice.id,
          lat: locHead.lat + (Math.random() - 0.5) * 0.001,
          lng: locHead.lng + (Math.random() - 0.5) * 0.001,
          locationName: 'Head Office - Jakarta',
          officeLocationId: locHead.id,
        },
      });
    }
  }
  // WFH example for finance today
  {
    const todayDate = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const ci = new Date(); ci.setUTCHours(1, 5, 0, 0);
    await prisma.attendance.upsert({
      where: { userId_date: { userId: finance.id, date: todayDate } },
      update: { status: AttendanceStatus.WFH, checkIn: ci, note: 'WFH hari ini', shiftId: shiftOffice.id },
      create: { userId: finance.id, date: todayDate, checkIn: ci, status: AttendanceStatus.WFH, isLate: false, lateMinutes: 0, note: 'WFH hari ini', shiftId: shiftOffice.id },
    });
  }
  console.log('✅ HRIS attendance records created');

  // Overtime requests
  const todayForOT = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const ot1Date    = new Date(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const ot2Date    = new Date(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) + 'T00:00:00.000Z');
  await prisma.overtimeRequest.create({ data: {
    userId: engineer.id, date: todayForOT,
    startTime: '17:00', endTime: '20:00', durationMinutes: 180,
    reason: 'Perbaikan AC lantai 3 harus selesai sebelum rapat direksi besok pagi.',
    status: OvertimeStatus.PENDING,
  }});
  await prisma.overtimeRequest.create({ data: {
    userId: pm.id, date: ot1Date,
    startTime: '17:00', endTime: '19:30', durationMinutes: 150,
    reason: 'Finalisasi laporan inspeksi bangunan untuk diserahkan ke klien.',
    status: OvertimeStatus.APPROVED,
    reviewedById: admin.id, reviewedAt: new Date(Date.now() - 2 * 86400000),
    reviewNote: 'Disetujui. Pastikan laporan sudah lengkap.',
  }});
  await prisma.overtimeRequest.create({ data: {
    userId: hr.id, date: ot2Date,
    startTime: '17:00', endTime: '19:00', durationMinutes: 120,
    reason: 'Persiapan dokumen onboarding 3 staff baru yang mulai Senin.',
    status: OvertimeStatus.APPROVED,
    reviewedById: admin.id, reviewedAt: new Date(Date.now() - 6 * 86400000),
  }});
  console.log('✅ Overtime requests created');

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

  console.log('✅ Work orders & histories created');

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
    // Overtime notifications
    { type: NotificationType.OVERTIME_SUBMITTED, title: 'Pengajuan Lembur Baru', message: 'Reza Maulana mengajukan lembur hari ini (3j 0m).', link: '/hris/overtime', isRead: false, userId: admin.id, actorId: engineer.id },
    { type: NotificationType.OVERTIME_APPROVED,  title: 'Lembur Disetujui',      message: 'Super Admin menyetujui pengajuan lembur kamu.',  link: '/hris/overtime', isRead: false, userId: pm.id,      actorId: admin.id    },
    { type: NotificationType.OVERTIME_APPROVED,  title: 'Lembur Disetujui',      message: 'Super Admin menyetujui pengajuan lembur kamu.',  link: '/hris/overtime', isRead: true,  userId: hr.id,      actorId: admin.id    },
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
