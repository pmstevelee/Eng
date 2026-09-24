-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "follow_up_tasks" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_up_tasks_academy_id_completed_at_due_at_idx" ON "follow_up_tasks"("academy_id", "completed_at", "due_at");

-- CreateIndex
CREATE INDEX "follow_up_tasks_assignee_id_completed_at_due_at_idx" ON "follow_up_tasks"("assignee_id", "completed_at", "due_at");

-- CreateIndex
CREATE INDEX "follow_up_tasks_lead_id_idx" ON "follow_up_tasks"("lead_id");

-- CreateIndex
CREATE INDEX "leads_academy_id_last_activity_at_idx" ON "leads"("academy_id", "last_activity_at");

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: 기존 문의의 마지막 활동 시각 = 최근 상담 기록 / 상태 변경 / 문의 등록 중 가장 늦은 시각
UPDATE "leads" l SET "last_activity_at" = GREATEST(
  l."created_at",
  COALESCE((SELECT MAX(c."created_at") FROM "consultations" c WHERE c."lead_id" = l."id"), l."created_at"),
  COALESCE((SELECT MAX(h."changed_at") FROM "lead_status_history" h WHERE h."lead_id" = l."id"), l."created_at"),
  COALESCE((SELECT MAX(a."updated_at") FROM "consultation_appointments" a WHERE a."lead_id" = l."id"), l."created_at")
);
