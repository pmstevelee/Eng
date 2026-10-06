-- AlterTable
ALTER TABLE "word_progress" ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "learned_at" TIMESTAMP(3),
ADD COLUMN     "mastered_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "daily_word_plans" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "set_id" TEXT,
    "target_level" INTEGER NOT NULL,
    "new_word_ids" JSONB NOT NULL,
    "new_target" INTEGER NOT NULL,
    "review_target" INTEGER NOT NULL DEFAULT 0,
    "flashcard_done" BOOLEAN NOT NULL DEFAULT false,
    "recall_done" BOOLEAN NOT NULL DEFAULT false,
    "spell_done" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "completed_at" TIMESTAMP(3),
    "bonus_awarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_word_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_daily_stats" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "stat_date" DATE NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "new_words" INTEGER NOT NULL DEFAULT 0,
    "review_words" INTEGER NOT NULL DEFAULT 0,
    "mastered_words" INTEGER NOT NULL DEFAULT 0,
    "word_correct" INTEGER NOT NULL DEFAULT 0,
    "word_wrong" INTEGER NOT NULL DEFAULT 0,
    "grammar_solved" INTEGER NOT NULL DEFAULT 0,
    "grammar_correct" INTEGER NOT NULL DEFAULT 0,
    "plan_completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reviews" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "consecutive_correct" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMP(3) NOT NULL,
    "is_mastered" BOOLEAN NOT NULL DEFAULT false,
    "last_answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_word_plans_set_id_key" ON "daily_word_plans"("set_id");

-- CreateIndex
CREATE INDEX "daily_word_plans_plan_date_idx" ON "daily_word_plans"("plan_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_word_plans_student_id_plan_date_key" ON "daily_word_plans"("student_id", "plan_date");

-- CreateIndex
CREATE INDEX "student_daily_stats_stat_date_idx" ON "student_daily_stats"("stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "student_daily_stats_student_id_stat_date_key" ON "student_daily_stats"("student_id", "stat_date");

-- CreateIndex
CREATE INDEX "question_reviews_student_id_is_mastered_next_review_at_idx" ON "question_reviews"("student_id", "is_mastered", "next_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "question_reviews_student_id_question_id_key" ON "question_reviews"("student_id", "question_id");

-- CreateIndex
CREATE INDEX "word_progress_student_id_stage_idx" ON "word_progress"("student_id", "stage");

-- AddForeignKey
ALTER TABLE "daily_word_plans" ADD CONSTRAINT "daily_word_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_word_plans" ADD CONSTRAINT "daily_word_plans_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "word_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_daily_stats" ADD CONSTRAINT "student_daily_stats_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reviews" ADD CONSTRAINT "question_reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reviews" ADD CONSTRAINT "question_reviews_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: 기존 MASTERED 단어(구 규칙)는 학습 완료·마스터 시각을 마지막 학습일로 채운다
UPDATE "word_progress"
SET "learned_at" = COALESCE("last_studied_at", "created_at"),
    "mastered_at" = COALESCE("last_studied_at", "created_at")
WHERE "stage" = 'MASTERED';

-- RLS: enable만 (정책 없음 = Supabase API 직접 접근 차단, 서버(Prisma)만 접근)
ALTER TABLE "daily_word_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_daily_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_reviews" ENABLE ROW LEVEL SECURITY;
