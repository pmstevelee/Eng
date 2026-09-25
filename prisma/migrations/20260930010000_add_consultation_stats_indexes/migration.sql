-- DropIndex
DROP INDEX "leads_assignee_id_idx";

-- DropIndex
DROP INDEX "consultations_counselor_id_idx";

-- CreateIndex
CREATE INDEX "leads_assignee_id_created_at_idx" ON "leads"("assignee_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_academy_id_created_at_idx" ON "leads"("academy_id", "created_at");

-- CreateIndex
CREATE INDEX "consultations_counselor_id_consulted_at_idx" ON "consultations"("counselor_id", "consulted_at");

-- CreateIndex
CREATE INDEX "consultations_type_withdrawn_on_idx" ON "consultations"("type", "withdrawn_on");

-- CreateIndex
CREATE INDEX "lead_status_history_to_status_changed_at_idx" ON "lead_status_history"("to_status", "changed_at");

