# Wireframe — SAN Group Internal Management System

> Format: ASCII wireframe per halaman utama | Last updated: 2026-05-19  
> Resolusi referensi: Desktop 1440px, Sidebar collapsible

---

## Layout Utama (Shell)

Semua halaman (kecuali Login) menggunakan shell ini:

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR (expanded 240px / collapsed 60px)  │  MAIN CONTENT AREA     │
│                                            │                        │
│  ┌──────────────┐                          │  ┌──────────────────┐  │
│  │  [LOGO]      │  ← toggle collapse       │  │  HEADER          │  │
│  │  SAN Group   │                          │  │  Breadcrumb  [👤]│  │
│  └──────────────┘                          │  └──────────────────┘  │
│                                            │                        │
│  ┌──────────────┐                          │  ┌──────────────────┐  │
│  │ 📊 Dashboard │  ← active state          │  │                  │  │
│  │ ✅ Tasks     │                          │  │   PAGE CONTENT   │  │
│  │ 📢 Bulletin  │                          │  │                  │  │
│  │ 📝 Notes     │                          │  │                  │  │
│  │ 🔗 Database  │                          │  │                  │  │
│  └──────────────┘                          │  └──────────────────┘  │
│                                            │                        │
│  [bottom]                                  │                        │
│  ┌──────────────┐                          │                        │
│  │ 👤 Profile   │                          │                        │
│  │ 🚪 Logout    │                          │                        │
│  └──────────────┘                          │                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Login Page

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     [background: dark gradient]                     │
│                                                                     │
│              ┌────────────────────────────────────┐                 │
│              │                                    │                 │
│              │        [SAN GROUP LOGO]             │                 │
│              │      SAN Group Internal System      │                 │
│              │                                    │                 │
│              │  ┌──────────────────────────────┐  │                 │
│              │  │  Email                       │  │                 │
│              │  └──────────────────────────────┘  │                 │
│              │                                    │                 │
│              │  ┌──────────────────────────────┐  │                 │
│              │  │  Password              [👁]  │  │                 │
│              │  └──────────────────────────────┘  │                 │
│              │                                    │                 │
│              │  ┌──────────────────────────────┐  │                 │
│              │  │        MASUK                 │  │                 │
│              │  └──────────────────────────────┘  │                 │
│              │                                    │                 │
│              │  [error message area]              │                 │
│              │                                    │                 │
│              └────────────────────────────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Elemen:**
- Card centered, lebar ~400px
- Logo SAN Group di atas form
- Input email + password (dengan toggle show/hide)
- Tombol Masuk (full width, loading state)
- Error message inline di bawah tombol

---

## 2. Dashboard Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Dashboard          [Nama User]                  │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  Selamat pagi, [Nama]!          Senin, 18 Mei 2026       │
│         │                                                           │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│         │  │ Tugas     │ │Selesai   │ │Mendesak  │ │ Bulletin  │   │
│         │  │  Aktif   │ │ Hari Ini │ │          │ │  Belum   │   │
│         │  │  [12]    │ │   [3]    │ │   [2]    │ │  Dibaca  │   │
│         │  │ 📋       │ │ ✅       │ │ 🔴       │ │   [5]    │   │
│         │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│         │                                                           │
│         │  ┌─────────────────────────────┐ ┌───────────────────┐  │
│         │  │  TUGAS HARI INI             │ │  BULLETIN TERBARU │  │
│         │  │  ─────────────────────────  │ │  ──────────────── │  │
│         │  │  ○ [task title]  🔴 Urgent  │ │  📢 [judul]  baru │  │
│         │  │    Due: Hari ini  [assignee]│ │  📢 [judul]       │  │
│         │  │  ○ [task title]  🟡 High   │ │  📢 [judul]       │  │
│         │  │  ○ [task title]  🔵 Medium  │ │                   │  │
│         │  │  ○ [task title]  ⚪ Low    │ │  [Lihat semua →]  │  │
│         │  │                             │ └───────────────────┘  │
│         │  │  [Lihat semua tugas →]      │                        │
│         │  └─────────────────────────────┘ ┌───────────────────┐  │
│         │                                   │  CATATAN CEPAT    │  │
│         │  ┌─────────────────────────────┐  │  ──────────────── │  │
│         │  │  LINK DATABASE              │  │  📝 [note 1]      │  │
│         │  │  ─────────────────────────  │  │  📝 [note 2]      │  │
│         │  │  🔗 [nama link]  [kategori] │  │  📝 [note 3]      │  │
│         │  │  🔗 [nama link]             │  │                   │  │
│         │  │  [+ Tambah link]            │  │  [+ Catatan baru] │  │
│         │  └─────────────────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Elemen:**
- Greeting + tanggal hari ini
- 4 stat card (tugas aktif, selesai hari ini, mendesak, bulletin belum dibaca)
- Panel "Tugas Hari Ini" (list 4-5 item, link ke Tasks)
- Panel "Bulletin Terbaru" (list 3 item)
- Panel "Link Database" (shortcut)
- Panel "Catatan Cepat" (sticky notes preview)

---

## 3. Tasks Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Tasks                                           │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  ┌───────────────────┐  [🔍 Cari tugas...]  [+ Tugas]  │
│         │  │ MY DAY            │                                   │
│         │  │ IMPORTANT         │  [≡ List] [⊞ Board] [📅 Calendar]│
│         │  │ PLANNED           │                                   │
│         │  │ ──────────────    │  Filter: [Semua ▼] [Prioritas ▼] │
│         │  │ + Buat List Baru  │  ─────────────────────────────── │
│         │  └───────────────────┘                                   │
│         │        [Task List]          [Task Detail Panel]          │
│         │  ┌────────────────────┐  ┌──────────────────────────┐   │
│         │  │ ○ [Judul Tugas]    │  │  [Judul Tugas]       [×] │   │
│         │  │   🔴 Urgent · Due  │  │                          │   │
│         │  │   [👤 assignee]    │  │  Status:  [TODO ▼]       │   │
│         │  ├────────────────────┤  │  Prioritas: [HIGH ▼]     │   │
│         │  │ ○ [Judul Tugas]    │  │  Due Date: [📅 pilih]    │   │
│         │  │   🟡 High · Due    │  │  Assignee: [👤 pilih]    │   │
│         │  ├────────────────────┤  │                          │   │
│         │  │ ✅ [Judul Selesai] │  │  Deskripsi:              │   │
│         │  │   ────────────     │  │  [textarea...]           │   │
│         │  ├────────────────────┤  │                          │   │
│         │  │ [+ Tambah Tugas]   │  │  Sub-tugas (2)           │   │
│         │  └────────────────────┘  │  ○ [sub task 1]          │   │
│         │                          │  ✅ [sub task 2]         │   │
│         │                          │  [+ tambah sub-tugas]    │   │
│         │                          │                          │   │
│         │                          │  📎 Lampiran (1)         │   │
│         │                          └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Elemen:**
- Left panel: daftar task list (My Day, Important, Planned, custom)
- Toolbar: search, tambah tugas, toggle view (list/board/calendar)
- List view: item dengan status circle, prioritas badge, due date, assignee
- Detail panel (slide-in kanan): edit judul inline, dropdowns, deskripsi, sub-tugas, lampiran
- Board view: kolom TODO / IN_PROGRESS / DONE

---

## 4. Bulletin Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Bulletin Board                                  │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  [🔍 Cari bulletin...]   [Filter: Semua ▼]  [+ Buat]   │
│         │                                                           │
│         │  ┌─────────────────────────────────────────────────────┐ │
│         │  │  🔴 MENDESAK   📢 Pemeliharaan Lift Gedung A        │ │
│         │  │  Dipublikasikan: 18 Mei 2026 · oleh Admin           │ │
│         │  │  Pemeliharaan lift akan dilakukan pada...  [Baca →] │ │
│         │  └─────────────────────────────────────────────────────┘ │
│         │                                                           │
│         │  ┌─────────────────────────────────────────────────────┐ │
│         │  │  🟡 PENTING    🎉 Pengumuman Hari Libur Nasional    │ │
│         │  │  Dipublikasikan: 17 Mei 2026 · oleh HRD             │ │
│         │  │  Menginformasikan bahwa tanggal...          [Baca →] │ │
│         │  └─────────────────────────────────────────────────────┘ │
│         │                                                           │
│         │  ┌─────────────────────────────────────────────────────┐ │
│         │  │  ⚪ NORMAL     📋 Update Prosedur Operasional       │ │
│         │  │  Dipublikasikan: 15 Mei 2026 · oleh Admin  ✅ Dibaca│ │
│         │  │  Berikut adalah update SOP terbaru...       [Baca →] │ │
│         │  └─────────────────────────────────────────────────────┘ │
│         │                                                           │
│         │  [← Prev]  Halaman 1 dari 3  [Next →]                  │
│         │                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Modal Buat/Detail Bulletin:**
```
┌──────────────────────────────────────────────┐
│  Bulletin Baru                           [×] │
│  ────────────────────────────────────────    │
│  Judul:     [________________________]       │
│  Kategori:  [Pengumuman ▼]                   │
│  Prioritas: [Normal ▼]                       │
│                                              │
│  Konten:                                     │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │  (textarea)                          │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [Batalkan]              [Publikasikan]      │
└──────────────────────────────────────────────┘
```

**Elemen:**
- Card list dengan badge prioritas berwarna (merah/kuning/abu)
- Indikator "✅ Dibaca" pada bulletin yang sudah dibaca
- Search + filter kategori
- Modal create dengan judul, kategori, prioritas, konten (admin only)
- Pagination

---

## 5. Notes Page (Sticky Notes)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Catatan                                         │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  [🔍 Cari catatan...]                      [+ Catatan]  │
│         │                                                           │
│         │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│         │  │ 📝            │ │ 📝            │ │ 📝            │    │
│         │  │ [bg kuning]  │ │ [bg hijau]   │ │ [bg biru]    │    │
│         │  │              │ │              │ │              │    │
│         │  │ Judul Note   │ │ Judul Note   │ │ Judul Note   │    │
│         │  │              │ │              │ │              │    │
│         │  │ Isi catatan  │ │ Isi catatan  │ │ Isi catatan  │    │
│         │  │ singkat...   │ │ singkat...   │ │ singkat...   │    │
│         │  │              │ │              │ │              │    │
│         │  │ 📌  [🗑 ✏]  │ │      [🗑 ✏]  │ │ 📌  [🗑 ✏]  │    │
│         │  └──────────────┘ └──────────────┘ └──────────────┘    │
│         │                                                           │
│         │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│         │  │ 📝            │ │ 📝            │ │              │    │
│         │  │ [bg merah m] │ │ [bg ungu]    │ │  + Tambah    │    │
│         │  │ ...          │ │ ...          │ │   Catatan    │    │
│         │  └──────────────┘ └──────────────┘ └──────────────┘    │
│         │                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Modal Buat/Edit Note:**
```
┌──────────────────────────────────────────────┐
│  Catatan Baru                            [×] │
│  ────────────────────────────────────────    │
│  Judul:   [________________________]         │
│                                              │
│  Warna:   [🟡] [🟢] [🔵] [🔴] [🟣]         │
│                                              │
│  Isi:                                        │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │  (textarea)                          │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  📌 Pin catatan ini                          │
│                                              │
│  [Batalkan]                    [Simpan]      │
└──────────────────────────────────────────────┘
```

**Elemen:**
- Grid masonry/equal 3 kolom sticky note
- Warna berbeda per note (kuning, hijau, biru, merah muda, ungu)
- Pin note (tampil di atas), delete, edit per note
- Kartu "+" untuk tambah note baru

---

## 6. Database Links Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Database & Links                                │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  [🔍 Cari link...]   [Filter: Semua Kategori ▼]  [+ Add]│
│         │                                                           │
│         │  OPERASIONAL                                             │
│         │  ┌───────────────────────────────────────────────────┐  │
│         │  │  🔗  Spreadsheet Absensi         [Google Sheets]  │  │
│         │  │      Rekap absensi harian dan bulanan  [Buka →]  │  │
│         │  ├───────────────────────────────────────────────────┤  │
│         │  │  🔗  SOP Operasional Gedung         [Google Drive] │  │
│         │  │      Dokumen SOP terbaru                [Buka →]  │  │
│         │  └───────────────────────────────────────────────────┘  │
│         │                                                           │
│         │  KEUANGAN                                                │
│         │  ┌───────────────────────────────────────────────────┐  │
│         │  │  🔗  Laporan Keuangan Q1 2026    [Google Sheets]  │  │
│         │  │      Budget dan realisasi Q1              [Buka →]  │  │
│         │  └───────────────────────────────────────────────────┘  │
│         │                                                           │
│         │  TEKNIK                                                  │
│         │  ┌───────────────────────────────────────────────────┐  │
│         │  │  🔗  CMMS Work Order System          [External]   │  │
│         │  │      Sistem manajemen work order          [Buka →]  │  │
│         │  └───────────────────────────────────────────────────┘  │
│         │                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Modal Tambah Link:**
```
┌──────────────────────────────────────────────┐
│  Tambah Link                             [×] │
│  ────────────────────────────────────────    │
│  Nama:      [________________________]       │
│  URL:       [https://...]                    │
│  Kategori:  [Operasional ▼]                  │
│  Deskripsi: [________________________]       │
│                                              │
│  [Batalkan]                    [Simpan]      │
└──────────────────────────────────────────────┘
```

**Elemen:**
- List dikelompokkan per kategori (Operasional, Keuangan, Teknik, dll)
- Badge tipe link (Google Sheets, Drive, External, dll)
- Search + filter kategori
- Tombol "Buka" langsung ke URL
- Edit/delete per item (owner atau admin)

---

## 7. Profile Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Profil Saya                                     │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  ┌──────────────────────────────────────────────────┐   │
│         │  │                                                  │   │
│         │  │   [  👤  ]   ← foto profil (click to change)    │   │
│         │  │                                                  │   │
│         │  │   Nama Lengkap      [Muhammad Sabian Athallah]  │   │
│         │  │   Username          [@sabian]                   │   │
│         │  │   Email             [sabian@sangroup.id]        │   │
│         │  │   No. Telepon       [+62 ...]                   │   │
│         │  │   Divisi            [HRD]                       │   │
│         │  │   Role              [ADMIN]                     │   │
│         │  │                                                  │   │
│         │  │   [Edit Profil]          [Ubah Password]        │   │
│         │  │                                                  │   │
│         │  └──────────────────────────────────────────────────┘   │
│         │                                                           │
│         │  ┌──────────────────────────────────────────────────┐   │
│         │  │  AKTIVITAS TERAKHIR                              │   │
│         │  │  ─────────────────────────────────────────────  │   │
│         │  │  Login terakhir: 18 Mei 2026, 09:24             │   │
│         │  │  Tugas selesai hari ini: 3                      │   │
│         │  └──────────────────────────────────────────────────┘   │
│         │                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Modal Ubah Password:**
```
┌──────────────────────────────────────────────┐
│  Ubah Password                           [×] │
│  ────────────────────────────────────────    │
│  Password Lama:  [________________] [👁]     │
│  Password Baru:  [________________] [👁]     │
│  Konfirmasi:     [________________] [👁]     │
│                                              │
│  [Batalkan]                    [Simpan]      │
└──────────────────────────────────────────────┘
```

**Elemen:**
- Avatar (klik untuk ganti foto)
- Info profil read-only dengan tombol edit inline
- Mode edit: field menjadi input yang bisa diubah
- Tombol "Ubah Password" buka modal terpisah
- Ringkasan aktivitas di bawah

---

## 8. Admin Panel (Super Admin only)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                           │
│         │  Header: Manajemen Pengguna                              │
│         │  ──────────────────────────────────────────────────────  │
│         │                                                           │
│         │  [🔍 Cari pengguna...]  [Filter: Semua Role ▼]  [+ User]│
│         │                                                           │
│         │  ┌──────────────────────────────────────────────────────┐│
│         │  │  #   Nama           Role        Divisi   Status  Aksi││
│         │  │  ─   ────           ────        ──────   ──────  ────││
│         │  │  1   [👤] Admin S.  SUPER_ADMIN MGMT     ● Aktif [✏]││
│         │  │  2   [👤] Budi BM   BUILDING_M  OPS      ● Aktif [✏]││
│         │  │  3   [👤] Sari HRD  HRD         HRD      ● Aktif [✏]││
│         │  │  4   [👤] Andi F.   FINANCE     FINANCE  ○ Non-aktif ││
│         │  │  ...                                                  ││
│         │  └──────────────────────────────────────────────────────┘│
│         │                                                           │
│         │  [← Prev]  Halaman 1 dari 2  [Next →]                  │
│         │                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Elemen:**
- Tabel pengguna dengan kolom: avatar+nama, role, divisi, status aktif/non-aktif
- Tombol edit per baris (modal edit: nama, role, divisi, status)
- Tombol tambah user (modal create dengan reset password)
- Filter role
- Hanya tampil di sidebar jika user = SUPER_ADMIN

---

## Responsive Notes (Mobile)

Untuk layar < 768px:
- Sidebar menjadi bottom navigation bar (5 ikon)
- Stat card dashboard stack 2x2
- Task list panel dan detail panel bergantian (tidak side-by-side)
- Note grid menjadi 2 kolom
- Tabel admin menjadi card list

---

## Color & Component Reference

```
Warna utama  : #1E293B (sidebar dark), #0F172A (bg gelap)
Accent       : #3B82F6 (blue-500, aktif/primary)
Success      : #22C55E (green-500)
Warning      : #F59E0B (amber-500)
Danger       : #EF4444 (red-500)
Text utama   : #F8FAFC (slate-50)
Text muted   : #94A3B8 (slate-400)

Komponen UI  : shadcn/ui (Button, Input, Modal, Badge, Avatar)
Font         : Inter (400, 500, 600)
Icon         : Lucide React
```
