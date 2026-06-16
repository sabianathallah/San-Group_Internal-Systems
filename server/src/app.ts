import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from '@/config/env';
import { generalLimiter } from '@/middlewares/rateLimiter.middleware';
import { globalErrorHandler, notFound } from '@/middlewares/errorHandler.middleware';
import authRoutes from '@/routes/auth.routes';
import userRoutes from '@/routes/user.routes';
import taskRoutes from '@/routes/task.routes';
import bulletinRoutes from '@/routes/bulletin.routes';
import noteRoutes from '@/routes/note.routes';
import dblinkRoutes from '@/routes/dblink.routes';
import dbfolderRoutes from '@/routes/dbfolder.routes';
import notificationRoutes from '@/routes/notification.routes';
import taskListRoutes from '@/routes/task-list.routes';
import divisionRoutes from '@/routes/division.routes';
import roleRoutes from '@/routes/role.routes';
import permissionRoutes from '@/routes/permission.routes';
import shareRoutes from '@/routes/share.routes';
import searchRoutes from '@/routes/search.routes';
import analyticsRoutes from '@/routes/analytics.routes';
import auditRoutes from '@/routes/audit.routes';
import scheduledAnnouncementRoutes from '@/routes/scheduled-announcement.routes';

const app = express();

// Trust Railway/Vercel proxy so express-rate-limit can read the real client IP
app.set('trust proxy', 1);

// ── Security ───────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Logging ────────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Rate Limiting ──────────────────────────────────────────
app.use(generalLimiter);

// ── Static Files ───────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server berjalan normal',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      env: env.NODE_ENV,
    },
  });
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/bulletins', bulletinRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/db-links',   dblinkRoutes);
app.use('/api/db-folders', dbfolderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/task-lists', taskListRoutes);
app.use('/api/divisions', divisionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/scheduled-announcements', scheduledAnnouncementRoutes);

// ── Error Handling ─────────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

export default app;
