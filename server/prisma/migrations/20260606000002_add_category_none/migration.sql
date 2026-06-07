-- Add NONE to TaskCategory enum
-- Note: SET DEFAULT must be applied after the transaction commits (PostgreSQL limitation)
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'NONE';
