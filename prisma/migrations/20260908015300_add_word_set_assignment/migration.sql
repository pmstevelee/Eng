-- CreateTable
CREATE TABLE "word_set_assignments" (
    "id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_set_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "word_set_assignments_set_id_idx" ON "word_set_assignments"("set_id");

-- CreateIndex
CREATE INDEX "word_set_assignments_student_id_idx" ON "word_set_assignments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "word_set_assignments_set_id_student_id_key" ON "word_set_assignments"("set_id", "student_id");

-- AddForeignKey
ALTER TABLE "word_set_assignments" ADD CONSTRAINT "word_set_assignments_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "word_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_set_assignments" ADD CONSTRAINT "word_set_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

