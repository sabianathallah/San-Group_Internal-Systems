import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { env } from '@/config/env';

// Initialize Cloudinary (side-effect import for config)
import '@/config/cloudinary';

// ── Local disk storage (task/bulletin attachments, PDFs, docs) ──────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureDir(env.UPLOAD_DIR)),
  filename:    (_req, file, cb) => {
    const uid = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uid}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true);
  else cb(new Error('Invalid file type'));
}

function imageFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Invalid file type'));
}

export const upload = multer({ storage: diskStorage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });

// ── Cloudinary storages ──────────────────────────────────────────────────────

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:           'san-group/avatars',
    allowed_formats:  ['jpg', 'jpeg', 'png', 'webp'],
    transformation:   [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    public_id: (_req: Request, file: Express.Multer.File) => {
      return `avatar_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    },
  } as object,
});

const attendancePhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'san-group/attendance',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 800, height: 800, crop: 'limit', quality: 'auto:good' }],
    public_id: (_req: Request, file: Express.Multer.File) => {
      return `attendance_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    },
  } as object,
});

const wallpaperStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'san-group/wallpapers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 1600, height: 400, crop: 'fill', gravity: 'auto', quality: 'auto' }],
    public_id: (_req: Request, file: Express.Multer.File) => {
      return `wallpaper_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    },
  } as object,
});

const leaveDocStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:           'san-group/leave-docs',
    allowed_formats:  ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type:    'auto',
    public_id: (_req: Request, file: Express.Multer.File) => {
      return `leave_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    },
  } as object,
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadAttendancePhoto = multer({
  storage: attendancePhotoStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadLeaveDoc = multer({
  storage: leaveDocStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
});

export const uploadWallpaper = multer({
  storage: wallpaperStorage,
  limits:  { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// ── Magic-byte validation (for local disk uploads only) ──────────────────────

const IMAGE_SIGNATURES: { bytes: number[]; mask?: number[] }[] = [
  { bytes: [0xff, 0xd8, 0xff] },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { bytes: [0x47, 0x49, 0x46, 0x38] },
  { bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    mask:  [0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff] },
];

function matchesSignature(buf: Buffer): boolean {
  return IMAGE_SIGNATURES.some(({ bytes, mask }) =>
    bytes.every((b, i) => {
      const m = mask ? mask[i] : 0xff;
      return (buf[i] & m) === (b & m);
    }),
  );
}

function deleteFile(filePath: string) { fs.unlink(filePath, () => {}); }

export function validateImageMagicBytes(req: Request, res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file || !file.path) { next(); return; }

  const buf = Buffer.alloc(12);
  let fd: number;
  try {
    fd = fs.openSync(file.path, 'r');
  } catch {
    deleteFile(file.path);
    res.status(400).json({ success: false, message: 'File tidak dapat dibaca' });
    return;
  }

  try { fs.readSync(fd, buf, 0, 12, 0); }
  finally { fs.closeSync(fd); }

  if (!matchesSignature(buf)) {
    deleteFile(file.path);
    res.status(400).json({ success: false, message: 'Tipe file tidak valid' });
    return;
  }

  next();
}

// ── Cloudinary delete helper ─────────────────────────────────────────────────

export async function deleteFromCloudinary(publicIdOrUrl: string): Promise<void> {
  try {
    // If full URL, extract public_id
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.startsWith('http')) {
      const parts = publicIdOrUrl.split('/');
      const uploadIdx = parts.indexOf('upload');
      if (uploadIdx !== -1) {
        const afterUpload = parts.slice(uploadIdx + 2); // skip version
        publicId = afterUpload.join('/').replace(/\.[^/.]+$/, '');
      }
    }
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Non-critical — log but don't throw
    console.warn('[Cloudinary] Failed to delete:', publicIdOrUrl);
  }
}
