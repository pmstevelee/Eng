-- CreateEnum
CREATE TYPE "LeadChannel" AS ENUM ('PHONE', 'VISIT', 'NAVER', 'KAKAO', 'WEB', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'SCHEDULED', 'CONSULTED', 'PENDING', 'ENROLLED', 'ON_HOLD', 'LOST');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('PRICE', 'SCHEDULE', 'OTHER_ACADEMY', 'NO_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('INITIAL', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "parent_name" TEXT,
    "phone" TEXT NOT NULL,
    "grade" TEXT,
    "school" TEXT,
    "preferred_schedule" TEXT,
    "channel" "LeadChannel" NOT NULL DEFAULT 'PHONE',
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "lost_reason" "LostReason",
    "lost_reason_note" TEXT,
    "assignee_id" TEXT,
    "student_id" TEXT,
    "privacy_consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "counselor_id" TEXT,
    "consulted_at" TIMESTAMP(3) NOT NULL,
    "type" "ConsultationType" NOT NULL DEFAULT 'INITIAL',
    "learning_history" TEXT,
    "prev_academy" TEXT,
    "goal" TEXT,
    "parent_needs" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "from_status" "LeadStatus",
    "to_status" "LeadStatus" NOT NULL,
    "changed_by_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_student_id_key" ON "leads"("student_id");

-- CreateIndex
CREATE INDEX "leads_academy_id_phone_idx" ON "leads"("academy_id", "phone");

-- CreateIndex
CREATE INDEX "leads_academy_id_status_idx" ON "leads"("academy_id", "status");

-- CreateIndex
CREATE INDEX "leads_assignee_id_idx" ON "leads"("assignee_id");

-- CreateIndex
CREATE INDEX "consultations_lead_id_consulted_at_idx" ON "consultations"("lead_id", "consulted_at");

-- CreateIndex
CREATE INDEX "consultations_counselor_id_idx" ON "consultations"("counselor_id");

-- CreateIndex
CREATE INDEX "lead_status_history_lead_id_changed_at_idx" ON "lead_status_history"("lead_id", "changed_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_counselor_id_fkey" FOREIGN KEY ("counselor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

