import {
  PrismaClient, Role, Division, TaskStatus, TaskPriority, TaskCategory,
  BulletinCategory, BulletinPriority, NotificationType, AssignmentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hash(pw, 12);
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sangroup.id' },
    update: {},
    create: { email: 'admin@sangroup.id', username: 'superadmin', password: await hash('admin123'), fullName: 'Super Admin', phone: '08100000000', role: Role.SUPER_ADMIN, division: Division.MANAGEMENT, isActive: true },
  });
  const director = await prisma.user.upsert({
    where: { email: 'director.retail@sangroup.id' },
    update: {},
    create: { email: 'director.retail@sangroup.id', username: 'director.retail', password: await hash('password123'), fullName: 'Andi Pratama', phone: '08111111111', role: Role.DIRECTOR, division: Division.RETAIL, isActive: true },
  });
  const pm = await prisma.user.upsert({
    where: { email: 'pm@sangroup.id' },
    update: {},
    create: { email: 'pm@sangroup.id', username: 'property.manager', password: await hash('password123'), fullName: 'Dimas Wijaya', phone: '08111222222', role: Role.PROPERTY_MANAGER, division: Division.PROPERTY, isActive: true },
  });
  const hr = await prisma.user.upsert({
    where: { email: 'hr@sangroup.id' },
    update: {},
    create: { email: 'hr@sangroup.id', username: 'hr.manager', password: await hash('password123'), fullName: 'Sari Dewi', phone: '08122222222', role: Role.HR_MANAGER, division: Division.HR, isActive: true },
  });
  const finance = await prisma.user.upsert({
    where: { email: 'finance@sangroup.id' },
    update: {},
    create: { email: 'finance@sangroup.id', username: 'finance.manager', password: await hash('password123'), fullName: 'Budi Santoso', phone: '08133333333', role: Role.FINANCE_MANAGER, division: Division.FINANCE, isActive: true },
  });
  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@sangroup.id' },
    update: {},
    create: { email: 'engineer@sangroup.id', username: 'chief.engineer', password: await hash('password123'), fullName: 'Reza Maulana', phone: '08144444444', role: Role.CHIEF_ENGINEER, division: Division.ENGINEERING, isActive: true },
  });
  console.log('✅ Users created');

  // ── Clear previous seed data ───────────────────────────────
  await prisma.notification.deleteMany({});
  await prisma.bulletinReadStatus.deleteMany({});
  await prisma.task.deleteMany({});          // cascades subtasks, links, comments
  await prisma.bulletin.deleteMany({});      // cascades attachments, readStatus
  await prisma.stickyNote.deleteMany({});
  await prisma.taskList.deleteMany({});
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

  // 1. Audit Q1 — admin assign ke finance, sudah ACCEPTED, in progress, due hari ini
  const taskAudit = await prisma.task.create({ data: {
    title: 'Audit Laporan Keuangan Q1 2026',
    description: 'Review menyeluruh laporan keuangan Q1 sebelum diserahkan ke owner. Pastikan semua angka sudah diverifikasi dan tidak ada selisih.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT, category: TaskCategory.MY_DAY,
    dueDate: days(0), isPrivate: false,
    assignmentStatus: AssignmentStatus.ACCEPTED,
    userId: admin.id, assignedToId: finance.id, listId: listKeuangan.id, position: 0,
  }});

  // Subtasks audit
  const subAudit1 = await prisma.task.create({ data: { title: 'Review neraca keuangan', status: TaskStatus.DONE, priority: TaskPriority.HIGH, category: TaskCategory.MY_DAY, completedAt: days(-1), userId: finance.id, parentTaskId: taskAudit.id, position: 0 }});
  const subAudit2 = await prisma.task.create({ data: { title: 'Cek laporan arus kas', status: TaskStatus.DONE, priority: TaskPriority.HIGH, category: TaskCategory.MY_DAY, completedAt: days(-1), userId: finance.id, parentTaskId: taskAudit.id, position: 1 }});
  await prisma.task.create({ data: { title: 'Validasi laporan laba rugi', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, category: TaskCategory.MY_DAY, dueDate: days(0), userId: finance.id, parentTaskId: taskAudit.id, position: 2 }});
  await prisma.task.create({ data: { title: 'Presentasi hasil audit ke manajemen', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED, dueDate: days(2), userId: finance.id, parentTaskId: taskAudit.id, position: 3 }});

  // Links & comments for audit task
  await prisma.taskLink.create({ data: { url: 'https://docs.google.com/spreadsheets', title: 'Spreadsheet Laporan Q1 2026', taskId: taskAudit.id }});
  await prisma.taskLink.create({ data: { url: 'https://drive.google.com', title: 'Folder Dokumen Pendukung', taskId: taskAudit.id }});
  await prisma.taskComment.create({ data: { content: 'Data Q1 sudah dikompilasi. Neraca dan arus kas selesai, tinggal laba rugi yang perlu cross-check lagi.', taskId: taskAudit.id, userId: finance.id }});
  await prisma.taskComment.create({ data: { content: 'Pastikan sudah include depresiasi aset Tower B yang baru di-renovasi. Jangan sampai kelewat.', taskId: taskAudit.id, userId: admin.id }});
  await prisma.taskComment.create({ data: { content: 'Siap, sudah saya tambahkan. Target selesai hari ini sebelum jam 17.00.', taskId: taskAudit.id, userId: finance.id }});

  // 2. Pemeliharaan Lift — admin assign ke engineer, masih PENDING
  const taskLift = await prisma.task.create({ data: {
    title: 'Koordinasi Pemeliharaan Lift Tower B',
    description: 'Jadwalkan pemeliharaan rutin 3 unit lift Tower B bersama vendor. Pastikan jadwal tidak mengganggu jam operasional tenant.',
    status: TaskStatus.TODO, priority: TaskPriority.HIGH, category: TaskCategory.MY_DAY,
    dueDate: days(1), isPrivate: false,
    assignmentStatus: AssignmentStatus.PENDING,
    userId: admin.id, assignedToId: engineer.id, position: 0,
  }});
  await prisma.task.create({ data: { title: 'Hubungi vendor lift untuk jadwal', status: TaskStatus.TODO, priority: TaskPriority.HIGH, category: TaskCategory.MY_DAY, userId: engineer.id, parentTaskId: taskLift.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Konfirmasi jadwal ke manajemen gedung', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED, userId: engineer.id, parentTaskId: taskLift.id, position: 1 }});
  await prisma.taskLink.create({ data: { url: 'https://drive.google.com', title: 'Riwayat Maintenance Lift 2025', taskId: taskLift.id }});

  // 3. Onboarding staff — admin assign ke HR, ACCEPTED
  const taskOnboard = await prisma.task.create({ data: {
    title: 'Onboarding 3 Staff Baru Divisi Property',
    description: 'Persiapkan semua kebutuhan onboarding untuk 3 staff baru yang bergabung tanggal 10 Juni. Termasuk kontrak, akses sistem, dan orientasi.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, category: TaskCategory.IMPORTANT,
    dueDate: days(4), isPrivate: false,
    assignmentStatus: AssignmentStatus.ACCEPTED,
    userId: admin.id, assignedToId: hr.id, listId: listRekrutmen.id, position: 0,
  }});
  await prisma.task.create({ data: { title: 'Siapkan kontrak kerja dan NDA', status: TaskStatus.DONE, priority: TaskPriority.HIGH, category: TaskCategory.IMPORTANT, completedAt: days(-1), userId: hr.id, parentTaskId: taskOnboard.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Buat akun email dan akses sistem', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, category: TaskCategory.IMPORTANT, dueDate: days(2), userId: hr.id, parentTaskId: taskOnboard.id, position: 1 }});
  await prisma.task.create({ data: { title: 'Jadwalkan sesi orientasi dan tour gedung', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED, dueDate: days(4), userId: hr.id, parentTaskId: taskOnboard.id, position: 2 }});
  await prisma.taskComment.create({ data: { content: 'Kontrak sudah ditandatangani ketiganya. Sekarang proses akun sistem.', taskId: taskOnboard.id, userId: hr.id }});
  await prisma.taskComment.create({ data: { content: 'Bagus! Pastikan akses ke sistem task dan bulletin sudah aktif sebelum hari pertama masuk.', taskId: taskOnboard.id, userId: admin.id }});

  // 4. Assign dari director ke admin (bawahan assign ke atasan) — PENDING
  await prisma.task.create({ data: {
    title: 'Review Kontrak Sewa Tenant Baru Lantai 12',
    description: 'Tenant baru akan menempati lantai 12 per 1 Juli. Kontrak perlu direview dan ditandatangani sebelum tanggal 20 Juni.',
    status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, category: TaskCategory.IMPORTANT,
    dueDate: days(5), isPrivate: false,
    assignmentStatus: AssignmentStatus.PENDING,
    userId: director.id, assignedToId: admin.id, position: 0,
  }});

  // 5. Rejected assignment — admin assign ke director, director tolak
  await prisma.task.create({ data: {
    title: 'Presentasi Proposal Ekspansi Retail ke Owner',
    description: 'Siapkan dan presentasikan proposal ekspansi area retail di lantai dasar ke Owner.',
    status: TaskStatus.TODO, priority: TaskPriority.HIGH, category: TaskCategory.PLANNED,
    dueDate: days(10), isPrivate: false,
    assignmentStatus: AssignmentStatus.REJECTED,
    assignmentNote: 'Proposal belum cukup matang. Data market research perlu dilengkapi dulu sebelum dibawa ke Owner.',
    userId: admin.id, assignedToId: null, position: 1,
  }});

  // 6. Private task milik finance
  await prisma.task.create({ data: {
    title: 'Draft Proyeksi Cash Flow Q3 2026',
    description: 'Proyeksi internal — belum untuk dibagikan.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, category: TaskCategory.MY_DAY,
    dueDate: days(3), isPrivate: true,
    userId: finance.id, position: 0,
  }});

  // 7. Task selesai — renovasi, milik pm
  await prisma.task.create({ data: {
    title: 'Update SOP Prosedur Evakuasi Darurat',
    status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED,
    completedAt: days(-2), isPrivate: false,
    userId: pm.id, listId: listRenovasi.id, position: 0,
  }});

  // 8. Renovasi in progress — pm assign ke engineer, ACCEPTED
  const taskCat = await prisma.task.create({ data: {
    title: 'Pengecatan Ulang Lobby dan Koridor Tower A',
    description: 'Pengecatan ulang area lobby lantai 1 dan koridor lantai 2-5. Gunakan warna corporate SAN Group.',
    status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED,
    dueDate: days(6), isPrivate: false,
    assignmentStatus: AssignmentStatus.ACCEPTED,
    userId: pm.id, assignedToId: engineer.id, listId: listRenovasi.id, position: 1,
  }});
  await prisma.task.create({ data: { title: 'Finalisasi pilihan warna dengan manajemen', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED, completedAt: days(-1), userId: engineer.id, parentTaskId: taskCat.id, position: 0 }});
  await prisma.task.create({ data: { title: 'Pembelian material cat dan alat', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, category: TaskCategory.PLANNED, dueDate: days(1), userId: engineer.id, parentTaskId: taskCat.id, position: 1 }});
  await prisma.task.create({ data: { title: 'Pelaksanaan pengecatan', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, category: TaskCategory.PLANNED, dueDate: days(5), userId: engineer.id, parentTaskId: taskCat.id, position: 2 }});

  // 9. Inspeksi sprinkler — renovasi, TODO, HIGH
  await prisma.task.create({ data: {
    title: 'Inspeksi Sistem Sprinkler Seluruh Lantai',
    description: 'Inspeksi rutin tahunan sistem sprinkler kebakaran. Koordinasikan dengan Dinas Pemadam Kebakaran.',
    status: TaskStatus.TODO, priority: TaskPriority.HIGH, category: TaskCategory.PLANNED,
    dueDate: days(14), isPrivate: false,
    userId: pm.id, listId: listRenovasi.id, position: 2,
  }});

  // 10. Task admin biasa — no assignment
  await prisma.task.create({ data: {
    title: 'Rapat Koordinasi Divisi — Agenda Juni 2026',
    description: 'Susun agenda dan undang semua kepala divisi untuk rapat koordinasi bulanan.',
    status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, category: TaskCategory.MY_DAY,
    dueDate: days(2), isPrivate: false,
    userId: admin.id, position: 2,
  }});

  // 11. Task overdue admin
  await prisma.task.create({ data: {
    title: 'Kirim Laporan Utilitas ke Owner',
    description: 'Laporan konsumsi listrik, air, dan gas bulan Mei 2026.',
    status: TaskStatus.TODO, priority: TaskPriority.URGENT, category: TaskCategory.IMPORTANT,
    dueDate: days(-2), isPrivate: false,
    userId: admin.id, position: 3,
  }});

  // 12. Task important — HR, no assignment
  await prisma.task.create({ data: {
    title: 'Evaluasi Kinerja Karyawan Semester 1',
    description: 'Kumpulkan form penilaian dari semua manajer, kompilasi, dan buat laporan ringkasan.',
    status: TaskStatus.TODO, priority: TaskPriority.HIGH, category: TaskCategory.IMPORTANT,
    dueDate: days(15), isPrivate: false,
    userId: hr.id, position: 0,
  }});

  console.log('✅ Tasks, subtasks, links & comments created');

  // ── Sticky Notes ───────────────────────────────────────────
  await prisma.stickyNote.createMany({ data: [
    { title: 'Meeting Owner — Rabu', content: 'Rabu 10 Juni, 15:00 di ruang direksi.\nAgenda: Progress Q2, rencana renovasi, update rekrutmen.\nBawa: deck presentasi + laporan keuangan.', color: 'yellow', isPinned: true, position: 0, userId: admin.id },
    { title: 'Kontak Darurat PLN', content: 'PLN Icon+ 24 jam: 123\nEmail: iconpln-jakarta@pln.co.id\nNo. Pelanggan: 542-1000-0001\nTegangan kontrak: 20 kV', color: 'blue', isPinned: true, position: 1, userId: admin.id },
    { title: null, content: 'Perpanjang kontrak vendor security — jatuh tempo 30 Juni 2026. Hubungi PT Wijaya Sekuriti untuk negosiasi harga.', color: 'pink', isPinned: false, position: 2, userId: admin.id },
    { title: 'Kontak Vendor Lift', content: 'Schindler Indonesia\nTelp: 021-5500-1234\nPIC: Pak Hendra\nKontrak no. LFT-2024-089', color: 'green', isPinned: false, position: 0, userId: pm.id },
    { title: 'Checklist Akhir Bulan', content: '- Laporan utilitas (tgl 25)\n- Rekap absensi (tgl 27)\n- Review invoice vendor (tgl 28)\n- Submit ke finance (tgl 29)', color: 'purple', isPinned: true, position: 3, userId: admin.id },
    { title: null, content: 'Target Q2: reduce biaya operasional 10% vs Q1. Fokus efisiensi listrik dan air.', color: 'orange', isPinned: false, position: 1, userId: finance.id },
  ]});
  console.log('✅ Sticky notes created');

  // ── Bulletins ──────────────────────────────────────────────
  const bulletinHoliday = await prisma.bulletin.create({ data: {
    title: 'Libur Nasional — Hari Raya Idul Adha 1447 H',
    content: 'Diberitahukan kepada seluruh karyawan SAN Group bahwa perusahaan akan libur pada hari Senin, 9 Juni 2026 dalam rangka Hari Raya Idul Adha 1447 H.\n\nOperasional kantor kembali normal pada Selasa, 10 Juni 2026.\n\nBagi karyawan yang bertugas on-call selama periode libur, harap berkoordinasi dengan atasan masing-masing.\n\nSelamat Hari Raya Idul Adha. Semoga ibadah qurban kita diterima.',
    category: BulletinCategory.HOLIDAY, priority: BulletinPriority.IMPORTANT,
    isPublished: true, publishedAt: days(-3), expiresAt: days(4),
    authorId: admin.id,
  }});

  const bulletinMaint = await prisma.bulletin.create({ data: {
    title: 'Pemeliharaan Lift Tower A — Sabtu 7 Juni 2026',
    content: 'Tim engineering akan melaksanakan pemeliharaan rutin tahunan pada 3 unit lift Tower A.\n\nJadwal pelaksanaan:\nSabtu, 7 Juni 2026 — pukul 07.00 hingga 14.00 WIB\n\nSelama proses berlangsung:\n- Lift Tower A unit 1, 2, dan 3 tidak dapat digunakan\n- Tangga darurat tetap berfungsi normal\n- Generator backup aktif untuk area common\n- Tenant lantai 1-10 dimohon untuk berkoordinasi dengan tim operasional\n\nMohon maaf atas ketidaknyamanan yang ditimbulkan.\nInformasi lebih lanjut hubungi Tim Engineering ext. 201.',
    category: BulletinCategory.MAINTENANCE, priority: BulletinPriority.URGENT,
    isPublished: true, publishedAt: days(-5), expiresAt: days(1),
    authorId: pm.id,
  }});

  await prisma.bulletin.create({ data: {
    title: 'SAN Group Internal System — Resmi Diluncurkan',
    content: 'Dengan bangga kami memperkenalkan SAN Group Internal Management System, platform digital terpadu untuk mendukung operasional harian seluruh tim SAN Group.\n\nFitur yang tersedia:\n\nTask Management\nKelola tugas harian, assign ke rekan, pantau progres, dan beri catatan — semua dalam satu tampilan.\n\nBulletin Board\nInformasi resmi perusahaan terpusat. Tidak ada lagi pengumuman yang terlewat.\n\nSticky Notes\nCatatan cepat personal yang selalu ada di dashboard.\n\nDatabase Links\nAkses cepat ke dokumen dan sistem eksternal yang sering digunakan, terorganisir per divisi.\n\nFitur tambahan akan terus dikembangkan berdasarkan masukan pengguna. Untuk pertanyaan atau laporan bug, hubungi tim IT melalui email it@sangroup.id.',
    category: BulletinCategory.ANNOUNCEMENT, priority: BulletinPriority.NORMAL,
    isPublished: true, publishedAt: days(-7), expiresAt: null,
    authorId: admin.id,
  }});

  await prisma.bulletin.create({ data: {
    title: 'Pembaruan Kebijakan Absensi Per 1 Juli 2026',
    content: 'Mulai 1 Juli 2026, berlaku kebijakan absensi yang diperbarui sebagai berikut:\n\n1. Check-in — maksimal pukul 08.30 WIB. Keterlambatan pertama dalam sebulan mendapat teguran lisan. Keterlambatan kedua dan seterusnya akan mempengaruhi penilaian kinerja.\n\n2. Work From Home — diperbolehkan maksimal 2 hari per minggu bagi posisi yang memenuhi syarat, dengan persetujuan atasan langsung minimal H-1.\n\n3. Cuti — pengajuan cuti wajib dilakukan minimal 3 hari kerja sebelumnya melalui sistem HR, kecuali cuti darurat.\n\n4. Lembur — wajib mendapat persetujuan tertulis dari atasan sebelum pelaksanaan. Kompensasi lembur diproses setiap akhir bulan.\n\nKebijakan lengkap dapat diakses di folder HR pada Database Links. Pertanyaan dapat diajukan ke hr@sangroup.id.',
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

  // ── Database Folders ───────────────────────────────────────
  const folderHR = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-hr' },
    update: { name: 'HR & People', color: '#ec4899', icon: null },
    create: { id: 'seed-folder-hr', name: 'HR & People', icon: null, color: '#ec4899', position: 0, createdById: admin.id },
  });
  const folderFinance = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-finance' },
    update: { name: 'Finance', color: '#10b981', icon: null },
    create: { id: 'seed-folder-finance', name: 'Finance', icon: null, color: '#10b981', position: 1, createdById: admin.id },
  });
  const folderProperty = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-property' },
    update: { name: 'Property & Operasional', color: '#3b82f6', icon: null },
    create: { id: 'seed-folder-property', name: 'Property & Operasional', icon: null, color: '#3b82f6', position: 2, createdById: admin.id },
  });
  const folderLegal = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-legal' },
    update: { name: 'Legal & Perizinan', color: '#8b5cf6', icon: null },
    create: { id: 'seed-folder-legal', name: 'Legal & Perizinan', icon: null, color: '#8b5cf6', position: 3, createdById: admin.id },
  });
  const folderMgmt = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-mgmt' },
    update: { name: 'Manajemen', color: '#6366f1', icon: null },
    create: { id: 'seed-folder-mgmt', name: 'Manajemen', icon: null, color: '#6366f1', position: 4, createdById: admin.id },
  });

  await prisma.databaseLink.deleteMany({});
  await prisma.databaseLink.createMany({ data: [
    { title: 'Google Drive HR',              url: 'https://drive.google.com',                   description: 'Folder utama dokumen HR — kontrak, SK, BPJS',              folderId: folderHR.id,       position: 0, createdById: admin.id },
    { title: 'BPJS Ketenagakerjaan Online',  url: 'https://sso.bpjsketenagakerjaan.go.id',      description: 'Portal klaim dan pengecekan status BPJS karyawan',          folderId: folderHR.id,       position: 1, createdById: admin.id },
    { title: 'Payroll & Slip Gaji',          url: 'https://drive.google.com',                   description: 'Rekap gaji dan slip bulanan',                              folderId: folderHR.id,       position: 2, createdById: hr.id    },
    { title: 'Accurate Online',              url: 'https://accurate.id',                        description: 'Software akuntansi utama perusahaan',                      folderId: folderFinance.id,  position: 0, createdById: admin.id },
    { title: 'KlikBCA Corporate',            url: 'https://klikbca.com',                        description: 'Internet banking rekening operasional',                    folderId: folderFinance.id,  position: 1, createdById: admin.id },
    { title: 'E-Filing DJP Online',          url: 'https://djponline.pajak.go.id',              description: 'Pelaporan pajak perusahaan',                               folderId: folderFinance.id,  position: 2, createdById: finance.id },
    { title: 'SOP Operasional Gedung',       url: 'https://drive.google.com',                   description: 'Kumpulan SOP teknis dan prosedur operasional terbaru',     folderId: folderProperty.id, position: 0, createdById: pm.id    },
    { title: 'CCTV Monitoring',              url: 'http://192.168.1.100',                       description: 'Dashboard remote monitoring CCTV seluruh area gedung',    folderId: folderProperty.id, position: 1, createdById: pm.id    },
    { title: 'Portal PLN Icon+',             url: 'https://iconpln.co.id',                      description: 'Monitoring tagihan dan gangguan listrik gedung',           folderId: folderProperty.id, position: 2, createdById: engineer.id },
    { title: 'SIMBG — Izin Bangunan',        url: 'https://simbg.pu.go.id',                    description: 'Sistem Informasi Manajemen Bangunan Gedung',               folderId: folderLegal.id,    position: 0, createdById: admin.id },
    { title: 'OSS — Perizinan Berusaha',     url: 'https://oss.go.id',                         description: 'Portal perizinan usaha online pemerintah',                 folderId: folderLegal.id,    position: 1, createdById: admin.id },
    { title: 'Looker Studio Dashboard',      url: 'https://lookerstudio.google.com',            description: 'Laporan kinerja operasional bulanan manajemen',            folderId: folderMgmt.id,     position: 0, createdById: admin.id },
    { title: 'Google Workspace Admin',       url: 'https://admin.google.com',                   description: 'Kelola akun email dan akses G Suite seluruh karyawan',    folderId: folderMgmt.id,     position: 1, createdById: admin.id },
  ]});
  console.log('✅ Database folders & links created');

  // ── Notifications ──────────────────────────────────────────
  await prisma.notification.createMany({ data: [
    { type: NotificationType.TASK_ASSIGNED, title: 'Task Baru Ditugaskan', message: 'Super Admin menugaskan kamu: "Audit Laporan Keuangan Q1 2026". Segera review dan konfirmasi.', link: '/tasks', isRead: false, userId: finance.id, actorId: admin.id },
    { type: NotificationType.TASK_ASSIGNED, title: 'Task Baru Ditugaskan', message: 'Super Admin menugaskan kamu: "Koordinasi Pemeliharaan Lift Tower B". Due besok.', link: '/tasks', isRead: false, userId: engineer.id, actorId: admin.id },
    { type: NotificationType.TASK_ASSIGNED, title: 'Task Baru Ditugaskan', message: 'Andi Pratama menugaskan kamu: "Review Kontrak Sewa Tenant Baru Lantai 12".', link: '/tasks', isRead: false, userId: admin.id, actorId: director.id },
    { type: NotificationType.TASK_ASSIGNED, title: 'Task Diterima', message: 'Sari Dewi menerima task "Onboarding 3 Staff Baru Divisi Property" dan mulai mengerjakan.', link: '/tasks', isRead: false, userId: admin.id, actorId: hr.id },
    { type: NotificationType.TASK_ASSIGNED, title: 'Task Ditolak', message: 'Andi Pratama menolak task "Presentasi Proposal Ekspansi Retail": Proposal belum cukup matang. Data market research perlu dilengkapi dulu.', link: '/tasks', isRead: false, userId: admin.id, actorId: director.id },
    { type: NotificationType.TASK_ASSIGNED, title: 'Task Diterima', message: 'Reza Maulana menerima task "Pengecatan Ulang Lobby dan Koridor Tower A".', link: '/tasks', isRead: true, userId: pm.id, actorId: engineer.id },
    { type: NotificationType.BULLETIN_URGENT, title: 'Pengumuman Urgent', message: 'Dimas Wijaya memposting pengumuman penting: "Pemeliharaan Lift Tower A — Sabtu 7 Juni 2026".', link: '/bulletin', isRead: false, userId: admin.id, actorId: pm.id },
    { type: NotificationType.BULLETIN_NEW, title: 'Pengumuman Baru', message: 'Sari Dewi memposting pengumuman: "Pembaruan Kebijakan Absensi Per 1 Juli 2026". Mohon dibaca.', link: '/bulletin', isRead: false, userId: engineer.id, actorId: hr.id },
    { type: NotificationType.SYSTEM, title: 'Selamat Datang di SAN Group System', message: 'Akun kamu sudah aktif. Mulai kelola tugas, baca pengumuman, dan akses dokumen penting di sini.', link: '/dashboard', isRead: true, userId: finance.id, actorId: null },
    { type: NotificationType.TASK_COMPLETED, title: 'Task Selesai', message: 'Reza Maulana menyelesaikan subtask "Finalisasi pilihan warna dengan manajemen".', link: '/tasks', isRead: false, userId: pm.id, actorId: engineer.id },
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
