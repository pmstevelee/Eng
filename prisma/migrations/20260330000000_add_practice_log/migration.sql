-- CreateTable
CREATE TABLE "practice_logs" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "domain" "QuestionDomain",
    "total_count" INTEGER NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "results_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_logs_student_id_idx" ON "practice_logs"("student_id");

-- CreateIndex
CREATE INDEX "practice_logs_created_at_idx" ON "practice_logs"("created_at");

-- AddForeignKey
ALTER TABLE "practice_logs" ADD CONSTRAINT "practice_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
