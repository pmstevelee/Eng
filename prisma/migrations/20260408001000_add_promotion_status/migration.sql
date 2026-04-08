-- AlterTable: tests에 단원 테스트 필드 추가
ALTER TABLE "tests" ADD COLUMN "target_level" INTEGER;
ALTER TABLE "tests" ADD COLUMN "unit_name" TEXT;
ALTER TABLE "tests" ADD COLUMN "learning_objectives" TEXT;

-- CreateTable: 레벨 승급 상태 추적
CREATE TABLE "level_promotion_status" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL,
    "target_level" INTEGER NOT NULL,
    "condition1_met" BOOLEAN NOT NULL DEFAULT false,
    "condition1_detail" JSONB,
    "condition2_met" BOOLEAN NOT NULL DEFAULT false,
    "condition2_detail" JSONB,
    "condition3_met" BOOLEAN NOT NULL DEFAULT false,
    "condition3_detail" JSONB,
    "all_conditions_met" BOOLEAN NOT NULL DEFAULT false,
    "promoted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "level_promotion_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "level_promotion_status_student_id_key" ON "level_promotion_status"("student_id");
CREATE INDEX "level_promotion_status_student_id_idx" ON "level_promotion_status"("student_id");

-- AddForeignKey
ALTER TABLE "level_promotion_status" ADD CONSTRAINT "level_promotion_status_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
