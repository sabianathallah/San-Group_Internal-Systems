-- Add NONE to TaskCategory enum and change default
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TABLE "Task" ALTER COLUMN "category" SET DEFAULT 'NONE';
