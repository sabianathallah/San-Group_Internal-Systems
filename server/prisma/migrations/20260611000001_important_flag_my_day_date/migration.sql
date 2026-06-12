-- Split "category" into independent fields:
--   isImportant (boolean flag, can coexist with My Day)
--   myDayDate   (date the task was added to My Day — enables daily reset)

ALTER TABLE "Task" ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "myDayDate" DATE;

-- Migrate existing data
UPDATE "Task" SET "isImportant" = true WHERE "category" = 'IMPORTANT';
UPDATE "Task" SET "myDayDate" = (NOW() AT TIME ZONE 'Asia/Jakarta')::date WHERE "category" = 'MY_DAY';

ALTER TABLE "Task" DROP COLUMN "category";
DROP TYPE "TaskCategory";

CREATE INDEX "Task_myDayDate_idx" ON "Task"("myDayDate");
CREATE INDEX "Task_isImportant_idx" ON "Task"("isImportant");
