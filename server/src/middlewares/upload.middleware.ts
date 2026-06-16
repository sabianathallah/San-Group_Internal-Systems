import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { env } from '@/config/env';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function ensureUploadDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadDir(env.UPLOAD_DIR));
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadDir(path.join(env.UPLOAD_DIR, 'avatars')));
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
}

function imageFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
}

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for avatars
  fileFilter: imageFilter,
});

// Magic-byte signatures for allowed image types.
// Checked after multer saves to disk to prevent MIME spoofing.
const IMAGE_SIGNATURES: { bytes: number[]; mask?: number[] }[] = [
  { bytes: [0xff, 0xd8, 0xff] },                                           // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },           // PNG
  { bytes: [0x47, 0x49, 0x46, 0x38] },                                     // GIF (GIF8)
  { bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], // WebP: RIFF....WEBP
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

function deleteFile(filePath: string) {
  fs.unlink(filePath, () => {});
}

export function validateImageMagicBytes(req: Request, res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file) { next(); return; }

  const buf = Buffer.alloc(12);
  let fd: number;
  try {
    fd = fs.openSync(file.path, 'r');
  } catch {
    deleteFile(file.path);
    res.status(400).json({ success: false, message: 'File tidak dapat dibaca' });
    return;
  }

  try {
    fs.readSync(fd, buf, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (!matchesSignature(buf)) {
    deleteFile(file.path);
    res.status(400).json({ success: false, message: 'Tipe file tidak valid' });
    return;
  }

  next();
}
