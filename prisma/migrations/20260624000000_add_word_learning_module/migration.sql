-- CreateEnum
CREATE TYPE "WordSource" AS ENUM ('OXFORD_3000', 'OXFORD_5000', 'PUBLISHER', 'TEACHER', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "WordSetSource" AS ENUM ('PUBLISHER', 'TEACHER', 'AI_GENERATED', 'OXFORD_3000', 'OXFORD_5000');

-- CreateEnum
CREATE TYPE "LearnStage" AS ENUM ('FLASHCARD', 'RECALL', 'SPELL', 'MASTERED');

-- CreateEnum
CREATE TYPE "WordTestMode" AS ENUM ('EN_TO_KO', 'KO_TO_EN', 'SPELL', 'MIXED');

-- CreateEnum
CREATE TYPE "OxfordCefr" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');

-- CreateTable
CREATE TABLE "words" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "part_of_speech" TEXT NOT NULL,
    "cefr_level" INTEGER NOT NULL,
    "oxford_cefr" "OxfordCefr" NOT NULL,
    "context_note" TEXT,
    "homonym_index" INTEGER,
    "meaning" TEXT,
    "definition" TEXT,
    "example" TEXT,
    "audio_url" TEXT,
    "source" "WordSource" NOT NULL DEFAULT 'OXFORD_3000',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_sets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cefr_level" INTEGER NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "source" "WordSetSource" NOT NULL,
    "owner_id" TEXT,
    "academy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_set_items" (
    "id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "word_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_progress" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "stage" "LearnStage" NOT NULL DEFAULT 'FLASHCARD',
    "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval_days" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMP(3),
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "last_studied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_tests" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "set_id" TEXT,
    "mode" "WordTestMode" NOT NULL,
    "score" INTEGER NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "words_cefr_level_idx" ON "words"("cefr_level");

-- CreateIndex
CREATE INDEX "words_oxford_cefr_idx" ON "words"("oxford_cefr");

-- CreateIndex
CREATE UNIQUE INDEX "words_term_part_of_speech_homonym_index_key" ON "words"("term", "part_of_speech", "homonym_index");

-- CreateIndex
CREATE INDEX "word_sets_owner_id_idx" ON "word_sets"("owner_id");

-- CreateIndex
CREATE INDEX "word_sets_academy_id_idx" ON "word_sets"("academy_id");

-- CreateIndex
CREATE INDEX "word_set_items_set_id_idx" ON "word_set_items"("set_id");

-- CreateIndex
CREATE UNIQUE INDEX "word_set_items_set_id_word_id_key" ON "word_set_items"("set_id", "word_id");

-- CreateIndex
CREATE INDEX "word_progress_student_id_next_review_at_idx" ON "word_progress"("student_id", "next_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "word_progress_student_id_word_id_key" ON "word_progress"("student_id", "word_id");

-- CreateIndex
CREATE INDEX "word_tests_student_id_idx" ON "word_tests"("student_id");

-- CreateIndex
CREATE INDEX "word_tests_set_id_idx" ON "word_tests"("set_id");

-- AddForeignKey
ALTER TABLE "word_sets" ADD CONSTRAINT "word_sets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_sets" ADD CONSTRAINT "word_sets_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_set_items" ADD CONSTRAINT "word_set_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "word_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_set_items" ADD CONSTRAINT "word_set_items_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_tests" ADD CONSTRAINT "word_tests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_tests" ADD CONSTRAINT "word_tests_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "word_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

