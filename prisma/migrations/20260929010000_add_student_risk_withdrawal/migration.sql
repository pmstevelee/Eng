-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NORMAL', 'WATCH', 'RISK');

-- CreateEnum
CREATE TYPE "WithdrawalReason" AS ENUM ('PRICE', 'SCHEDULE', 'OTHER_ACADEMY', 'MOVE', 'LOW_SATISFACTION', 'STUDY_BREAK', 'OTHER');

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "withdrawal_reason" "WithdrawalReason",
ADD COLUMN     "withdrawn_on" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "student_risk_snapshots" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "reasons" JSONB NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_risk_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_risk_snapshots_student_id_key" ON "student_risk_snapshots"("student_id");

-- CreateIndex
CREATE INDEX "student_risk_snapshots_academy_id_level_idx" ON "student_risk_snapshots"("academy_id", "level");

-- AddForeignKey
ALTER TABLE "student_risk_snapshots" ADD CONSTRAINT "student_risk_snapshots_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_risk_snapshots" ADD CONSTRAINT "student_risk_snapshots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

