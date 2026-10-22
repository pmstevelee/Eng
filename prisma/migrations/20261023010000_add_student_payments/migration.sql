-- 학생 결제 (학생 결제 허용 학원 전용): 학생 개인 크레딧 지갑·원장·결제·AI 플래시카드 이력
-- 학원 통합 크레딧(credit_wallets)·결제(payments)는 변경하지 않는다.

CREATE TABLE "student_credit_wallets" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_credit_wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_credit_wallets_student_id_key" ON "student_credit_wallets"("student_id");
ALTER TABLE "student_credit_wallets" ADD CONSTRAINT "student_credit_wallets_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "student_credit_transactions" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "order_id" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_credit_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_credit_transactions_order_id_type_key" ON "student_credit_transactions"("order_id", "type");
CREATE INDEX "student_credit_transactions_student_id_created_at_idx" ON "student_credit_transactions"("student_id", "created_at");
ALTER TABLE "student_credit_transactions" ADD CONSTRAINT "student_credit_transactions_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "student_payments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "package_key" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "pg_tx_id" TEXT,
    "receipt_url" TEXT,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_payments_order_id_key" ON "student_payments"("order_id");
CREATE INDEX "student_payments_student_id_created_at_idx" ON "student_payments"("student_id", "created_at");
CREATE INDEX "student_payments_academy_id_created_at_idx" ON "student_payments"("academy_id", "created_at");
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_academy_id_fkey"
    FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "student_ai_flashcard_usages" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL,
    "free_count" INTEGER NOT NULL,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_ai_flashcard_usages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "student_ai_flashcard_usages_student_id_created_at_idx" ON "student_ai_flashcard_usages"("student_id", "created_at");
ALTER TABLE "student_ai_flashcard_usages" ADD CONSTRAINT "student_ai_flashcard_usages_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 서버(Prisma)에서만 읽고 쓴다 — 정책 없음 = API 직접 접근 차단
ALTER TABLE "student_credit_wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_ai_flashcard_usages" ENABLE ROW LEVEL SECURITY;

-- 위고업잉글리시 학원만 학생 결제·AI 플래시카드 허용 (다른 학원은 이 설정이 없어 기존과 동일)
UPDATE "academies"
SET "settings_json" = jsonb_set(COALESCE("settings_json", '{}'::jsonb), '{studentPaidFeatures}', '{"aiFlashcard": true}'::jsonb, true)
WHERE "id" = 'fe9dc515-b266-421c-bb38-0b89bcf1451d';
