-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('ALIMTALK', 'SMS', 'LMS');

-- CreateEnum
CREATE TYPE "MessageSendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "appointment_id" TEXT,
    "phone" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "status" "MessageSendStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_dedupe_key_key" ON "notification_logs"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_logs_lead_id_created_at_idx" ON "notification_logs"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_academy_id_created_at_idx" ON "notification_logs"("academy_id", "created_at");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "consultation_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

