# ERD — SAN Group Internal Management System

> Bahasa: Indonesia | ORM: Prisma | DB: PostgreSQL

---

## Ringkasan Fase

| Fase | Status | Cakupan |
|------|--------|---------|
| Phase 1 | ✅ Aktif | Auth, Tasks, Sticky Notes, Bulletin, Database Links, Notifikasi |
| Phase 2 | 🔒 Commented | Work Order, HRIS (Absensi, Cuti, Timetable) |
| Phase 3 | 🔒 Commented | Aset, Tenant, Booking Ruang Meeting, Utilitas |

---

## Phase 1 — Tabel Aktif

### 1. `User`
Tabel utama untuk semua pengguna sistem.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `email` | String (unique) | Email login |
| `username` | String (unique) | Username tampil |
| `password` | String | Bcrypt hash |
| `fullName` | String | Nama lengkap |
| `phone` | String? | No. telepon |
| `avatar` | String? | Path foto profil |
| `role` | Enum `Role` | Hak akses (lihat enum di bawah) |
| `division` | Enum `Division` | Divisi tempat bertugas |
| `isActive` | Boolean | Status aktif akun |
| `lastLoginAt` | DateTime? | Timestamp login terakhir |

**Relasi:** User `hasMany` RefreshToken, Task (sebagai creator & assignee), TaskList, TaskAttachment, StickyNote, Bulletin, BulletinReadStatus, Notification (sebagai penerima & aktor), DatabaseLink.

---

### 2. `RefreshToken`
Menyimpan refresh token JWT per sesi login. Mendukung multi-device login.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `token` | String (unique) | Token string |
| `expiresAt` | DateTime | Kapan token kadaluarsa |
| `userId` | FK → User | Pemilik token |

**Cascade:** Hapus otomatis jika User dihapus.

---

### 3. `TaskList`
Daftar kustom milik user untuk mengelompokkan Task (mirip "List" di Microsoft To Do).

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `name` | String | Nama list |
| `color` | String | Warna hex (default `#6366f1`) |
| `icon` | String? | Emoji/icon |
| `position` | Int | Urutan tampil |
| `userId` | FK → User | Pemilik list |

---

### 4. `Task`
Tugas/to-do item. Bisa personal (userId) atau di-assign ke orang lain (assignedToId). Mendukung sub-task via `parentTaskId` self-reference.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `title` | String | Judul tugas |
| `status` | Enum `TaskStatus` | TODO / IN_PROGRESS / DONE |
| `priority` | Enum `TaskPriority` | LOW / MEDIUM / HIGH / URGENT |
| `category` | Enum `TaskCategory` | MY_DAY / IMPORTANT / PLANNED / CUSTOM |
| `dueDate` | DateTime? | Deadline |
| `completedAt` | DateTime? | Timestamp selesai |
| `position` | Int | Urutan dalam list |
| `userId` | FK → User | Pembuat tugas |
| `assignedToId` | FK → User? | Penerima tugas (nullable) |
| `listId` | FK → TaskList? | List tempat tugas (nullable) |
| `parentTaskId` | FK → Task? | Parent jika ini sub-task (self-reference) |

**Cascade:** Hapus otomatis jika creator/parent Task dihapus. `assignedToId` di-set NULL jika assignee dihapus.

---

### 5. `TaskAttachment`
File lampiran yang diupload ke sebuah Task.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `fileName` | String | Nama asli file |
| `filePath` | String | Path di server |
| `fileSize` | Int | Ukuran dalam bytes |
| `mimeType` | String | MIME type file |
| `taskId` | FK → Task | Task yang dilampiri |
| `uploadedById` | FK → User | Yang mengupload |

---

### 6. `StickyNote`
Catatan cepat personal milik user (sticky note digital).

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `title` | String? | Judul opsional |
| `content` | String | Isi catatan |
| `color` | String | Warna note (yellow/blue/green/red/purple) |
| `isPinned` | Boolean | Apakah disematkan di atas |
| `position` | Int | Urutan tampil |
| `userId` | FK → User | Pemilik |

---

### 7. `Bulletin`
Pengumuman resmi perusahaan yang dapat diterbitkan ke semua karyawan.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `title` | String | Judul pengumuman |
| `content` | String | Isi (HTML/rich text) |
| `category` | Enum `BulletinCategory` | ANNOUNCEMENT / HOLIDAY / MAINTENANCE / EVENT / GENERAL |
| `priority` | Enum `BulletinPriority` | NORMAL / IMPORTANT / URGENT |
| `isPublished` | Boolean | Draft atau sudah publish |
| `publishedAt` | DateTime? | Waktu publish |
| `expiresAt` | DateTime? | Kapan bulletin kadaluarsa |
| `authorId` | FK → User | Pembuat bulletin |

---

### 8. `BulletinAttachment`
File lampiran untuk Bulletin.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `bulletinId` | FK → Bulletin | Bulletin yang dilampiri |
| `fileName` / `filePath` / `fileSize` / `mimeType` | — | Metadata file |

---

### 9. `BulletinReadStatus`
Melacak siapa saja yang sudah membaca sebuah Bulletin. Unique constraint pada `(bulletinId, userId)`.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `bulletinId` | FK → Bulletin | Bulletin yang dibaca |
| `userId` | FK → User | Pembaca |
| `readAt` | DateTime | Waktu dibaca |

---

### 10. `DatabaseLink`
Kumpulan link/URL penting yang diorganisir per divisi (Google Drive, portal bank, sistem internal, dll).

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `title` | String | Nama link |
| `description` | String? | Penjelasan singkat |
| `url` | String | URL tujuan |
| `category` | String | Kategori bebas (Cloud Storage, Banking, dll) |
| `division` | Enum `Division` | Divisi pemilik |
| `icon` | String? | Emoji/icon |
| `position` | Int | Urutan tampil |
| `createdById` | FK → User | Yang menambahkan |

---

### 11. `Notification`
Notifikasi in-app yang dikirim ke user tertentu saat ada event (task assigned, bulletin urgent, dll).

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `type` | Enum `NotificationType` | Jenis event |
| `title` | String | Judul notifikasi |
| `message` | String | Pesan detail |
| `link` | String? | URL halaman terkait |
| `isRead` | Boolean | Sudah dibaca? |
| `userId` | FK → User | Penerima notifikasi |
| `actorId` | FK → User? | Yang mentrigger (nullable untuk sistem) |

---

## Enum Reference

### `Role`
```
SUPER_ADMIN | ADMIN | BUILDING_MANAGER | TENANT_RELATIONS | ENGINEER
HRD | OPS | FINANCE | LEGAL | MARKOM | GA | PROJECT | STAFF | OWNER
```

### `Division`
```
HRD | OPS | FINANCE | LEGAL | MARKOM | GA | PROJECT | MANAGEMENT | ENGINEERING
```

### `TaskStatus`
```
TODO → IN_PROGRESS → DONE
```

### `TaskPriority`
```
LOW | MEDIUM | HIGH | URGENT
```

### `BulletinCategory`
```
ANNOUNCEMENT | HOLIDAY | MAINTENANCE | EVENT | GENERAL
```

### `NotificationType`
```
TASK_ASSIGNED | TASK_COMPLETED | BULLETIN_NEW | BULLETIN_URGENT | SYSTEM
```

---

## Diagram Relasi (Teks)

```
User ─┬──< RefreshToken
      ├──< Task (creator) >── TaskList
      ├──< Task (assignee)
      ├──< TaskAttachment
      ├──< StickyNote
      ├──< Bulletin >── BulletinAttachment
      ├──< BulletinReadStatus >── Bulletin
      ├──< Notification (recipient)
      ├──< Notification (actor)
      └──< DatabaseLink

Task ──< TaskAttachment
Task ──< Task (sub-tasks via parentTaskId, self-reference)
```

---

## Phase 2 — Tabel (Commented Out)

Akan diaktifkan saat pengembangan Phase 2:
- `WorkOrder` — sistem work order teknis gedung
- `WorkOrderHistory` — riwayat perubahan status WO
- `WorkOrderAttachment` — lampiran WO
- `Attendance` — absensi clock in/out karyawan
- `Leave` — pengajuan cuti
- `LeaveBalance` — saldo cuti per tahun
- `Timetable` — jadwal shift karyawan

## Phase 3 — Tabel (Commented Out)

Akan diaktifkan saat pengembangan Phase 3:
- `Asset` + `AssetCategory` + `AssetHistory` — manajemen aset & inventaris
- `Tenant` + `TenantDocument` + `TenantReminder` — database tenant gedung
- `MeetingRoom` + `Booking` — pemesanan ruang meeting
- `UtilityRecord` — pencatatan utilitas (listrik, air, gas)
