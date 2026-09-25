-- CreateEnum
CREATE TYPE "LeadPurgeTrigger" AS ENUM ('AUTO', 'MANUAL');

-- AlterEnum
ALTER TYPE "LeadActivityType" ADD VALUE 'RETENTION_EXTENDED';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "purged_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lead_purge_logs" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "trigger" "LeadPurgeTrigger" NOT NULL,
    "count" INTEGER NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_purge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_purge_logs_academy_id_created_at_idx" ON "lead_purge_logs"("academy_id", "created_at");

-- AddForeignKey
ALTER TABLE "lead_purge_logs" ADD CONSTRAINT "lead_purge_logs_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

