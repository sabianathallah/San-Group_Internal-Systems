-- Personal-first model: new tasks are "My Task" (creator + assignee only) by default.
-- Existing tasks keep their current visibility — only the default for new rows changes.
ALTER TABLE "Task" ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE';
