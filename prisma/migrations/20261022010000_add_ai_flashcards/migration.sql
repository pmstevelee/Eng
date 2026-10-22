-- AI 플래시카드: 학원 전용 단어 + 생성 이력 + 단어당 크레딧 단가

-- 학원이 업로드한 전용 단어 (null = 공용 사전)
ALTER TABLE "words" ADD COLUMN "academy_id" TEXT;
CREATE INDEX "words_academy_id_idx" ON "words"("academy_id");
ALTER TABLE "words" ADD CONSTRAINT "words_academy_id_fkey"
    FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 생성 이력 (월 무료 한도 집계)
CREATE TABLE "ai_flashcard_usages" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL,
    "free_count" INTEGER NOT NULL,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_flashcard_usages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_flashcard_usages_academy_id_created_at_idx" ON "ai_flashcard_usages"("academy_id", "created_at");
ALTER TABLE "ai_flashcard_usages" ADD CONSTRAINT "ai_flashcard_usages_academy_id_fkey"
    FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 서버(Prisma)에서만 읽고 쓴다 — 정책 없음 = API 직접 접근 차단
ALTER TABLE "ai_flashcard_usages" ENABLE ROW LEVEL SECURITY;

-- 단어 1개당 크레딧 (1크레딧 ≈ 1원)
INSERT INTO "credit_pricings" ("id", "channel", "credit_per_message", "updated_at") VALUES
    (gen_random_uuid()::text, 'AI_FLASHCARD', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("channel") DO NOTHING;
