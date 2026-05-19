# SAN Group Internal Management System

Sistem manajemen internal berbasis web untuk PT SAN Group (property/building management).

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Backend   | Node.js, Express.js, TypeScript               |
| Frontend  | React, Vite, TypeScript                       |
| Database  | PostgreSQL + Prisma ORM                       |
| Auth      | JWT (access token + refresh token)            |
| Styling   | Tailwind CSS + shadcn/ui                      |
| State     | Zustand                                       |
| File      | Multer (local storage)                        |

## Project Structure

```
san-group-system/
├── backend/      # Express API server
├── frontend/     # React SPA
└── docs/         # ERD, API contract, brand guide
```

## Setup Dev Environment

### Prerequisites
- Node.js >= 20
- PostgreSQL running locally
- npm >= 10

### Installation

```bash
# Install all dependencies
npm install

# Setup environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Generate Prisma client
cd backend && npx prisma generate

# Run migrations (once schema is defined)
cd backend && npx prisma migrate dev
```

### Running Dev Servers

```bash
# Run both backend & frontend
npm run dev

# Backend only (port 3000)
npm run dev:be

# Frontend only (port 5173)
npm run dev:fe
```

## Modules

- **Auth** — login, logout, refresh token
- **Dashboard** — ringkasan data & notifikasi
- **Task Management** — penugasan & tracking pekerjaan
- **Bulletin Board** — pengumuman internal
- **User Management** — admin panel kelola pengguna
# development branch active
