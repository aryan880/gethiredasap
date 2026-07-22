-- AlterTable
ALTER TABLE "saved_searches"
ADD COLUMN "matchMode" TEXT NOT NULL DEFAULT 'balanced';
