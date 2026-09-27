-- 출결관리 4단계: 알림 크레딧 · 출결 알림 발송 작업
-- (PaymentType에 값 추가 — 이 마이그레이션 안에서는 새 값을 사용하지 않음)

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('CHARGE', 'USE', 'REFUND', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "CreditChannel" AS ENUM ('ALIMTALK', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationJobType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'ABSENT_ALERT');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_NO_CREDIT', 'SKIPPED_DUPLICATE');

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'NOTIFICATION_CREDIT';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "credit_wallets" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "low_balance_threshold" INTEGER NOT NULL DEFAULT 500,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "payment_id" TEXT,
    "notification_job_id" TEXT,
    "memo" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_pricings" (
    "id" TEXT NOT NULL,
    "channel" "CreditChannel" NOT NULL,
    "credit_per_message" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price_krw" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "record_id" TEXT,
    "session_id" TEXT,
    "type" "NotificationJobType" NOT NULL,
    "phone" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "CreditChannel",
    "provider_message_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "dedupe_key" TEXT,
    "locked_until" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_academy_id_key" ON "credit_wallets"("academy_id");

-- CreateIndex
CREATE INDEX "credit_transactions_academy_id_created_at_idx" ON "credit_transactions"("academy_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_transactions_notification_job_id_idx" ON "credit_transactions"("notification_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_payment_id_type_key" ON "credit_transactions"("payment_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "credit_pricings_channel_key" ON "credit_pricings"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notification_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_jobs_status_created_at_idx" ON "notification_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_jobs_student_id_type_created_at_idx" ON "notification_jobs"("student_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "notification_jobs_academy_id_created_at_idx" ON "notification_jobs"("academy_id", "created_at");

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_notification_job_id_fkey" FOREIGN KEY ("notification_job_id") REFERENCES "notification_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 기본 단가 (1크레딧 ≈ 1원 기준, 시스템 관리자가 /admin/credits에서 변경)
INSERT INTO "credit_pricings" ("id", "channel", "credit_per_message", "updated_at") VALUES
    (gen_random_uuid()::text, 'ALIMTALK', 15, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'SMS', 30, CURRENT_TIMESTAMP)
ON CONFLICT ("channel") DO NOTHING;

-- 기본 충전 상품
INSERT INTO "credit_packages" ("id", "name", "credits", "price_krw", "active", "sort_order", "updated_at") VALUES
    (gen_random_uuid()::text, '기본', 10000, 10000, true, 1, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, '실속', 31500, 30000, true, 2, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, '대용량', 110000, 100000, true, 3, CURRENT_TIMESTAMP);
