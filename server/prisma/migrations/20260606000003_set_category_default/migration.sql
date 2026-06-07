-- Set default for category column (separate from enum ADD VALUE due to PostgreSQL limitation)
ALTER TABLE "Task" ALTER COLUMN "category" SET DEFAULT 'NONE';
