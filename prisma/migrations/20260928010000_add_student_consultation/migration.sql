-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConsultationType" ADD VALUE 'REGULAR';
ALTER TYPE "ConsultationType" ADD VALUE 'RETENTION';
ALTER TYPE "ConsultationType" ADD VALUE 'WITHDRAWAL';

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "parent_phone" TEXT;

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "parent_comment" TEXT,
ADD COLUMN     "report_expires_at" TIMESTAMP(3),
ADD COLUMN     "report_snapshot" JSONB,
ADD COLUMN     "report_token" TEXT,
ADD COLUMN     "student_id" TEXT,
ALTER COLUMN "lead_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "consultation_appointments" ADD COLUMN     "student_id" TEXT,
ALTER COLUMN "lead_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN     "consultation_id" TEXT,
ADD COLUMN     "student_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "consultations_report_token_key" ON "consultations"("report_token");

-- CreateIndex
CREATE INDEX "consultations_student_id_consulted_at_idx" ON "consultations"("student_id", "consulted_at");

-- CreateIndex
CREATE INDEX "consultation_appointments_student_id_scheduled_at_idx" ON "consultation_appointments"("student_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "notification_logs_student_id_created_at_idx" ON "notification_logs"("student_id", "created_at");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_appointments" ADD CONSTRAINT "consultation_appointments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 문의(lead) 또는 재원생(student) 중 하나는 반드시 있어야 함
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_target_check" CHECK ("lead_id" IS NOT NULL OR "student_id" IS NOT NULL);
ALTER TABLE "consultation_appointments" ADD CONSTRAINT "consultation_appointments_target_check" CHECK ("lead_id" IS NOT NULL OR "student_id" IS NOT NULL);

-- 문의에서 전환된 학생은 문의 연락처를 학부모 연락처 기본값으로
UPDATE "students" s SET "parent_phone" = l."phone"
FROM "leads" l
WHERE l."student_id" = s."id" AND s."parent_phone" IS NULL;
