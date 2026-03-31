-- AlterTable: question_responses에 스페이스드 리피티션 필드 추가
ALTER TABLE "question_responses"
  ADD COLUMN IF NOT EXISTS "review_due_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "review_count"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "consecutive_correct"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_mastered"          BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_responses_review_due_at_idx" ON "question_responses"("review_due_at");
