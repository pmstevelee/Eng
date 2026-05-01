-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 결제 시스템 1단계: 스키마 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- CreateEnum: 결제 관련 신규 enum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'STANDARD', 'PREMIUM');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "PaymentType" AS ENUM (
  'SUBSCRIPTION',
  'OVERAGE_AI_WRITING',
  'OVERAGE_AI_QUESTION',
  'CREDIT_PACKAGE',
  'ANNUAL',
  'STUDENT_OVERAGE',
  'STORAGE_OVERAGE'
);
CREATE TYPE "CreditType" AS ENUM ('WRITING', 'QUESTION');
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELED');

-- AlterEnum: SubscriptionStatus에 PAST_DUE, CANCELED 추가
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

-- AlterEnum: PaymentStatus에 FAILED, CANCELED, PARTIAL_CANCELED 추가
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_CANCELED';

-- RenameTable: 기존 subscriptions → subscription_histories
ALTER TABLE "subscriptions" RENAME TO "subscription_histories";

-- RenameConstraints: 테이블명 변경 후 제약조건 이름도 변경 (이름 충돌 방지)
ALTER TABLE "subscription_histories" RENAME CONSTRAINT "subscriptions_pkey" TO "subscription_histories_pkey";
ALTER TABLE "subscription_histories" RENAME CONSTRAINT "subscriptions_academy_id_fkey" TO "subscription_histories_academy_id_fkey";

-- CreateIndex: subscription_histories에 인덱스 추가
CREATE INDEX "subscription_histories_academy_id_idx" ON "subscription_histories"("academy_id");

-- CreateTable: subscriptions (신규 SaaS 구독 - academy당 1건)
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: subscriptions
CREATE UNIQUE INDEX "subscriptions_academy_id_key" ON "subscriptions"("academy_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- AddForeignKey: subscriptions → academies
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_academy_id_fkey"
    FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: billing_keys (포트원 빌링키)
CREATE TABLE "billing_keys" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "portone_billing_key" TEXT NOT NULL,
    "card_company" TEXT,
    "card_number_masked" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: billing_keys
CREATE UNIQUE INDEX "billing_keys_subscription_id_key" ON "billing_keys"("subscription_id");
CREATE UNIQUE INDEX "billing_keys_portone_billing_key_key" ON "billing_keys"("portone_billing_key");

-- AddForeignKey: billing_keys → subscriptions
ALTER TABLE "billing_keys" ADD CONSTRAINT "billing_keys_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: payments (결제 내역)
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "pg_provider" TEXT,
    "pg_tx_id" TEXT,
    "receipt_url" TEXT,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: payments
CREATE UNIQUE INDEX "payments_payment_id_key" ON "payments"("payment_id");
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");
CREATE INDEX "payments_academy_id_idx" ON "payments"("academy_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_type_idx" ON "payments"("type");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- AddForeignKey: payments → subscriptions
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: usage_records (사용량 기록)
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "ai_writing_count" INTEGER NOT NULL DEFAULT 0,
    "ai_question_count" INTEGER NOT NULL DEFAULT 0,
    "storage_used_mb" INTEGER NOT NULL DEFAULT 0,
    "student_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: usage_records
CREATE UNIQUE INDEX "usage_records_subscription_id_period_start_key" ON "usage_records"("subscription_id", "period_start");
CREATE INDEX "usage_records_academy_id_idx" ON "usage_records"("academy_id");
CREATE INDEX "usage_records_period_start_idx" ON "usage_records"("period_start");

-- AddForeignKey: usage_records → subscriptions
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ai_credits (AI 크레딧)
CREATE TABLE "ai_credits" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "type" "CreditType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ai_credits
CREATE INDEX "ai_credits_academy_id_idx" ON "ai_credits"("academy_id");
CREATE INDEX "ai_credits_type_idx" ON "ai_credits"("type");
CREATE INDEX "ai_credits_expires_at_idx" ON "ai_credits"("expires_at");

-- CreateTable: payment_schedules (결제 예약)
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: payment_schedules
CREATE INDEX "payment_schedules_subscription_id_idx" ON "payment_schedules"("subscription_id");
CREATE INDEX "payment_schedules_status_idx" ON "payment_schedules"("status");
CREATE INDEX "payment_schedules_scheduled_at_idx" ON "payment_schedules"("scheduled_at");

-- AddForeignKey: payment_schedules → subscriptions
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
