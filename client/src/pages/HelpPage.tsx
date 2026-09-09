import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, CheckSquare2, Bell, StickyNote, Database, BarChart3, Inbox,
  Lightbulb, ChevronRight, Building2, Clock, CalendarDays, ClipboardList,
  FileBarChart2, CalendarClock, MapPin, CalendarOff, Tags,
  Wrench, Plus, RefreshCw, ClipboardCheck, Archive, HardHat,
  Search, X, ShieldCheck, Users, Shield, User, UserCog,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useClickOutside } from '@/hooks/useClickOutside';

// ── Bilingual content ───────────────────────────────────────
// Kept inline (rather than sprawled across hundreds of individual i18n
// keys in the shared locale files) since this is long-form documentation
// text edited as whole paragraphs, not short UI labels — one bilingual
// block per section is far easier to keep in sync than two JSON files.
interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  intro: string;
  image: string;
  imageAlt: string;
  tips: string[];
}

const CONTENT: Record<'id' | 'en', { pageTitle: string; pageSubtitle: string; tipsLabel: string; sections: Section[] }> = {
  id: {
    pageTitle: 'Panduan Penggunaan',
    pageSubtitle: 'Cara pakai tiap modul di SAN Group Internal System — lengkap dengan tangkapan layar asli.',
    tipsLabel: 'Tips',
    sections: [
      {
        id: 'dashboard',
        icon: LayoutDashboard,
        title: 'Dashboard',
        intro: 'Halaman pertama yang kamu lihat setelah login. Menampilkan ringkasan cepat: task hari ini, status absensi, sticky notes, dan akses cepat ke semua modul.',
        image: '/help/dashboard.jpg',
        imageAlt: 'Tampilan halaman Dashboard',
        tips: [
          '"To Do Hari Ini" menampilkan task yang ada di My Day kamu — bukan semua task.',
          'Klik "Check In" untuk absen langsung dari Dashboard, tanpa perlu buka modul HRIS.',
          'Panel "Akses Cepat" di kanan adalah jalan pintas ke Task, Bulletin, Catatan, DB Links, dan modul lain.',
          '"Divisi Saya" menunjukkan statistik task divisimu — jumlahnya beda-beda tergantung role kamu.',
        ],
      },
      {
        id: 'tasks',
        icon: CheckSquare2,
        title: 'Tasks',
        intro: 'Modul manajemen task paling lengkap — mirip gabungan Microsoft To Do dan Notion. Sidebar kiri punya beberapa "sudut pandang" berbeda untuk task yang sama.',
        image: '/help/tasks-list.jpg',
        imageAlt: 'Tampilan List view di halaman Tasks',
        tips: [
          '**My Day**: task yang mau kamu kerjakan hari ini (kamu pilih sendiri, direset tiap hari).',
          '**Penting**: task yang kamu tandai bintang — tidak terkait tanggal sama sekali.',
          '**Terjadwal**: semua task yang punya tenggat waktu, dikelompokkan per rentang waktu (hari ini, besok, minggu ini, dst).',
          '**Ditugaskan ke Saya**: task dari orang lain untukmu, termasuk yang belum kamu terima/tolak.',
          '**Task Saya**: SEMUA task milikmu — baik buatan sendiri maupun yang ditugaskan ke kamu.',
          '**Semua Task**: task orang lain yang dibagikan ke kamu — bukan task milikmu sendiri. Ini yang paling sering bikin bingung karena namanya kedengaran "semua", padahal maksudnya "yang di-share".',
          'Arahkan mouse ke tiap item sidebar (tanpa klik) untuk lihat penjelasan singkatnya.',
        ],
      },
      {
        id: 'tasks-views',
        icon: CheckSquare2,
        title: 'Tasks — Board, Kalender, Tabel',
        intro: 'Selain List, task bisa ditampilkan sebagai papan Kanban (Board), kalender bulanan, atau tabel yang bisa diurutkan.',
        image: '/help/tasks-board-drag.gif',
        imageAlt: 'Animasi drag & drop kartu task antar kolom di Board',
        tips: [
          'Di **Board**, drag & drop kartu antar kolom untuk ubah status task (To Do → Selesai, dst).',
          'Di **Kalender**, drag chip task ke tanggal untuk atur/ubah tenggat waktu — atau klik tanggal kosong untuk buat task baru langsung di hari itu.',
          'Di **Tabel**, klik header kolom untuk urutkan (misal berdasarkan tenggat atau prioritas).',
          'Tekan `N` di keyboard untuk cepat buat task baru dari mana saja di halaman ini, dan `Esc` untuk menutup dialog yang lagi terbuka.',
          'Kalau task terpilih (di List/Tabel), tekan `Space` untuk tandai selesai — sistem akan cek dulu apakah semua subtask-nya sudah kelar.',
        ],
      },
      {
        id: 'tasks-detail',
        icon: CheckSquare2,
        title: 'Tasks — Detail & Subtask',
        intro: 'Klik task apapun untuk buka panel detail di kanan — semua pengaturan task ada di sini: prioritas, tenggat, siapa yang ditugaskan, sampai siapa saja yang bisa lihat.',
        image: '/help/tasks-detail.jpg',
        imageAlt: 'Panel detail task',
        tips: [
          '**Bagikan ke** mengatur siapa yang bisa MELIHAT task ini secara horizontal (rekan kerja): Hanya Saya, Divisi Saya, Pilih Divisi, atau Semua Staf.',
          'Atasan (yang levelnya lebih tinggi & sedivisi) selalu bisa lihat task bawahannya lewat Task Tim, apapun pengaturan "Bagikan ke"-nya.',
          'Centang **"Rahasia"** kalau task ini benar-benar tidak boleh dilihat atasan — ini satu-satunya cara untuk itu.',
          'Subtask bisa dibuat 1 level ke bawah (subtask tidak bisa punya subtask lagi), lengkap dengan progress bar otomatis.',
          'Klik subtask untuk masuk ke halamannya sendiri — ada tombol "Kembali ke parent" untuk balik ke task induk.',
        ],
      },
      {
        id: 'bulletin',
        icon: Bell,
        title: 'Bulletin',
        intro: 'Papan pengumuman perusahaan. Semua pengumuman yang dipublikasikan tampil di sini, diurutkan berdasarkan prioritas lalu tanggal.',
        image: '/help/bulletin.jpg',
        imageAlt: 'Tampilan halaman Bulletin',
        tips: [
          'Warna kartu menandakan prioritas: merah = Mendesak, kuning = Penting, abu-abu = Normal.',
          'Filter kategori (Pengumuman, Libur, Maintenance, dst) ada di bawah kolom pencarian.',
          'Titik biru kecil di judul menandakan bulletin yang belum kamu baca — tapi tandanya cuma bertahan beberapa detik setelah halaman dibuka, jadi perhatikan begitu halaman terbuka.',
          'Kalau kamu punya izin, tab "Terjadwal" dipakai untuk atur pengumuman berulang (misal reminder mingguan) yang otomatis terbit sesuai jadwal.',
        ],
      },
      {
        id: 'notes',
        icon: StickyNote,
        title: 'Notes',
        intro: 'Catatan tempel pribadi untuk hal-hal cepat: nomor kontak, checklist, pengingat rapat. Sifatnya pribadi — tidak ada yang lain bisa lihat catatanmu.',
        image: '/help/notes.jpg',
        imageAlt: 'Tampilan halaman Notes',
        tips: [
          'Klik ikon pin untuk sematkan catatan penting ke bagian atas.',
          'Pilih salah satu dari 7 warna untuk mengelompokkan catatan secara visual (misal kuning = penting, biru = kontak).',
          'Gunakan kolom pencarian atau filter warna di atas untuk cari catatan lama dengan cepat.',
          'Judul catatan itu opsional — kalau dikosongkan, catatan cukup ditampilkan lewat isinya saja.',
        ],
      },
      {
        id: 'dblinks',
        icon: Database,
        title: 'DB Links',
        intro: 'Direktori tautan (link) penting perusahaan, dikelompokkan per folder — misal software akuntansi, internet banking, portal HR.',
        image: '/help/dblinks.jpg',
        imageAlt: 'Tampilan halaman DB Links',
        tips: [
          'Klik folder untuk buka isinya — link disusun berdasarkan urutan yang bisa diatur ulang.',
          'Klik nama link untuk buka di tab baru; URL aslinya sengaja disembunyikan supaya tampilan tetap rapi.',
          'Kalau kamu admin folder tersebut (atau yang membuatnya), ada tombol edit/hapus saat hover di baris link.',
          'Folder bisa dibagikan ke divisi lain lewat tombol "Bagikan" — berguna kalau satu folder relevan untuk lebih dari satu tim.',
        ],
      },
      {
        id: 'analytics',
        icon: BarChart3,
        title: 'Analytics',
        intro: 'Dashboard produktivitas tim — total task, tren penyelesaian, distribusi prioritas, sampai leaderboard kontributor. Cakupan datanya (pribadi/divisi/semua) tergantung role kamu.',
        image: '/help/analytics.jpg',
        imageAlt: 'Tampilan halaman Analytics dengan filter aktif',
        tips: [
          'Ganti rentang waktu (7/30/90 hari) dan filter divisi/prioritas/assignee di baris paling atas — grafik langsung ter-update.',
          'Klik **"Kustomisasi"** untuk sembunyikan widget yang tidak relevan buatmu — pengaturan ini otomatis tersimpan untuk kunjungan berikutnya.',
          'Arahkan mouse ke grafik batang untuk lihat angka pastinya per hari (tooltip).',
          'Tombol **"Ekspor CSV"** mengunduh semua data sesuai filter yang sedang aktif — cocok untuk laporan ke atasan.',
          'Widget "Usia Keterlambatan" mengelompokkan task yang telat berdasarkan sudah berapa lama telatnya — makin gelap warnanya, makin lama telat.',
        ],
      },
      {
        id: 'notifications',
        icon: Inbox,
        title: 'Notifikasi',
        intro: 'Semua pemberitahuan sistem: task baru, task diterima/ditolak, pengumuman mendesak, pengajuan cuti, dan lainnya.',
        image: '/help/notifications.jpg',
        imageAlt: 'Tampilan halaman Notifikasi',
        tips: [
          'Klik notifikasi untuk langsung dibawa ke halaman terkait (misal ke task yang dimaksud) — sekaligus otomatis menandainya sudah dibaca.',
          'Tombol lonceng di header punya dropdown ringkas untuk cek notifikasi tanpa pindah halaman.',
          '"Tandai Semua Dibaca" langsung membersihkan semua badge angka merah di sidebar dan header.',
          'Notifikasi baru juga muncul sebagai pop-up kecil (toast) di pojok layar — klik untuk langsung buka.',
        ],
      },
      {
        id: 'hris-overview',
        icon: Building2,
        title: 'HRIS — Ringkasan',
        intro: 'Halaman pertama modul HRIS. Menampilkan status kehadiran hari ini, tombol Check In/Check Out, saldo cuti tahun berjalan, dan daftar pengajuan cuti terbaru.',
        image: '/help/hris-overview.jpg',
        imageAlt: 'Tampilan halaman Ringkasan HRIS',
        tips: [
          'Tombol **Check In**/**Check Out** ada di kartu biru gelap paling atas — status berubah otomatis begitu kamu absen.',
          'Kartu "Saldo Cuti" menampilkan sisa kuota per jenis cuti (Annual Leave, WFH Special, dst) — beberapa jenis seperti Sick Leave tidak punya kuota tetap ("Sesuai kebutuhan").',
          'Panel "Pengajuan Cuti" menunjukkan 4 status: Menunggu, Disetujui, Ditolak, Dibatalkan.',
          'Ringkasan angka Hadir/Terlambat/WFH/Cuti/Tidak Hadir di bagian atas mengikuti bulan berjalan.',
        ],
      },
      {
        id: 'hris-attendance',
        icon: Clock,
        title: 'HRIS — Absensi',
        intro: 'Rekap absensi bulanan dalam bentuk kalender, lengkap dengan log harian (jam check-in/out, durasi kerja, lokasi, dan foto absen).',
        image: '/help/hris-attendance.jpg',
        imageAlt: 'Tampilan halaman Absensi HRIS',
        tips: [
          'Toggle **Saya** / **Tim — Semua** di kanan atas untuk beralih antara absensimu sendiri dan absensi tim (khusus atasan/HR).',
          'Klik tanggal apapun di kalender untuk lihat detail absensi hari itu — status ditandai warna (Alpa = merah, dst).',
          'Gunakan panah `<` `>` di sebelah nama bulan untuk pindah ke bulan lain.',
          'Tabel "Log Absensi" di bawah kalender berisi rincian per hari: Check In, Check Out, Durasi, Lokasi, dan foto (kalau perusahaan mewajibkan foto saat absen).',
        ],
      },
      {
        id: 'hris-leave',
        icon: CalendarDays,
        title: 'HRIS — Cuti',
        intro: 'Ajukan cuti baru dan pantau saldo tiap jenis cuti (Annual Leave, Sick Leave, Emergency Leave, WFH Special, Special Leave, Comp Off).',
        image: '/help/hris-leave.jpg',
        imageAlt: 'Tampilan halaman Cuti HRIS',
        tips: [
          'Klik **"Ajukan Cuti"** di kanan atas untuk buka form pengajuan — pilih jenis cuti, tanggal mulai/selesai, dan alasan.',
          'Tombol **"Comp Off"** khusus untuk mengajukan cuti pengganti dari lembur/kerja di hari libur.',
          'Filter status (Semua, Menunggu, Disetujui, Ditolak, Dibatalkan) ada di bawah kartu saldo — pakai ini untuk cari pengajuan tertentu.',
          'Jenis cuti yang perlu dokumen (misal Sick Leave) akan minta lampiran file saat pengajuan — muncul sebagai tautan di kartu riwayat.',
          'Toggle **Saya** / **Tim** di kanan atas dipakai atasan/HR untuk melihat & menyetujui pengajuan cuti anak buahnya.',
        ],
      },
      {
        id: 'hris-requests',
        icon: ClipboardList,
        title: 'HRIS — Pengajuan',
        intro: 'Tempat mengajukan izin keterlambatan dan pengajuan perubahan shift — dua hal yang beda dari pengajuan cuti biasa.',
        image: '/help/hris-requests.jpg',
        imageAlt: 'Tampilan halaman Pengajuan HRIS',
        tips: [
          'Tab **"Izin Terlambat"**: laporkan lebih dulu kalau kamu tahu bakal telat, lengkap dengan estimasi jam kedatangan dan alasannya.',
          'Tab **"Perubahan Shift"**: ajukan pertukaran atau perubahan jadwal shift kerja.',
          'Filter status (Menunggu, Disetujui, Ditolak, Dibatalkan) sama seperti di halaman Cuti.',
          'Pengajuan yang masih "Menunggu" bisa dibatalkan sendiri lewat tombol di kartu pengajuan.',
        ],
      },
      {
        id: 'hris-reports',
        icon: FileBarChart2,
        title: 'HRIS — Laporan Absensi',
        intro: 'Rekap absensi seluruh karyawan dalam satu bulan, dengan ringkasan Hadir/Terlambat/Alpa/WFH/Di Luar Area serta rata-rata tingkat kehadiran. Hanya bisa diakses role tertentu (HR/manajemen).',
        image: '/help/hris-reports.jpg',
        imageAlt: 'Tampilan halaman Laporan Absensi HRIS',
        tips: [
          'Filter **"Semua Divisi"** di kanan atas untuk mempersempit laporan ke divisi tertentu.',
          'Kolom pencarian "Cari karyawan..." langsung memfilter tabel di bawahnya.',
          'Tombol **"Ekspor CSV"** mengunduh laporan bulan yang sedang ditampilkan sesuai filter aktif.',
          'Kolom H/T/WFH/A di tabel adalah singkatan dari Hadir/Terlambat/WFH/Alpa untuk tiap karyawan.',
        ],
      },
      {
        id: 'hris-admin-shifts',
        icon: CalendarClock,
        title: 'HRIS — Kelola Shift (Admin)',
        intro: 'Halaman admin untuk membuat jenis shift kerja (jam masuk-pulang, toleransi keterlambatan) dan menetapkan shift ke tiap karyawan.',
        image: '/help/hris-admin-shifts.jpg',
        imageAlt: 'Tampilan halaman Kelola Shift HRIS',
        tips: [
          'Klik **"+ Shift Baru"** untuk buat jenis shift baru — atur jam kerja dan toleransi keterlambatan dalam menit.',
          'Shift bertanda **"Default"** otomatis dipakai untuk karyawan baru yang belum ditetapkan shift-nya.',
          'Gunakan dropdown di samping tiap nama karyawan pada bagian "Tetapkan Shift Karyawan" untuk pindahkan orang ke shift lain.',
          'Kolom pencarian karyawan di kanan atas panel penugasan mempercepat pencarian di tim besar.',
        ],
      },
      {
        id: 'hris-admin-locations',
        icon: MapPin,
        title: 'HRIS — Lokasi Kantor (Admin)',
        intro: 'Atur titik geofencing tempat karyawan boleh absen — tiap lokasi punya koordinat dan radius sendiri.',
        image: '/help/hris-admin-locations.jpg',
        imageAlt: 'Tampilan halaman Lokasi Kantor HRIS',
        tips: [
          'Klik **"+ Tambah Lokasi"** untuk daftarkan kantor/site baru beserta radius geofence-nya (dalam meter).',
          'Klik koordinat pada kartu lokasi untuk membuka titik tersebut langsung di Google Maps.',
          'Karyawan bisa absen dari lokasi aktif mana pun — kalau berada di luar semua radius, sistem akan tampilkan peringatan dengan opsi "absen paksa".',
          'Ikon pensil dan tempat sampah di pojok kartu dipakai untuk edit atau hapus lokasi.',
        ],
      },
      {
        id: 'hris-admin-holidays',
        icon: CalendarOff,
        title: 'HRIS — Hari Libur (Admin)',
        intro: 'Kalender hari libur nasional/perusahaan untuk satu tahun — dipakai sistem untuk mengecualikan hari tersebut dari perhitungan cuti dan penandaan alpa otomatis.',
        image: '/help/hris-admin-holidays.jpg',
        imageAlt: 'Tampilan halaman Hari Libur HRIS',
        tips: [
          'Isi tanggal dan nama hari libur di kolom atas, lalu klik **"+ Tambah"**.',
          'Gunakan panah `<` `>` di samping tahun untuk kelola hari libur tahun sebelumnya/berikutnya.',
          'Hari yang sudah didaftarkan di sini otomatis dikecualikan dari perhitungan kuota cuti dan tidak akan ditandai "Alpa" meski karyawan tidak check-in.',
          'Ikon tempat sampah di tiap baris menghapus hari libur tersebut.',
        ],
      },
      {
        id: 'hris-admin-leave-types',
        icon: Tags,
        title: 'HRIS — Jenis Cuti (Admin)',
        intro: 'Kelola semua jenis cuti yang tersedia beserta kebijakannya: kuota tahunan, kewajiban lampiran dokumen, aturan carry-over, dan syarat masa kerja minimum.',
        image: '/help/hris-admin-leave-types.jpg',
        imageAlt: 'Tampilan halaman Jenis Cuti HRIS',
        tips: [
          'Klik **"+ Jenis Baru"** untuk membuat kategori cuti baru selain 6 yang sudah ada secara default.',
          'Badge seperti **"Carry-over"** atau **"Masa kerja 12 bln"** di bawah nama jenis cuti menandakan aturan khusus yang berlaku.',
          'Ikon power di pojok kartu menonaktifkan jenis cuti tanpa menghapus riwayatnya — jenis yang dinonaktifkan hilang dari form pengajuan tapi data lama tetap tersimpan.',
          'Perubahan kuota langsung berlaku ke saldo tahun berjalan; hari carry-over yang sudah ada tetap dipertahankan.',
        ],
      },
      {
        id: 'wo-board',
        icon: Wrench,
        title: 'Work Order — Papan Kerja',
        intro: 'Halaman utama modul Work Order. Semua tiket perbaikan/perawatan tampil sebagai papan Kanban per status atau tabel yang bisa diurutkan — sidebar kiri punya beberapa filter siap pakai untuk mempersempit daftarnya.',
        image: '/help/wo-board-drag.gif',
        imageAlt: 'Animasi drag & drop kartu Work Order antar kolom status',
        tips: [
          '**My Tasks**: work order yang ditugaskan ke kamu sebagai teknisi.',
          '**Reported by Me**: work order yang kamu laporkan sendiri, apapun statusnya.',
          '**Unassigned**: work order yang belum punya teknisi — perlu segera ditugaskan.',
          '**Pending Review**: pekerjaan yang sudah selesai dikerjakan dan menunggu persetujuanmu.',
          'Di tampilan **Board**, drag & drop kartu antar kolom untuk ubah status langsung — menggeser kartu ke kolom "Assigned" otomatis membuka pencarian teknisi.',
          'Klik ikon tabel di pojok kanan atas untuk beralih ke tampilan **Table**, lalu tombol "Export CSV" di sampingnya untuk unduh data sesuai filter aktif.',
          'Bar ringkasan di atas (Active/Pending Review/Overdue/Urgent) hanya menampilkan angka — klik salah satu filter di sidebar untuk benar-benar mempersempit daftar.',
        ],
      },
      {
        id: 'wo-create',
        icon: Plus,
        title: 'Work Order — Buat & Tugaskan',
        intro: 'Klik "Create WO" untuk laporkan masalah baru sekaligus (opsional) langsung menugaskan teknisi — tenggat waktu otomatis terisi berdasarkan prioritas yang dipilih.',
        image: '/help/wo-create.jpg',
        imageAlt: 'Form Create Work Order dengan pencarian teknisi aktif',
        tips: [
          'Field **"Assign to Technician"** adalah kotak pencarian — ketik sebagian nama untuk memfilter, lalu klik untuk memilih. Kosongkan untuk membuat WO tanpa teknisi (masuk status "New").',
          'Due Date (SLA) otomatis diisi sesuai prioritas (Urgent = 1 hari, High = 3 hari, Medium = 7 hari, Low = 14 hari) — ubah manual kapan saja sebelum submit.',
          'WO yang langsung ditugaskan ke teknisi saat dibuat otomatis lompat ke status "Assigned", melewati "New" dan "Validated".',
          'Field **Location** dan **Category** membantu teknisi & laporan mengelompokkan pekerjaan — isi sedetail mungkin (contoh: "Tower A — Lantai 4, Ruang Server").',
        ],
      },
      {
        id: 'wo-status',
        icon: RefreshCw,
        title: 'Work Order — Detail & Alur Status',
        intro: 'Klik kartu manapun untuk buka panel detail di kanan: siapa yang lapor & ditugaskan, timeline riwayat, catatan reviewer, dan foto before/after.',
        image: '/help/wo-status.jpg',
        imageAlt: 'Panel detail Work Order dengan timeline dan foto',
        tips: [
          'Alur status normal: **New → Validated → Assigned → In Progress → Pending Review → Done**. Ada juga jalur "Pending Parts" (menunggu spare part) dan "Cancelled" yang bisa diambil kapan saja selama belum selesai.',
          'Tombol **"Change Status"** hanya menampilkan transisi yang benar-benar valid dari status saat ini — jadi tidak akan salah pilih.',
          'Sebelum bisa pindah ke "Pending Review", sistem mewajibkan minimal 1 foto **"After"** diunggah di bagian Photo Evidence sebagai bukti pekerjaan selesai.',
          '"Open for Xd" di bawah timeline menunjukkan sudah berapa lama WO ini terbuka sejak dibuat — berguna untuk memantau yang mulai lama.',
          'Kartu **Review Note** (kuning/merah) muncul kalau reviewer sebelumnya menolak pekerjaan dan menjelaskan apa yang perlu diperbaiki.',
        ],
      },
      {
        id: 'wo-review',
        icon: ClipboardCheck,
        title: 'Work Order — Review Pekerjaan',
        intro: 'Saat status "Pending Review", orang yang berwenang (bukan si teknisi sendiri) memeriksa hasil kerja lewat foto "after" sebelum menutup WO.',
        image: '/help/wo-review.jpg',
        imageAlt: 'Modal Review Completed Work',
        tips: [
          'Tombol **"Review Work"** (ungu) hanya muncul untuk WO berstatus Pending Review, dan tidak muncul bagi teknisi yang mengerjakannya sendiri — memeriksa hasil kerja sendiri tidak diperbolehkan.',
          '**Approve & Close WO** langsung menyetujui dan menutup work order dalam satu klik.',
          '**Reject** mengembalikan WO ke "In Progress" dan mewajibkan alasan penolakan — teknisi akan melihat alasan ini dan harus unggah ulang foto "after" baru sebelum submit lagi.',
          'Semua foto "after" yang pernah diunggah tetap tersimpan di riwayat, bukan ditimpa — jadi progres sebelum-sesudah revisi tetap terlihat.',
        ],
      },
      {
        id: 'wo-history',
        icon: Archive,
        title: 'Work Order — Riwayat',
        intro: 'Arsip semua work order yang sudah Done atau Cancelled, lengkap dengan tanggal ditutup dan berapa lama pengerjaannya berlangsung.',
        image: '/help/wo-history.jpg',
        imageAlt: 'Tampilan halaman Work Order History',
        tips: [
          'Kolom **Duration** menghitung dari WO dibuat sampai ditutup — bukan cuma waktu pengerjaan aktif.',
          'Dropdown di sebelah kolom pencarian bisa difilter untuk lihat "Done" saja atau "Cancelled" saja, bukan cuma gabungan keduanya.',
          'Klik baris manapun untuk buka kembali detail lengkapnya — sama seperti di papan kerja utama, termasuk foto before/after.',
          'Riwayat ini adalah catatan resmi yang tidak bisa diedit — kalau ada kesalahan data, hanya admin dengan akses penuh yang bisa menghapusnya.',
        ],
      },
      {
        id: 'wo-reports',
        icon: FileBarChart2,
        title: 'Work Order — Laporan',
        intro: 'Dashboard performa bulanan: berapa lama WO biasanya terbuka, WO mana yang paling lama mengendap, rata-rata waktu penyelesaian per kategori, dan performa tiap teknisi.',
        image: '/help/wo-reports.jpg',
        imageAlt: 'Tampilan halaman Work Order Report',
        tips: [
          'Gunakan panah `<` `>` di sebelah nama bulan untuk lihat laporan bulan lain.',
          'Widget **"Currently Open — How Long?"** mengelompokkan WO aktif berdasarkan usia (< 1 hari, 1-3 hari, 3-7 hari, > 7 hari) — makin merah, makin butuh perhatian segera.',
          'Tabel **"Longest Open Work Orders"** adalah daftar prioritas praktis: WO paling lama terbuka yang belum selesai.',
          '**"Average Resolution Time by Category"** membandingkan kecepatan penyelesaian antar jenis pekerjaan (Electrical, Plumbing, dst) — berguna untuk lihat kategori mana yang butuh lebih banyak sumber daya.',
          'Tombol **"Export CSV"** mengunduh seluruh data laporan bulan yang sedang ditampilkan.',
        ],
      },
      {
        id: 'profile',
        icon: User,
        title: 'Profil Saya',
        intro: 'Halaman akun pribadi — ubah nama, nomor telepon, foto profil, dan kata sandi. Bisa diakses siapa saja yang login, apapun rolenya.',
        image: '/help/profile.jpg',
        imageAlt: 'Tampilan halaman Profil Saya',
        tips: [
          'Klik ikon kamera di foto profil untuk unggah avatar baru — format JPG/PNG/WebP, maksimal 2MB (ditolak otomatis kalau lebih besar, tanpa perlu upload dulu).',
          'Hanya **Nama Lengkap** dan **Nomor Telepon** yang bisa diubah sendiri di sini — Email, Username, Role, dan Divisi bersifat baca-saja dan hanya bisa diubah admin lewat Kelola Pengguna.',
          'Tombol **"Ubah Kata Sandi"** membuka form terpisah untuk ganti password.',
          'Perubahan nama/foto langsung terlihat di header dan sidebar tanpa perlu refresh halaman.',
        ],
      },
      {
        id: 'admin-users',
        icon: Users,
        title: 'Admin — Kelola Pengguna',
        intro: 'Konsol admin untuk kelola akun pengguna, divisi, dan role — dibagi 3 tab: Pengguna, Divisi, dan Role. Hanya bisa diakses admin (level ≤ 2).',
        image: '/help/admin-users.jpg',
        imageAlt: 'Tampilan halaman Kelola Pengguna dengan tab Pengguna, Divisi, dan Role',
        tips: [
          'Tab **Pengguna**: cari/filter berdasarkan role, divisi, atau status, lalu klik **"Tambah Pengguna"** untuk buat akun baru (nama, email, username, password, role, dan divisi wajib diisi).',
          'Ikon pensil untuk edit data pengguna, ikon power untuk aktifkan/nonaktifkan akun, ikon tempat sampah untuk hapus — dua aksi terakhir hanya muncul untuk Super Admin, dan tidak bisa dipakai ke akun sendiri atau sesama role level 1.',
          'Tab **Divisi**: klik **"Tambah Divisi"** untuk buat divisi baru (nama, warna, deskripsi) — tombol hapus otomatis nonaktif kalau divisi itu masih punya anggota, supaya nggak ada user yang "kehilangan" divisi.',
          'Tab **Role**: hanya bisa ubah nama dan warna lewat ikon pensil — level hierarki dan permission role diatur dari halaman **Peran & Izin**, bukan di sini.',
        ],
      },
      {
        id: 'admin-permissions',
        icon: Shield,
        title: 'Admin — Peran & Izin',
        intro: 'Editor matriks permission per role — pilih role di kiri, atur akses tiap modul (Task, Bulletin, HRIS, Work Order, dst) di kanan lewat toggle atau pilihan cakupan (Tidak Ada/Milik Sendiri/Divisi/Semua).',
        image: '/help/admin-permissions.jpg',
        imageAlt: 'Tampilan halaman Peran & Izin dengan matriks permission Super Admin',
        tips: [
          'Role **Super Admin** selalu punya akses penuh dan tidak bisa dikonfigurasi — semua kontrolnya sengaja dikunci.',
          'Hanya Super Admin yang bisa mengubah permission role apapun — admin biasa (level 2) yang buka halaman ini cuma bisa lihat matriksnya (read-only), tidak bisa menyimpan perubahan.',
          'Tombol **"+"** di atas daftar role untuk buat role kustom baru (hanya level 3–6 yang bisa dipilih — level 1–2 dikunci sistem).',
          'Role dengan pengaturan permission yang sudah disesuaikan (bukan default) ditandai titik biru kecil di sebelah namanya.',
          'Ganti role sebelum klik "Simpan" akan memicu konfirmasi kalau ada perubahan belum tersimpan — supaya nggak ke-skip tanpa sadar.',
        ],
      },
      {
        id: 'admin-audit-log',
        icon: ClipboardList,
        title: 'Admin — Log Audit',
        intro: 'Riwayat aktivitas sistem — siapa mengubah apa, kapan. Bisa difilter berdasarkan jenis entitas (Task, User, atau Permission).',
        image: '/help/admin-audit-log.jpg',
        imageAlt: 'Tampilan halaman Log Audit',
        tips: [
          'Setiap baris menampilkan waktu, pelaku (lengkap dengan divisinya), jenis aksi berwarna (hijau = dibuat, biru = diperbarui, merah = dihapus), dan detail perubahan.',
          'Filter **"Semua jenis"** di kanan atas mempersempit log ke satu jenis entitas saja.',
          'Halaman ini punya izin akses sendiri di luar akses admin biasa — kalau role kamu diset "Tidak Ada" untuk Log Audit di halaman Peran & Izin, halaman ini akan terkunci meski kamu tetap bisa masuk ke modul Admin lainnya.',
          'Cakupannya saat ini terbatas ke 3 jenis entitas (Task, User, Permission) — perubahan di modul lain (Bulletin, Work Order, dst) belum tercatat di sini.',
        ],
      },
    ],
  },
  en: {
    pageTitle: 'User Guide',
    pageSubtitle: 'How to use every module in the SAN Group Internal System — with real screenshots.',
    tipsLabel: 'Tips',
    sections: [
      {
        id: 'dashboard',
        icon: LayoutDashboard,
        title: 'Dashboard',
        intro: 'The first page you see after logging in. Shows a quick summary: today\'s tasks, attendance status, sticky notes, and quick access to every module.',
        image: '/help/dashboard.jpg',
        imageAlt: 'Dashboard page view',
        tips: [
          '"To Do Today" shows tasks in your My Day — not every task you have.',
          'Click "Check In" to clock in directly from the Dashboard, no need to open the HRIS module.',
          'The "Quick Access" panel on the right is a shortcut to Tasks, Bulletin, Notes, DB Links, and other modules.',
          '"My Division" shows your division\'s task stats — the numbers differ depending on your role.',
        ],
      },
      {
        id: 'tasks',
        icon: CheckSquare2,
        title: 'Tasks',
        intro: 'The most complete task management module — like Microsoft To Do and Notion combined. The left sidebar gives you several different "views" of the same underlying tasks.',
        image: '/help/tasks-list.jpg',
        imageAlt: 'List view on the Tasks page',
        tips: [
          '**My Day**: tasks you plan to work on today (you choose them yourself, resets daily).',
          '**Important**: tasks you\'ve starred — completely unrelated to due dates.',
          '**Planned**: every task with a due date, grouped by time range (today, tomorrow, this week, etc).',
          '**Assigned to Me**: tasks others gave you, including ones you haven\'t accepted or rejected yet.',
          '**My Tasks**: EVERY task that\'s yours — created by you or assigned to you.',
          '**All Tasks**: tasks others shared with you — not your own. This is the one that trips people up most, since it sounds like "everything" but actually means "what\'s been shared with me".',
          'Hover over any sidebar item (no click needed) to see a short explanation.',
        ],
      },
      {
        id: 'tasks-views',
        icon: CheckSquare2,
        title: 'Tasks — Board, Calendar, Table',
        intro: 'Besides List, tasks can be shown as a Kanban board, a monthly calendar, or a sortable table.',
        image: '/help/tasks-board-drag.gif',
        imageAlt: 'Animation of dragging a task card between Board columns',
        tips: [
          'On **Board**, drag & drop cards between columns to change task status (To Do → Done, etc).',
          'On **Calendar**, drag a task chip onto a date to set/change its due date — or click an empty date to create a new task right there.',
          'On **Table**, click a column header to sort (e.g. by due date or priority).',
          'Press `N` anywhere on this page to quickly create a new task, and `Esc` to close whatever dialog is open.',
          'With a task selected (List/Table), press `Space` to mark it done — the system checks first whether all its subtasks are finished.',
        ],
      },
      {
        id: 'tasks-detail',
        icon: CheckSquare2,
        title: 'Tasks — Detail & Subtasks',
        intro: 'Click any task to open its detail panel on the right — every setting for the task lives here: priority, due date, who it\'s assigned to, and who can see it.',
        image: '/help/tasks-detail.jpg',
        imageAlt: 'Task detail panel',
        tips: [
          '**Share with** controls who can SEE this task horizontally (peers): Only Me, My Division, Select Divisions, or All Staff.',
          'A manager (higher level, same division) can always see their reports\' tasks via Team Tasks, regardless of the "Share with" setting.',
          'Check **"Private"** if a task truly must stay hidden from your manager — it\'s the only way to do that.',
          'Subtasks go one level deep (a subtask can\'t have its own subtasks), complete with an automatic progress bar.',
          'Click a subtask to open its own page — a "Back to parent" link takes you back up.',
        ],
      },
      {
        id: 'bulletin',
        icon: Bell,
        title: 'Bulletin',
        intro: 'The company announcement board. Every published announcement shows up here, sorted by priority then date.',
        image: '/help/bulletin.jpg',
        imageAlt: 'Bulletin page view',
        tips: [
          'Card color signals priority: red = Urgent, yellow = Important, gray = Normal.',
          'Category filters (Announcement, Holiday, Maintenance, etc) sit right below the search box.',
          'A small blue dot on the title marks an unread bulletin — but it only stays visible for a few seconds after the page loads, so look as soon as it opens.',
          'If you have permission, the "Scheduled" tab is for recurring announcements (e.g. a weekly reminder) that publish automatically on a schedule.',
        ],
      },
      {
        id: 'notes',
        icon: StickyNote,
        title: 'Notes',
        intro: 'Personal sticky notes for quick things: contact numbers, checklists, meeting reminders. These are private — nobody else can see your notes.',
        image: '/help/notes.jpg',
        imageAlt: 'Notes page view',
        tips: [
          'Click the pin icon to pin an important note to the top.',
          'Pick one of 7 colors to visually group notes (e.g. yellow = important, blue = contacts).',
          'Use the search box or color filters above to quickly find an old note.',
          'A note\'s title is optional — if left blank, the note just shows by its content.',
        ],
      },
      {
        id: 'dblinks',
        icon: Database,
        title: 'DB Links',
        intro: 'A directory of important company links, grouped into folders — e.g. accounting software, internet banking, the HR portal.',
        image: '/help/dblinks.jpg',
        imageAlt: 'DB Links page view',
        tips: [
          'Click a folder to open it — links are laid out in a reorderable order.',
          'Click a link\'s name to open it in a new tab; the raw URL is intentionally hidden to keep the list clean.',
          'If you manage that folder (or created it), an edit/delete button appears on hover over each link row.',
          'A folder can be shared with another division via the "Share" button — handy when one folder is relevant to more than one team.',
        ],
      },
      {
        id: 'analytics',
        icon: BarChart3,
        title: 'Analytics',
        intro: 'The team\'s productivity dashboard — total tasks, completion trend, priority breakdown, even a contributor leaderboard. What you see (personal/division/everyone) depends on your role.',
        image: '/help/analytics.jpg',
        imageAlt: 'Analytics page with active filters',
        tips: [
          'Switch the time range (7/30/90 days) and filter by division/priority/assignee at the top — every chart updates instantly.',
          'Click **"Customize"** to hide widgets that aren\'t relevant to you — the choice is saved automatically for next time.',
          'Hover over a bar chart to see the exact number for that day (tooltip).',
          'The **"Export CSV"** button downloads all data for your current filters — handy for a report to your manager.',
          'The "Overdue Aging" widget buckets late tasks by how overdue they are — the darker the color, the more overdue.',
        ],
      },
      {
        id: 'notifications',
        icon: Inbox,
        title: 'Notifications',
        intro: 'Every system alert: new tasks, accepted/rejected tasks, urgent announcements, leave requests, and more.',
        image: '/help/notifications.jpg',
        imageAlt: 'Notifications page view',
        tips: [
          'Click a notification to jump straight to what it\'s about (e.g. the task in question) — it\'s automatically marked read at the same time.',
          'The bell icon in the header has a compact dropdown so you can check notifications without leaving the page.',
          '"Mark All Read" instantly clears every red badge count in the sidebar and header.',
          'New notifications also pop up as a small toast in the corner of the screen — click it to open right away.',
        ],
      },
      {
        id: 'hris-overview',
        icon: Building2,
        title: 'HRIS — Overview',
        intro: 'The first page of the HRIS module. Shows today\'s attendance status, the Check In/Check Out button, your current-year leave balance, and your recent leave requests.',
        image: '/help/hris-overview.jpg',
        imageAlt: 'HRIS Overview page view',
        tips: [
          'The **Check In**/**Check Out** button sits in the dark blue card at the top — its status updates automatically once you clock in.',
          'The "Leave Balance" card shows what\'s left of each leave type (Annual Leave, WFH Special, etc) — some types like Sick Leave have no fixed quota ("as needed").',
          'The "Leave Requests" panel shows 4 statuses: Pending, Approved, Rejected, Cancelled.',
          'The Present/Late/WFH/Leave/Absent counters at the top follow the current month.',
        ],
      },
      {
        id: 'hris-attendance',
        icon: Clock,
        title: 'HRIS — Attendance',
        intro: 'A monthly attendance recap shown as a calendar, plus a daily log with check-in/out times, worked hours, location, and the clock-in photo.',
        image: '/help/hris-attendance.jpg',
        imageAlt: 'HRIS Attendance page view',
        tips: [
          'Toggle **Me** / **Team — All** in the top right to switch between your own attendance and your team\'s (managers/HR only).',
          'Click any date on the calendar to see that day\'s attendance detail — status is color-coded (Absent = red, etc).',
          'Use the `<` `>` arrows next to the month name to move to another month.',
          'The "Attendance Log" table below the calendar breaks down each day: Check In, Check Out, Duration, Location, and photo (if the company requires a photo on clock-in).',
        ],
      },
      {
        id: 'hris-leave',
        icon: CalendarDays,
        title: 'HRIS — Leave',
        intro: 'Submit new leave requests and track the balance of every leave type (Annual Leave, Sick Leave, Emergency Leave, WFH Special, Special Leave, Comp Off).',
        image: '/help/hris-leave.jpg',
        imageAlt: 'HRIS Leave page view',
        tips: [
          'Click **"Request Leave"** in the top right to open the request form — pick a leave type, start/end date, and reason.',
          'The **"Comp Off"** button is specifically for claiming compensatory leave earned from overtime or working a holiday.',
          'Status filters (All, Pending, Approved, Rejected, Cancelled) sit below the balance cards — use them to find a specific request.',
          'Leave types that require documentation (e.g. Sick Leave) prompt for a file attachment at request time — it shows up as a link in the history card.',
          'The **Me** / **Team** toggle in the top right is what managers/HR use to view and approve their reports\' leave requests.',
        ],
      },
      {
        id: 'hris-requests',
        icon: ClipboardList,
        title: 'HRIS — Requests',
        intro: 'Where you file a late-arrival notice or a shift-change request — both distinct from a regular leave request.',
        image: '/help/hris-requests.jpg',
        imageAlt: 'HRIS Requests page view',
        tips: [
          '**"Late Arrival"** tab: report ahead of time that you\'ll be late, with an estimated arrival time and a reason.',
          '**"Shift Change"** tab: request a swap or change to your work shift schedule.',
          'Status filters (Pending, Approved, Rejected, Cancelled) work the same way as on the Leave page.',
          'A request still "Pending" can be cancelled by yourself from the button on its card.',
        ],
      },
      {
        id: 'hris-reports',
        icon: FileBarChart2,
        title: 'HRIS — Attendance Report',
        intro: 'A company-wide attendance recap for one month, with Present/Late/Absent/WFH/Off-site totals and an average attendance rate. Restricted to certain roles (HR/management).',
        image: '/help/hris-reports.jpg',
        imageAlt: 'HRIS Attendance Report page view',
        tips: [
          'Use the **"All Divisions"** filter in the top right to narrow the report to one division.',
          'The "Search employee..." box filters the table below it instantly.',
          'The **"Export CSV"** button downloads the currently shown month\'s report with the active filters applied.',
          'The H/T/WFH/A columns in the table are short for Present/Late/WFH/Absent for each employee.',
        ],
      },
      {
        id: 'hris-admin-shifts',
        icon: CalendarClock,
        title: 'HRIS — Manage Shifts (Admin)',
        intro: 'The admin page for creating work shift types (start/end time, late tolerance) and assigning a shift to each employee.',
        image: '/help/hris-admin-shifts.jpg',
        imageAlt: 'HRIS Manage Shifts page view',
        tips: [
          'Click **"+ New Shift"** to create a shift type — set its working hours and late-tolerance minutes.',
          'A shift marked **"Default"** is automatically applied to new employees who haven\'t been assigned one yet.',
          'Use the dropdown next to each employee\'s name in the "Assign Employee Shift" panel to move them to a different shift.',
          'The employee search box in the top right of the assignment panel speeds up finding someone in a large team.',
        ],
      },
      {
        id: 'hris-admin-locations',
        icon: MapPin,
        title: 'HRIS — Office Locations (Admin)',
        intro: 'Configure the geofenced points where employees are allowed to clock in — each location has its own coordinates and radius.',
        image: '/help/hris-admin-locations.jpg',
        imageAlt: 'HRIS Office Locations page view',
        tips: [
          'Click **"+ Add Location"** to register a new office/site along with its geofence radius (in meters).',
          'Click a location card\'s coordinates to open that exact point in Google Maps.',
          'Employees can check in from any active location — if they\'re outside every radius, the system shows a warning with a "force clock-in" option.',
          'The pencil and trash icons on a card let you edit or delete that location.',
        ],
      },
      {
        id: 'hris-admin-holidays',
        icon: CalendarOff,
        title: 'HRIS — Holidays (Admin)',
        intro: 'The company/national holiday calendar for a given year — the system uses it to exclude those days from leave calculations and automatic absent-marking.',
        image: '/help/hris-admin-holidays.jpg',
        imageAlt: 'HRIS Holidays page view',
        tips: [
          'Fill in the date and holiday name in the top row, then click **"+ Add"**.',
          'Use the `<` `>` arrows next to the year to manage holidays for the previous/next year.',
          'A day listed here is automatically excluded from leave-quota calculations and won\'t be marked "Absent" even if the employee didn\'t clock in.',
          'The trash icon on each row removes that holiday.',
        ],
      },
      {
        id: 'hris-admin-leave-types',
        icon: Tags,
        title: 'HRIS — Leave Types (Admin)',
        intro: 'Manage every available leave type and its policy: annual quota, whether documentation is required, carry-over rules, and minimum tenure requirements.',
        image: '/help/hris-admin-leave-types.jpg',
        imageAlt: 'HRIS Leave Types page view',
        tips: [
          'Click **"+ New Type"** to create a leave category beyond the 6 that exist by default.',
          'Badges like **"Carry-over"** or **"12mo tenure"** under a leave type\'s name flag a special rule that applies to it.',
          'The power icon on a card deactivates a leave type without deleting its history — a deactivated type disappears from the request form but old data stays intact.',
          'A quota change takes effect on the current year\'s balance immediately; existing carry-over days are preserved.',
        ],
      },
      {
        id: 'wo-board',
        icon: Wrench,
        title: 'Work Order — Board',
        intro: 'The main page of the Work Order module. Every maintenance/repair ticket shows up as a Kanban board grouped by status, or as a sortable table — the left sidebar has a few ready-made filters to narrow the list.',
        image: '/help/wo-board-drag.gif',
        imageAlt: 'Animation of dragging a Work Order card between status columns',
        tips: [
          '**My Tasks**: work orders assigned to you as the technician.',
          '**Reported by Me**: work orders you personally reported, regardless of status.',
          '**Unassigned**: work orders with no technician yet — these need attention first.',
          '**Pending Review**: finished work waiting for your approval.',
          'On **Board**, drag & drop a card between columns to change its status directly — dropping it into the "Assigned" column automatically opens the technician search.',
          'Click the table icon in the top right to switch to **Table** view, then "Export CSV" next to it to download the data under your current filters.',
          'The summary bar at the top (Active/Pending Review/Overdue/Urgent) is display-only — click a filter in the sidebar to actually narrow the list.',
        ],
      },
      {
        id: 'wo-create',
        icon: Plus,
        title: 'Work Order — Create & Assign',
        intro: 'Click "Create WO" to report a new issue and, optionally, assign a technician on the spot — the due date fills in automatically based on the priority you pick.',
        image: '/help/wo-create.jpg',
        imageAlt: 'Create Work Order form with the technician search active',
        tips: [
          'The **"Assign to Technician"** field is a search box — type part of a name to filter, then click to pick them. Leave it empty to create a WO with no technician yet (lands in "New" status).',
          'The Due Date (SLA) is auto-filled by priority (Urgent = 1 day, High = 3 days, Medium = 7 days, Low = 14 days) — change it manually any time before submitting.',
          'A WO assigned to a technician right at creation automatically skips straight to "Assigned" status, bypassing "New" and "Validated".',
          'The **Location** and **Category** fields help technicians and reports group the work — fill them in with as much detail as possible (e.g. "Tower A — Floor 4, Server Room").',
        ],
      },
      {
        id: 'wo-status',
        icon: RefreshCw,
        title: 'Work Order — Detail & Status Flow',
        intro: 'Click any card to open its detail panel on the right: who reported and who\'s assigned, a history timeline, reviewer notes, and before/after photos.',
        image: '/help/wo-status.jpg',
        imageAlt: 'Work Order detail panel with timeline and photos',
        tips: [
          'The normal status flow is **New → Validated → Assigned → In Progress → Pending Review → Done**. There\'s also a "Pending Parts" branch (waiting on a spare part) and "Cancelled", which can be taken any time before it\'s done.',
          'The **"Change Status"** button only shows transitions that are actually valid from the current status — so you can\'t pick the wrong one by accident.',
          'Before a WO can move to "Pending Review", the system requires at least one **"After"** photo uploaded in the Photo Evidence section as proof the work is done.',
          '"Open for Xd" under the timeline shows how long this WO has been open since it was created — handy for spotting ones that have been sitting too long.',
          'A yellow/red **Review Note** card appears when a previous reviewer rejected the work and explains what needs fixing.',
        ],
      },
      {
        id: 'wo-review',
        icon: ClipboardCheck,
        title: 'Work Order — Reviewing Work',
        intro: 'Once a WO is "Pending Review", someone with authority (not the technician who did the work) checks the "after" photos before the WO can close.',
        image: '/help/wo-review.jpg',
        imageAlt: 'Review Completed Work modal',
        tips: [
          'The purple **"Review Work"** button only shows up for Pending Review WOs, and never for the technician who did the work themselves — you can\'t review your own job.',
          '**Approve & Close WO** approves and closes the work order in one click.',
          '**Reject** sends the WO back to "In Progress" and requires a reason — the technician sees this reason and must upload a fresh "after" photo before submitting again.',
          'Every "after" photo ever uploaded stays in the history rather than being overwritten — so the before/after progress across revisions stays visible.',
        ],
      },
      {
        id: 'wo-history',
        icon: Archive,
        title: 'Work Order — History',
        intro: 'The archive of every Done or Cancelled work order, with its closing date and how long it took from start to finish.',
        image: '/help/wo-history.jpg',
        imageAlt: 'Work Order History page view',
        tips: [
          'The **Duration** column counts from creation to closing — not just active working time.',
          'The dropdown next to the search box can filter to "Done" only or "Cancelled" only, instead of the combined default.',
          'Click any row to reopen its full detail — same as on the main board, before/after photos included.',
          'This history is the official record and can\'t be edited — if the data is wrong, only an admin with full access can delete it.',
        ],
      },
      {
        id: 'wo-reports',
        icon: FileBarChart2,
        title: 'Work Order — Reports',
        intro: 'A monthly performance dashboard: how long WOs typically stay open, which ones have been sitting the longest, average resolution time by category, and each technician\'s track record.',
        image: '/help/wo-reports.jpg',
        imageAlt: 'Work Order Report page view',
        tips: [
          'Use the `<` `>` arrows next to the month name to view a different month\'s report.',
          'The **"Currently Open — How Long?"** widget buckets active WOs by age (< 1 day, 1-3 days, 3-7 days, > 7 days) — the redder it is, the more urgent it needs attention.',
          'The **"Longest Open Work Orders"** table is a practical priority list: unfinished WOs that have been open the longest.',
          '**"Average Resolution Time by Category"** compares how fast different kinds of work get resolved (Electrical, Plumbing, etc) — useful for spotting which category needs more resources.',
          'The **"Export CSV"** button downloads the full report data for the month currently shown.',
        ],
      },
      {
        id: 'profile',
        icon: User,
        title: 'My Profile',
        intro: 'Your personal account page — update your name, phone number, profile photo, and password. Available to every logged-in user, regardless of role.',
        image: '/help/profile.jpg',
        imageAlt: 'My Profile page view',
        tips: [
          'Click the camera icon on your profile photo to upload a new avatar — JPG/PNG/WebP, max 2MB (rejected instantly if it\'s too big, no upload attempt needed).',
          'Only **Full Name** and **Phone Number** can be edited here — Email, Username, Role, and Division are read-only and can only be changed by an admin via Manage Users.',
          'The **"Change Password"** button opens a separate form to update your password.',
          'Name/photo changes reflect instantly in the header and sidebar — no page reload needed.',
        ],
      },
      {
        id: 'admin-users',
        icon: Users,
        title: 'Admin — Manage Users',
        intro: 'The admin console for managing user accounts, divisions, and roles — split into 3 tabs: Users, Divisions, and Roles. Restricted to admins (level ≤ 2).',
        image: '/help/admin-users.jpg',
        imageAlt: 'Manage Users page with Users, Divisions, and Roles tabs',
        tips: [
          '**Users** tab: search/filter by role, division, or status, then click **"Add User"** to create a new account (name, email, username, password, role, and division are required).',
          'The pencil icon edits a user, the power icon activates/deactivates an account, and the trash icon deletes it — the last two only appear for a SuperAdmin, and never apply to your own account or a fellow level-1 role.',
          '**Divisions** tab: click **"Add Division"** to create one (name, color, description) — the delete button is automatically disabled while the division still has members, so no user ever loses its division silently.',
          '**Roles** tab: only lets you change a role\'s name and color via the pencil icon — hierarchy level and permissions are configured on the **Roles & Permissions** page instead, not here.',
        ],
      },
      {
        id: 'admin-permissions',
        icon: Shield,
        title: 'Admin — Roles & Permissions',
        intro: 'The per-role permission matrix editor — pick a role on the left, then set access for every module (Task, Bulletin, HRIS, Work Order, etc) on the right via toggles or scope choices (None/Own/Division/All).',
        image: '/help/admin-permissions.jpg',
        imageAlt: 'Roles & Permissions page showing the Super Admin permission matrix',
        tips: [
          'The **Super Admin** role always has full access and can\'t be configured — every control is intentionally locked.',
          'Only a SuperAdmin can change any role\'s permissions — a regular admin (level 2) who opens this page only sees a read-only matrix and can\'t save changes.',
          'The **"+"** button above the role list creates a new custom role (only levels 3–6 are selectable — levels 1–2 are reserved by the system).',
          'A role whose permissions have been customized away from the default shows a small blue dot next to its name.',
          'Switching roles while you have unsaved changes triggers a confirmation prompt — so edits don\'t get silently discarded.',
        ],
      },
      {
        id: 'admin-audit-log',
        icon: ClipboardList,
        title: 'Admin — Audit Log',
        intro: 'A history of system activity — who changed what, and when. Filterable by entity type (Task, User, or Permission).',
        image: '/help/admin-audit-log.jpg',
        imageAlt: 'Audit Log page view',
        tips: [
          'Each row shows the timestamp, the acting user (with their division), a color-coded action badge (green = created, blue = updated, red = deleted), and a detail of what changed.',
          'The **"All types"** filter in the top right narrows the log to a single entity type.',
          'This page has its own access permission separate from general admin access — if your role\'s Audit Log permission is set to "None" on the Roles & Permissions page, this page stays locked even though you can still reach the rest of the Admin module.',
          'Coverage is currently limited to 3 entity types (Task, User, Permission) — changes in other modules (Bulletin, Work Order, etc) aren\'t logged here yet.',
        ],
      },
    ],
  },
};

/** Renders `**bold**` spans inside an otherwise plain-text tip line. */
function FormattedTip({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}

type CategoryId = 'internal' | 'hris' | 'wo' | 'admin';

/** Section id prefix decides its category — keeps CONTENT free of a redundant field. */
function categoryOf(id: string): CategoryId {
  if (id.startsWith('hris-')) return 'hris';
  if (id.startsWith('wo-')) return 'wo';
  if (id.startsWith('admin-')) return 'admin';
  return 'internal';
}

const CATEGORIES: { id: CategoryId; icon: React.ElementType }[] = [
  { id: 'internal', icon: LayoutDashboard },
  { id: 'hris', icon: HardHat },
  { id: 'wo', icon: Wrench },
  { id: 'admin', icon: UserCog },
];

const CATEGORY_LABELS: Record<'id' | 'en', Record<CategoryId, string>> = {
  id: { internal: 'Internal', hris: 'HRIS', wo: 'Work Orders', admin: 'Admin' },
  en: { internal: 'Internal', hris: 'HRIS', wo: 'Work Orders', admin: 'Admin' },
};

/** Sections whose title carries an explicit "(Admin)" suffix get grouped
 *  apart from regular-staff sections in the TOC and content list. */
function isAdminSection(s: Section): boolean {
  return s.title.includes('(Admin)');
}

const UI_TEXT: Record<'id' | 'en', {
  searchPlaceholder: string;
  searchNoResults: string;
  staffGroup: string;
  adminGroup: string;
}> = {
  id: {
    searchPlaceholder: 'Cari di semua panduan...',
    searchNoResults: 'Tidak ada hasil untuk',
    staffGroup: 'Untuk Semua Staff',
    adminGroup: 'Khusus Admin / HR',
  },
  en: {
    searchPlaceholder: 'Search the whole guide...',
    searchNoResults: 'No results for',
    staffGroup: 'For All Staff',
    adminGroup: 'Admin / HR Only',
  },
};

export default function HelpPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'id' ? 'id' : 'en';
  const { pageTitle, pageSubtitle, tipsLabel, sections } = CONTENT[lang];
  const ui = UI_TEXT[lang];
  const hashId = window.location.hash.replace('#help-', '');
  const hasHashSection = sections.some((s) => s.id === hashId);
  const initialCategory = hasHashSection ? categoryOf(hashId) : 'internal';

  const [activeCategory, setActiveCategory] = useState<CategoryId>(initialCategory);
  const [active, setActive] = useState(hasHashSection ? hashId : sections.find((s) => categoryOf(s.id) === initialCategory)!.id);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const visibleSections = sections.filter((s) => categoryOf(s.id) === activeCategory);
  const staffSections = visibleSections.filter((s) => !isAdminSection(s));
  const adminSections = visibleSections.filter((s) => isAdminSection(s));
  const hasGroups = staffSections.length > 0 && adminSections.length > 0;

  const trimmedQuery = query.trim();
  const searchResults = trimmedQuery.length >= 2
    ? sections.filter((s) => {
      const haystack = `${s.title} ${s.intro} ${s.tips.join(' ')}`.toLowerCase();
      return haystack.includes(trimmedQuery.toLowerCase());
    }).slice(0, 8)
    : [];

  useClickOutside(searchRef, () => setSearchFocused(false));

  function selectCategory(cat: CategoryId) {
    setActiveCategory(cat);
    const first = sections.find((s) => categoryOf(s.id) === cat);
    if (first) {
      setActive(first.id);
      document.getElementById(`help-${first.id}`)?.scrollIntoView({ block: 'start' });
    }
  }

  function scrollTo(id: string) {
    setActive(id);
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Used by search results: jumps to a section that may live in a
   *  different category tab, switching tabs first if needed. */
  function goToSection(id: string) {
    const cat = categoryOf(id);
    setQuery('');
    setSearchFocused(false);
    if (cat !== activeCategory) {
      setActiveCategory(cat);
      setPendingScrollId(id);
    } else {
      scrollTo(id);
    }
  }

  // Finishes a cross-category jump from search once the target category's
  // sections have rendered into the DOM. Jumps instantly rather than
  // smooth-scrolling — the tab switch already changed the whole page's
  // content, so animating a long scroll on top of that reads as laggy
  // (and can visibly stall partway on a long list).
  useEffect(() => {
    if (!pendingScrollId) return;
    document.getElementById(`help-${pendingScrollId}`)?.scrollIntoView({ block: 'start' });
    setActive(pendingScrollId);
    setPendingScrollId(null);
  }, [activeCategory, pendingScrollId]);

  // Deep-links from other modules (e.g. sidebar "HRIS Guide") land with a
  // #help-{id} hash — the category tab above already opens on the right
  // tab (via initialCategory), so this just jumps to the section itself.
  useEffect(() => {
    if (hasHashSection) {
      document.getElementById(`help-${hashId}`)?.scrollIntoView({ block: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll-spy: keeps the sidebar highlight in sync while scrolling, not
  // just on click — watches a thin band near the top of the viewport and
  // activates whichever section is currently under it.
  useEffect(() => {
    const targets = visibleSections
      .map((s) => document.getElementById(`help-${s.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        setActive(topMost.target.id.replace('help-', ''));
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, lang]);

  function renderTocButton(s: Section) {
    const Icon = s.icon;
    return (
      <button
        key={s.id}
        onClick={() => scrollTo(s.id)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
          active === s.id ? 'bg-navy/10 text-navy font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
        )}
      >
        <Icon size={15} className="flex-shrink-0" />
        <span className="flex-1 truncate">{s.title}</span>
        <ChevronRight size={13} className="flex-shrink-0 opacity-40" />
      </button>
    );
  }

  function renderSection(s: Section) {
    const Icon = s.icon;
    return (
      <section key={s.id} id={`help-${s.id}`} className="bg-white border border-gray-200 rounded-xl p-6 scroll-mt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-navy" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">{s.title}</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{s.intro}</p>

        <img
          src={s.image}
          alt={s.imageAlt}
          className="w-full rounded-lg border border-gray-200 shadow-sm mb-4"
          loading="lazy"
        />

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{tipsLabel}</span>
          </div>
          <ul className="space-y-1.5">
            {s.tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                <span className="text-amber-400 flex-shrink-0">•</span>
                <span><FormattedTip text={tip} /></span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pageSubtitle}</p>
        </div>

        {/* Global search — matches title/description/tips across every
            category, so it isn't limited to whichever tab is currently open. */}
        <div ref={searchRef} className="relative w-72 flex-shrink-0 hidden sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchFocused(false); } }}
            placeholder={ui.searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}

          {searchFocused && trimmedQuery.length >= 2 && (
            <div className="absolute z-20 top-full mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">{ui.searchNoResults} "{trimmedQuery}"</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {searchResults.map((s) => {
                    const Icon = s.icon;
                    const cat = categoryOf(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          onMouseDown={() => goToSection(s.id)}
                          className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Icon size={15} className="flex-shrink-0 mt-0.5 text-navy" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 truncate">{s.title}</span>
                              <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                {CATEGORY_LABELS[lang][cat]}
                              </span>
                            </span>
                            <span className="block text-xs text-gray-500 truncate mt-0.5">{s.intro}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Category tabs — split Internal / HRIS / Work Orders so each tab's
          table of contents (and scroll distance) stays short. */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const count = sections.filter((s) => categoryOf(s.id) === c.id).length;
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => selectCategory(c.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon size={16} />
              {CATEGORY_LABELS[lang][c.id]}
              <span className={cn(
                'text-xs px-1.5 rounded-full',
                isActive ? 'bg-navy/10 text-navy' : 'bg-gray-100 text-gray-400',
              )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-6 items-start">
        {/* Table of contents */}
        <nav className="hidden lg:block w-52 flex-shrink-0 sticky top-4 space-y-0.5">
          {hasGroups ? (
            <>
              <p className="flex items-center gap-1.5 px-3 pt-1 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                <Users size={11} />
                {ui.staffGroup}
              </p>
              {staffSections.map(renderTocButton)}
              <p className="flex items-center gap-1.5 px-3 pt-4 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                <ShieldCheck size={11} />
                {ui.adminGroup}
              </p>
              {adminSections.map(renderTocButton)}
            </>
          ) : (
            visibleSections.map(renderTocButton)
          )}
        </nav>

        {/* Sections */}
        <div className="flex-1 min-w-0 space-y-8">
          {hasGroups ? (
            <>
              {staffSections.map(renderSection)}
              <div className="flex items-center gap-2 pt-2">
                <ShieldCheck size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{ui.adminGroup}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {adminSections.map(renderSection)}
            </>
          ) : (
            visibleSections.map(renderSection)
          )}
        </div>
      </div>
    </div>
  );
}
