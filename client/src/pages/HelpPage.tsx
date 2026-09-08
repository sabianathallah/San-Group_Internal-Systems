import { useState } from 'react';
import {
  LayoutDashboard, CheckSquare2, Bell, StickyNote, Database, BarChart3, Inbox,
  Lightbulb, ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

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
        image: '/help/tasks-board.jpg',
        imageAlt: 'Tampilan Board (Kanban) di halaman Tasks',
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
        image: '/help/tasks-board.jpg',
        imageAlt: 'Board (Kanban) view on the Tasks page',
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

export default function HelpPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'id' ? 'id' : 'en';
  const { pageTitle, pageSubtitle, tipsLabel, sections } = CONTENT[lang];
  const [active, setActive] = useState(sections[0].id);

  function scrollTo(id: string) {
    setActive(id);
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{pageSubtitle}</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Table of contents */}
        <nav className="hidden lg:block w-52 flex-shrink-0 sticky top-4 space-y-0.5">
          {sections.map((s) => {
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
          })}
        </nav>

        {/* Sections */}
        <div className="flex-1 min-w-0 space-y-8">
          {sections.map((s) => {
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
          })}
        </div>
      </div>
    </div>
  );
}
