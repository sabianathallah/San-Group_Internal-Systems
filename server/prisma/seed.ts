import { PrismaClient, Role, Division, TaskStatus, TaskPriority, TaskCategory, BulletinCategory, BulletinPriority, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sangroup.id' },
    update: {},
    create: {
      email: 'admin@sangroup.id',
      username: 'superadmin',
      password: await hash('admin123'),
      fullName: 'Super Admin',
      phone: '08100000000',
      role: Role.SUPER_ADMIN,
      division: Division.MANAGEMENT,
      isActive: true,
    },
  });

  const director = await prisma.user.upsert({
    where: { email: 'director.retail@sangroup.id' },
    update: {},
    create: {
      email: 'director.retail@sangroup.id',
      username: 'director.retail',
      password: await hash('password123'),
      fullName: 'Andi Pratama',
      phone: '08111111111',
      role: Role.DIRECTOR,
      division: Division.RETAIL,
      isActive: true,
    },
  });

  const propertyManager = await prisma.user.upsert({
    where: { email: 'pm@sangroup.id' },
    update: {},
    create: {
      email: 'pm@sangroup.id',
      username: 'property.manager',
      password: await hash('password123'),
      fullName: 'Dimas Wijaya',
      phone: '08111222222',
      role: Role.PROPERTY_MANAGER,
      division: Division.PROPERTY,
      isActive: true,
    },
  });

  const hrManager = await prisma.user.upsert({
    where: { email: 'hr@sangroup.id' },
    update: {},
    create: {
      email: 'hr@sangroup.id',
      username: 'hr.manager',
      password: await hash('password123'),
      fullName: 'Sari Dewi',
      phone: '08122222222',
      role: Role.HR_MANAGER,
      division: Division.HR,
      isActive: true,
    },
  });

  const financeManager = await prisma.user.upsert({
    where: { email: 'finance@sangroup.id' },
    update: {},
    create: {
      email: 'finance@sangroup.id',
      username: 'finance.manager',
      password: await hash('password123'),
      fullName: 'Budi Santoso',
      phone: '08133333333',
      role: Role.FINANCE_MANAGER,
      division: Division.FINANCE,
      isActive: true,
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@sangroup.id' },
    update: {},
    create: {
      email: 'engineer@sangroup.id',
      username: 'chief.engineer',
      password: await hash('password123'),
      fullName: 'Reza Maulana',
      phone: '08144444444',
      role: Role.CHIEF_ENGINEER,
      division: Division.ENGINEERING,
      isActive: true,
    },
  });

  // alias for seed references below
  const bm = propertyManager;
  const hrd = hrManager;
  const finance = financeManager;

  console.log('✅ Users created');

  // ── Task Lists ─────────────────────────────────────────────
  const myDayList = await prisma.taskList.upsert({
    where: { id: 'seed-list-myday' },
    update: {},
    create: {
      id: 'seed-list-myday',
      name: 'Hari Ini',
      color: '#6366f1',
      icon: '☀️',
      userId: admin.id,
      position: 0,
    },
  });

  const projectList = await prisma.taskList.upsert({
    where: { id: 'seed-list-project' },
    update: {},
    create: {
      id: 'seed-list-project',
      name: 'Project Q1',
      color: '#10b981',
      icon: '🏗️',
      userId: admin.id,
      position: 1,
    },
  });

  console.log('✅ Task lists created');

  // ── Tasks ──────────────────────────────────────────────────
  const tasks = [
    {
      id: 'seed-task-1',
      title: 'Review laporan keuangan bulan ini',
      description: 'Cek dan validasi laporan keuangan dari tim finance sebelum diserahkan ke owner.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      category: TaskCategory.MY_DAY,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      userId: admin.id,
      assignedToId: finance.id,
      listId: myDayList.id,
      position: 0,
    },
    {
      id: 'seed-task-2',
      title: 'Koordinasi jadwal maintenance AC tower A',
      description: 'Atur jadwal maintenance rutin AC lantai 3-10 Tower A bersama tim engineering.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      category: TaskCategory.PLANNED,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      userId: admin.id,
      assignedToId: engineer.id,
      listId: myDayList.id,
      position: 1,
    },
    {
      id: 'seed-task-3',
      title: 'Siapkan dokumen onboarding karyawan baru',
      description: 'Lengkapi semua dokumen kontrak, NDA, dan orientasi untuk 2 karyawan baru bulan ini.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      category: TaskCategory.IMPORTANT,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      userId: admin.id,
      assignedToId: hrd.id,
      listId: null,
      position: 0,
    },
    {
      id: 'seed-task-4',
      title: 'Update SOP kebersihan gedung',
      description: 'Revisi dan update SOP kebersihan sesuai standar baru yang telah disetujui manajemen.',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      category: TaskCategory.PLANNED,
      dueDate: null,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      userId: bm.id,
      assignedToId: null,
      listId: projectList.id,
      position: 0,
    },
    {
      id: 'seed-task-5',
      title: 'Setup sistem monitoring utilitas gedung',
      description: 'Implementasi dashboard monitoring listrik, air, dan gas real-time untuk semua lantai.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      category: TaskCategory.MY_DAY,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userId: admin.id,
      assignedToId: engineer.id,
      listId: projectList.id,
      position: 1,
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: task,
    });
  }

  console.log('✅ Tasks created');

  // ── Sticky Notes ───────────────────────────────────────────
  const stickyNotes = [
    {
      id: 'seed-note-1',
      title: 'Meeting Owner',
      content: 'Rabu 15:00 - Presentasi progress Q1 ke Owner. Siapkan deck dan laporan keuangan.',
      color: 'yellow',
      isPinned: true,
      position: 0,
      userId: admin.id,
    },
    {
      id: 'seed-note-2',
      title: 'Kontak PLN',
      content: 'Telp: 123\nEmail: pln-jakarta@pln.co.id\nNo. Pelanggan: 542100000001',
      color: 'blue',
      isPinned: true,
      position: 1,
      userId: admin.id,
    },
    {
      id: 'seed-note-3',
      title: null,
      content: 'Jangan lupa perpanjang kontrak vendor security bulan depan!',
      color: 'pink',
      isPinned: false,
      position: 2,
      userId: admin.id,
    },
    {
      id: 'seed-note-4',
      title: 'Password WiFi Kantor',
      content: 'SSID: SAN-OFFICE-5G\nPass: sangroup2024',
      color: 'green',
      isPinned: false,
      position: 3,
      userId: bm.id,
    },
    {
      id: 'seed-note-5',
      title: 'Reminder Bulanan',
      content: '- Laporan utilitas tanggal 25\n- Absen karyawan tanggal 27\n- Review vendor tanggal 28',
      color: 'purple',
      isPinned: false,
      position: 4,
      userId: admin.id,
    },
  ];

  for (const note of stickyNotes) {
    await prisma.stickyNote.upsert({
      where: { id: note.id },
      update: {},
      create: note,
    });
  }

  console.log('✅ Sticky notes created');

  // ── Bulletins ──────────────────────────────────────────────
  const bulletins = [
    {
      id: 'seed-bulletin-1',
      title: 'Libur Nasional — Hari Raya Idul Fitri 1446 H',
      content: `<p>Diberitahukan kepada seluruh karyawan SAN Group bahwa perusahaan akan <strong>libur selama 5 hari</strong> dalam rangka Hari Raya Idul Fitri 1446 H.</p><p>Tanggal libur: <strong>28 Maret – 1 April 2025</strong></p><p>Karyawan yang bertugas on-call harap konfirmasi ke atasan masing-masing. Selamat Idul Fitri, mohon maaf lahir dan batin.</p>`,
      category: BulletinCategory.HOLIDAY,
      priority: BulletinPriority.IMPORTANT,
      isPublished: true,
      publishedAt: new Date('2025-03-20'),
      expiresAt: new Date('2025-04-02'),
      authorId: admin.id,
    },
    {
      id: 'seed-bulletin-2',
      title: '[URGENT] Pemadaman Listrik Terjadwal — Tower B Lantai 5-10',
      content: `<p>Tim engineering akan melakukan penggantian panel listrik di Tower B lantai 5-10.</p><p><strong>Jadwal:</strong> Sabtu, 22 Maret 2025 pukul 08:00 – 14:00 WIB</p><p>Seluruh penghuni dan tenant di lantai tersebut dimohon untuk mempersiapkan diri. Lift Tower B akan non-aktif selama proses berlangsung. Generator backup akan aktif untuk area common.</p><p>Mohon maaf atas ketidaknyamanannya. — Tim Engineering</p>`,
      category: BulletinCategory.MAINTENANCE,
      priority: BulletinPriority.URGENT,
      isPublished: true,
      publishedAt: new Date('2025-03-19'),
      expiresAt: new Date('2025-03-23'),
      authorId: bm.id,
    },
    {
      id: 'seed-bulletin-3',
      title: 'Selamat Datang di SAN Group Internal System!',
      content: `<p>Kami dengan bangga memperkenalkan <strong>SAN Group Internal Management System</strong> — platform digital terpadu untuk mendukung operasional harian seluruh karyawan.</p><p>Fitur yang tersedia saat ini:</p><ul><li>✅ Task Management — kelola dan assign tugas</li><li>✅ Sticky Notes — catatan cepat personal</li><li>✅ Bulletin Board — pengumuman resmi perusahaan</li><li>✅ Database Links — akses cepat ke dokumen & link penting</li></ul><p>Fitur lain akan terus ditambahkan. Untuk pertanyaan atau bug, hubungi tim IT.</p>`,
      category: BulletinCategory.ANNOUNCEMENT,
      priority: BulletinPriority.NORMAL,
      isPublished: true,
      publishedAt: new Date(),
      expiresAt: null,
      authorId: admin.id,
    },
  ];

  for (const bulletin of bulletins) {
    await prisma.bulletin.upsert({
      where: { id: bulletin.id },
      update: {},
      create: bulletin,
    });
  }

  console.log('✅ Bulletins created');

  // ── Database Folders & Links ───────────────────────────────
  const folderHR = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-hr' },
    update: {},
    create: { id: 'seed-folder-hr', name: 'HR & People', icon: '👥', color: '#ec4899', position: 0, createdById: admin.id },
  });
  const folderFinance = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-finance' },
    update: {},
    create: { id: 'seed-folder-finance', name: 'Finance', icon: '💰', color: '#10b981', position: 1, createdById: admin.id },
  });
  const folderProperty = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-property' },
    update: {},
    create: { id: 'seed-folder-property', name: 'Property & Operasional', icon: '🏢', color: '#3b82f6', position: 2, createdById: admin.id },
  });
  const folderLegal = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-legal' },
    update: {},
    create: { id: 'seed-folder-legal', name: 'Legal & Perizinan', icon: '⚖️', color: '#8b5cf6', position: 3, createdById: admin.id },
  });
  const folderMgmt = await prisma.databaseFolder.upsert({
    where: { id: 'seed-folder-mgmt' },
    update: {},
    create: { id: 'seed-folder-mgmt', name: 'Manajemen', icon: '📊', color: '#6366f1', position: 4, createdById: admin.id },
  });

  const dbLinks = [
    { id: 'seed-link-1', title: 'Google Drive HR', url: 'https://drive.google.com', description: 'Folder utama dokumen HR: kontrak, SK, BPJS', folderId: folderHR.id, position: 0, createdById: admin.id },
    { id: 'seed-link-2', title: 'BPJS Ketenagakerjaan', url: 'https://sso.bpjsketenagakerjaan.go.id', description: 'Portal klaim dan pengecekan BPJS', folderId: folderHR.id, position: 1, createdById: admin.id },
    { id: 'seed-link-3', title: 'Accurate Online', url: 'https://accurate.id', description: 'Software akuntansi utama', folderId: folderFinance.id, position: 0, createdById: admin.id },
    { id: 'seed-link-4', title: 'iBanking BCA Corporate', url: 'https://klikbca.com', description: 'Rekening operasional perusahaan', folderId: folderFinance.id, position: 1, createdById: admin.id },
    { id: 'seed-link-5', title: 'SOP Operasional Gedung', url: 'https://drive.google.com', description: 'Kumpulan SOP teknis terbaru', folderId: folderProperty.id, position: 0, createdById: bm.id },
    { id: 'seed-link-6', title: 'CCTV Monitoring', url: 'http://192.168.1.100', description: 'Remote monitoring CCTV gedung', folderId: folderProperty.id, position: 1, createdById: bm.id },
    { id: 'seed-link-7', title: 'Portal PLN Icon+', url: 'https://iconpln.co.id', description: 'Monitoring tagihan listrik gedung', folderId: folderProperty.id, position: 2, createdById: engineer.id },
    { id: 'seed-link-8', title: 'SIMBG', url: 'https://simbg.pu.go.id', description: 'Sistem Informasi Manajemen Bangunan Gedung', folderId: folderLegal.id, position: 0, createdById: admin.id },
    { id: 'seed-link-9', title: 'Dashboard Reporting', url: 'https://lookerstudio.google.com', description: 'Laporan kinerja bulanan manajemen', folderId: folderMgmt.id, position: 0, createdById: admin.id },
    { id: 'seed-link-10', title: 'Canva Team SAN', url: 'https://canva.com', description: 'Template desain marketing', folderId: folderMgmt.id, position: 1, createdById: admin.id },
  ];

  for (const link of dbLinks) {
    await prisma.databaseLink.upsert({ where: { id: link.id }, update: {}, create: link });
  }

  console.log('✅ Database folders & links created');

  // ── Notifications ──────────────────────────────────────────
  const notifications = [
    {
      id: 'seed-notif-1',
      type: NotificationType.TASK_ASSIGNED,
      title: 'Tugas Baru Ditugaskan',
      message: 'Super Admin menugaskan kamu untuk "Review laporan keuangan bulan ini"',
      link: '/tasks',
      isRead: false,
      userId: finance.id,
      actorId: admin.id,
    },
    {
      id: 'seed-notif-2',
      type: NotificationType.TASK_ASSIGNED,
      title: 'Tugas Baru Ditugaskan',
      message: 'Super Admin menugaskan kamu untuk "Koordinasi jadwal maintenance AC tower A"',
      link: '/tasks',
      isRead: false,
      userId: engineer.id,
      actorId: admin.id,
    },
    {
      id: 'seed-notif-3',
      type: NotificationType.TASK_ASSIGNED,
      title: 'Tugas Baru Ditugaskan',
      message: 'Super Admin menugaskan kamu untuk "Siapkan dokumen onboarding karyawan baru"',
      link: '/tasks',
      isRead: true,
      userId: hrd.id,
      actorId: admin.id,
    },
    {
      id: 'seed-notif-4',
      type: NotificationType.BULLETIN_URGENT,
      title: 'Pengumuman Urgent',
      message: 'Andi Pratama memposting pengumuman urgent: "Pemadaman Listrik Terjadwal — Tower B Lantai 5-10"',
      link: '/bulletin',
      isRead: false,
      userId: admin.id,
      actorId: bm.id,
    },
    {
      id: 'seed-notif-5',
      type: NotificationType.TASK_COMPLETED,
      title: 'Tugas Selesai',
      message: 'Andi Pratama menyelesaikan tugas "Update SOP kebersihan gedung"',
      link: '/tasks',
      isRead: false,
      userId: admin.id,
      actorId: bm.id,
    },
    {
      id: 'seed-notif-6',
      type: NotificationType.SYSTEM,
      title: 'Selamat Datang!',
      message: 'Akun kamu telah berhasil dibuat. Mulai kelola tugas dan pantau pengumuman di sini.',
      link: '/dashboard',
      isRead: false,
      userId: engineer.id,
      actorId: null,
    },
  ];

  for (const notif of notifications) {
    await prisma.notification.upsert({
      where: { id: notif.id },
      update: {},
      create: notif,
    });
  }

  console.log('✅ Notifications created');

  // ── BulletinReadStatus ─────────────────────────────────────
  await prisma.bulletinReadStatus.upsert({
    where: { bulletinId_userId: { bulletinId: 'seed-bulletin-3', userId: admin.id } },
    update: {},
    create: {
      bulletinId: 'seed-bulletin-3',
      userId: admin.id,
    },
  });

  await prisma.bulletinReadStatus.upsert({
    where: { bulletinId_userId: { bulletinId: 'seed-bulletin-1', userId: hrd.id } },
    update: {},
    create: {
      bulletinId: 'seed-bulletin-1',
      userId: hrd.id,
    },
  });

  console.log('✅ Bulletin read statuses created');

  console.log('\n🎉 Seeding selesai!');
  console.log('─────────────────────────────');
  console.log('Login credentials:');
  console.log('  Super Admin      : admin@sangroup.id / admin123');
  console.log('  Director Retail  : director.retail@sangroup.id / password123');
  console.log('  Property Manager : pm@sangroup.id / password123');
  console.log('  HR Manager       : hr@sangroup.id / password123');
  console.log('  Finance Manager  : finance@sangroup.id / password123');
  console.log('  Chief Engineer   : engineer@sangroup.id / password123');
  console.log('─────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
