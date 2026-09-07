-- CreateEnum
CREATE TYPE "ExamCategory" AS ENUM ('IELTS', 'CELPIP', 'TOEFL', 'TOEIC', 'SAT');

-- AlterTable
ALTER TABLE "word_sets" ADD COLUMN     "exam_category" "ExamCategory";

-- CreateTable
CREATE TABLE "word_exam_categories" (
    "id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "category" "ExamCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_exam_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "word_exam_categories_category_idx" ON "word_exam_categories"("category");

-- CreateIndex
CREATE INDEX "word_exam_categories_word_id_idx" ON "word_exam_categories"("word_id");

-- CreateIndex
CREATE UNIQUE INDEX "word_exam_categories_word_id_category_key" ON "word_exam_categories"("word_id", "category");

-- CreateIndex
CREATE INDEX "word_sets_exam_category_idx" ON "word_sets"("exam_category");

-- AddForeignKey
ALTER TABLE "word_exam_categories" ADD CONSTRAINT "word_exam_categories_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

