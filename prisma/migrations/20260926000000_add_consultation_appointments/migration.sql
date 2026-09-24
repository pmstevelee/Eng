-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELED');

-- CreateTable
CREATE TABLE "consultation_appointments" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "counselor_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "rescheduled_from_id" TEXT,
    "consultation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_appointments_rescheduled_from_id_key" ON "consultation_appointments"("rescheduled_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_appointments_consultation_id_key" ON "consultation_appointments"("consultation_id");

-- CreateIndex
CREATE INDEX "consultation_appointments_counselor_id_scheduled_at_idx" ON "consultation_appointments"("counselor_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "consultation_appointments_lead_id_scheduled_at_idx" ON "consultation_appointments"("lead_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "consultation_appointments_scheduled_at_status_idx" ON "consultation_appointments"("scheduled_at", "status");

-- AddForeignKey
ALTER TABLE "consultation_appointments" ADD CONSTRAINT "consultation_appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_appointments" ADD CONSTRAINT "consultation_appointments_counselor_id_fkey" FOREIGN KEY ("counselor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_appointments" ADD CONSTRAINT "consultation_appointments_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "consultation_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_appointments" ADD CONSTRAINT "consultation_appointments_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

