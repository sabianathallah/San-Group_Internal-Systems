import { Prisma } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const NOTE_SELECT = {
  id:        true,
  title:     true,
  content:   true,
  color:     true,
  isPinned:  true,
  position:  true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listNotesService(userId: string, query: ParsedQs) {
  const where: Prisma.StickyNoteWhereInput = { userId };

  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ title: s }, { content: s }];
  }
  if (query.color && typeof query.color === 'string') {
    where.color = query.color;
  }
  if (query.isPinned !== undefined) {
    where.isPinned = query.isPinned === ('true' as unknown) || query.isPinned === (true as unknown);
  }

  return prisma.stickyNote.findMany({
    where,
    select: NOTE_SELECT,
    orderBy: [{ isPinned: 'desc' }, { position: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getNoteByIdService(id: string, userId: string) {
  const note = await prisma.stickyNote.findFirst({ where: { id, userId }, select: NOTE_SELECT });
  if (!note) throw new AppError('Note tidak ditemukan', 404);
  return note;
}

export async function createNoteService(
  userId: string,
  data: { title?: string; content: string; color?: string; isPinned?: boolean },
) {
  const count = await prisma.stickyNote.count({ where: { userId } });

  return prisma.stickyNote.create({
    data: {
      title:    data.title,
      content:  data.content,
      color:    data.color    ?? 'yellow',
      isPinned: data.isPinned ?? false,
      position: count,
      userId,
    },
    select: NOTE_SELECT,
  });
}

export async function updateNoteService(
  id: string,
  userId: string,
  data: {
    title?:    string | null;
    content?:  string;
    color?:    string;
    isPinned?: boolean;
    position?: number;
  },
) {
  const exists = await prisma.stickyNote.findFirst({ where: { id, userId }, select: { id: true } });
  if (!exists) throw new AppError('Note tidak ditemukan', 404);

  return prisma.stickyNote.update({
    where: { id },
    data: {
      ...(data.title    !== undefined && { title:    data.title }),
      ...(data.content  !== undefined && { content:  data.content }),
      ...(data.color    !== undefined && { color:    data.color }),
      ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
      ...(data.position !== undefined && { position: data.position }),
    },
    select: NOTE_SELECT,
  });
}

export async function deleteNoteService(id: string, userId: string) {
  const exists = await prisma.stickyNote.findFirst({ where: { id, userId }, select: { id: true } });
  if (!exists) throw new AppError('Note tidak ditemukan', 404);
  await prisma.stickyNote.delete({ where: { id } });
}
