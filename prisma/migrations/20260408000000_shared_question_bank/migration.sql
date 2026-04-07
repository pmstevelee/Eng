

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('SYSTEM', 'AI_GENERATED', 'TEACHER_CREATED', 'AI_SHARED');

-- AlterTable: questions에 공용 문제 뱅크 필드 추가
ALTER TABLE "questions"
  ADD COLUMN "source"               "QuestionSource" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "is_verified"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usage_count"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "quality_score"        DOUBLE PRECISION,
  ADD COLUMN "is_active"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "original_question_id" TEXT;

-- AddForeignKey: original_question_id → questions.id (자기 참조)
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_original_question_id_fkey"
  FOREIGN KEY ("original_question_id")
  REFERENCES "questions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- CreateIndex: 문제 선별 핵심 쿼리
CREATE INDEX "questions_academy_id_domain_difficulty_is_active_idx"
  ON "questions"("academy_id", "domain", "difficulty", "is_active");

-- CreateIndex: 공용 문제 필터링
CREATE INDEX "questions_source_is_verified_is_active_idx"
  ON "questions"("source", "is_verified", "is_active");

-- CreateIndex: 적응형 레벨 테스트
CREATE INDEX "questions_domain_difficulty_is_active_is_verified_idx"
  ON "questions"("domain", "difficulty", "is_active", "is_verified");

-- CreateIndex: 품질 높은 문제 우선 선택
CREATE INDEX "questions_quality_score_idx"
  ON "questions"("quality_score");

-- CreateTable: question_usage_log
CREATE TABLE "question_usage_log" (
  "id"          TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "academy_id"  TEXT NOT NULL,
  "test_type"   TEXT NOT NULL,
  "test_id"     TEXT NOT NULL,
  "used_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: question_usage_log unique (재출제 방지)
CREATE UNIQUE INDEX "question_usage_log_question_id_academy_id_test_type_key"
  ON "question_usage_log"("question_id", "academy_id", "test_type");

CREATE INDEX "question_usage_log_academy_id_test_type_idx"
  ON "question_usage_log"("academy_id", "test_type");

CREATE INDEX "question_usage_log_question_id_idx"
  ON "question_usage_log"("question_id");

-- AddForeignKey: question_usage_log → questions
ALTER TABLE "question_usage_log"
  ADD CONSTRAINT "question_usage_log_question_id_fkey"
  FOREIGN KEY ("question_id")
  REFERENCES "questions"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- AddForeignKey: question_usage_log → academies
ALTER TABLE "question_usage_log"
  ADD CONSTRAINT "question_usage_log_academy_id_fkey"
  FOREIGN KEY ("academy_id")
  REFERENCES "academies"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CreateTable: question_bank_stats
CREATE TABLE "question_bank_stats" (
  "id"                TEXT NOT NULL,
  "domain"            TEXT NOT NULL,
  "difficulty"        INTEGER NOT NULL,
  "total_count"       INTEGER NOT NULL DEFAULT 0,
  "verified_count"    INTEGER NOT NULL DEFAULT 0,
  "avg_quality_score" DOUBLE PRECISION,
  "last_updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_bank_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: question_bank_stats unique
CREATE UNIQUE INDEX "question_bank_stats_domain_difficulty_key"
  ON "question_bank_stats"("domain", "difficulty");
