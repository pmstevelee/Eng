-- 다지점 관리 마이그레이션 (수정본)
ALTER TABLE "academies"
  ADD COLUMN IF NOT EXISTS "parent_academy_id" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_name"       TEXT,
  ADD COLUMN IF NOT EXISTS "branch_order"      INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academies_parent_academy_id_fkey'
  ) THEN
    ALTER TABLE "academies"
      ADD CONSTRAINT "academies_parent_academy_id_fkey"
      FOREIGN KEY ("parent_academy_id")
      REFERENCES "academies"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "academies_parent_academy_id_idx"
  ON "academies"("parent_academy_id");
