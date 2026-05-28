# API Contract

**Base URL:** `http://localhost:3000/api`
**Production:** sesuaikan dengan URL Railway deployment

---

## Conventions

- **Response format:** `{ success: boolean, data: T | null, message: string, meta?: PaginationMeta }`
- **Pagination meta:** `{ total: number, page: number, limit: number, totalPages: number }`
- **Auth:** Bearer token via `Authorization: Bearer <token>` header
- **Errors:** HTTP status + `{ success: false, message: string, errors?: object }`
- **Validation errors (422):** `errors` berisi field-level messages dari Zod

---

## Auth

### POST /api/auth/login
Login dengan email atau username.

**Body:** `{ identifier: string, password: string }`

**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": { "id", "email", "username", "fullName", "role", "division", "avatar" }
  }
}
```
Sets `refresh_token` httpOnly cookie.

---

### POST /api/auth/logout
Invalidate refresh token. Tidak butuh body.

**Response 200:** `{ success: true }`

---

### POST /api/auth/refresh
Dapatkan access token baru menggunakan refresh token cookie.

**Response 200:** `{ data: { accessToken: string } }`

---

### GET /api/auth/me 🔒
Ambil profil user yang sedang login.

**Response 200:** `{ data: User }`

---

### PATCH /api/auth/change-password 🔒
**Body:** `{ oldPassword, newPassword, confirmPassword }`

**Response 200:** `{ success: true }`
Invalidates semua refresh token user.

---

### POST /api/auth/register 🔒 [SUPER_ADMIN, ADMIN]
Daftarkan user baru.

**Body:** `{ email, username, password, fullName, division, role?, phone? }`

**Response 201:** `{ data: User }`

---

## Users

### GET /api/users 🔒
List semua user dengan pagination.

**Query:** `page`, `limit`, `search`, `role`, `division`, `isActive`

**Response 200:** `{ data: User[], meta }`

---

### GET /api/users/:id 🔒
**Response 200:** `{ data: User }`

---

### POST /api/users 🔒 [SUPER_ADMIN, ADMIN]
Buat user baru (sama seperti register tapi tanpa autentikasi terpisah).

**Body:** sama dengan `/auth/register`

**Response 201:** `{ data: User }`

---

### PATCH /api/users/me 🔒
Update profil sendiri (fullName, phone).

**Body:** `{ fullName?, phone? }`

**Response 200:** `{ data: User }`

---

### PATCH /api/users/me/avatar 🔒
Upload avatar. `multipart/form-data`, field `avatar`.

**Response 200:** `{ data: { avatar: string } }`

---

### PATCH /api/users/:id 🔒 [SUPER_ADMIN, ADMIN]
Update user lain (role, division, isActive, dll).

**Response 200:** `{ data: User }`

---

### PATCH /api/users/:id/toggle 🔒 [SUPER_ADMIN, ADMIN]
Toggle `isActive` user.

**Response 200:** `{ data: { isActive: boolean } }`

---

### DELETE /api/users/:id 🔒 [SUPER_ADMIN, ADMIN]
**Response 200:** `{ success: true }`

---

## Tasks

### GET /api/tasks 🔒
List task. STAFF hanya lihat milik sendiri atau yang di-assign ke mereka. ADMIN lihat semua.

**Query:** `page`, `limit`, `search`, `status` (TODO|IN_PROGRESS|DONE), `priority` (LOW|MEDIUM|HIGH|URGENT), `category` (MY_DAY|IMPORTANT|PLANNED|CUSTOM), `userId` (admin only)

**Response 200:** `{ data: Task[], meta }`

---

### POST /api/tasks 🔒
**Body:** `{ title, description?, status?, priority?, category?, dueDate?, assignedToId?, listId?, parentTaskId? }`

**Response 201:** `{ data: Task }`

---

### GET /api/tasks/:id 🔒
STAFF hanya bisa akses task milik sendiri. ADMIN akses semua.

**Response 200:** `{ data: Task & { subTasks: Task[] } }`

---

### PATCH /api/tasks/:id 🔒
Pemilik atau assignee bisa update. ADMIN bisa update semua.

**Body:** field yang ingin diubah (semua opsional)

**Response 200:** `{ data: Task }`

---

### DELETE /api/tasks/:id 🔒
Pemilik bisa hapus. ADMIN bisa hapus semua.

**Response 200:** `{ success: true }`

---

## Notes (Sticky Notes)

### GET /api/notes 🔒
List note milik user sendiri. Pinned muncul di atas.

**Query:** `search`, `color`, `isPinned`

**Response 200:** `{ data: Note[] }`

---

### POST /api/notes 🔒
**Body:** `{ content, title?, color?, isPinned? }`

Colors: `yellow` | `blue` | `green` | `pink` | `purple` | `gray` | `orange`

**Response 201:** `{ data: Note }`

---

### GET /api/notes/:id 🔒
Hanya milik user sendiri.

**Response 200:** `{ data: Note }`

---

### PATCH /api/notes/:id 🔒
**Body:** `{ title?, content?, color?, isPinned?, position? }`

**Response 200:** `{ data: Note }`

---

### DELETE /api/notes/:id 🔒
**Response 200:** `{ success: true }`

---

## Bulletins

### GET /api/bulletins 🔒
ADMIN lihat semua (termasuk draft). STAFF hanya lihat yang published & belum expired.

**Query:** `page`, `limit`, `search`, `category`, `priority`, `isPublished` (admin only)

**Response 200:** `{ data: (Bulletin & { isRead: boolean })[], meta }`

---

### POST /api/bulletins 🔒 [SUPER_ADMIN, ADMIN, BUILDING_MANAGER, HRD]
**Body:** `{ title, content, category?, priority?, isPublished?, expiresAt? }`

Categories: `ANNOUNCEMENT|HOLIDAY|MAINTENANCE|EVENT|GENERAL`
Priorities: `NORMAL|IMPORTANT|URGENT`

**Response 201:** `{ data: Bulletin }`

---

### GET /api/bulletins/:id 🔒
Auto mark-as-read ketika staff membuka bulletin yang published.

**Response 200:** `{ data: Bulletin & { isRead: boolean } }`

---

### PATCH /api/bulletins/:id 🔒 [SUPER_ADMIN, ADMIN, BUILDING_MANAGER, HRD]
**Body:** field yang ingin diubah

**Response 200:** `{ data: Bulletin }`

---

### DELETE /api/bulletins/:id 🔒 [SUPER_ADMIN, ADMIN, BUILDING_MANAGER, HRD]
**Response 200:** `{ success: true }`

---

## Database Links

### GET /api/db-links 🔒
List semua link. Semua user bisa lihat.

**Query:** `search`, `division`, `category`

**Response 200:** `{ data: DatabaseLink[] }`

---

### POST /api/db-links 🔒
**Body:** `{ title, url, category, division, description?, icon? }`

**Response 201:** `{ data: DatabaseLink }`

---

### PATCH /api/db-links/:id 🔒
Pemilik atau ADMIN bisa update.

**Body:** `{ title?, description?, url?, category?, division?, icon?, position? }`

**Response 200:** `{ data: DatabaseLink }`

---

### DELETE /api/db-links/:id 🔒
Pemilik atau ADMIN bisa hapus.

**Response 200:** `{ success: true }`

---

## Notifications

### GET /api/notifications 🔒
List 30 notifikasi terbaru milik user.

**Response 200:** `{ data: Notification[] }`

---

### GET /api/notifications/unread-count 🔒
**Response 200:** `{ data: number }`

---

### PATCH /api/notifications/:id/read 🔒
Mark satu notifikasi sebagai dibaca.

**Response 200:** `{ data: Notification }`

---

### PATCH /api/notifications/read-all 🔒
Mark semua notifikasi milik user sebagai dibaca.

**Response 200:** `{ success: true }`

---

## Health Check

### GET /api/health
**Response 200:**
```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "...", "uptime": 123, "env": "development" }
}
```

---

*🔒 = Requires `Authorization: Bearer <accessToken>`*
*[ROLE] = Requires specific role(s)*
