-- AlterTable: tests에 적응형 레벨 테스트 필드 추가
ALTER TABLE "tests"
  ADD COLUMN IF NOT EXISTS "is_adaptive"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "adaptive_config"  JSONB;

-- AlterTable: test_sessions에 적응형 결과 필드 추가
ALTER TABLE "test_sessions"
  ADD COLUMN IF NOT EXISTS "is_placement"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "assessed_levels"   JSONB,
  ADD COLUMN IF NOT EXISTS "placement_result"  JSONB,
  ADD COLUMN IF NOT EXISTS "listening_score"   INTEGER;

-- AlterTable: notifications에 링크/관련ID 필드 추가
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "link"        TEXT,
  ADD COLUMN IF NOT EXISTS "related_id"  TEXT;
