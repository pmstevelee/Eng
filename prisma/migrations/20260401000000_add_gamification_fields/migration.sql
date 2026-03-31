-- ============================================================
-- Gamification fields migration
-- 기존 테이블에 누락된 컬럼 추가 + 새 테이블 생성
-- IF NOT EXISTS 사용으로 중복 실행 안전
-- ============================================================

-- ── 1. BadgeType enum (없으면 생성) ─────────────────────────

DO $$ BEGIN
  CREATE TYPE "BadgeType" AS ENUM (
    'STREAK_3', 'STREAK_7', 'STREAK_14', 'STREAK_30', 'STREAK_100',
    'FIRST_TEST', 'PERFECT_SCORE', 'SPEED_DEMON',
    'LEVEL_UP', 'MASTER',
    'WEEKLY_GOAL', 'MISSION_COMPLETE'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 2. badges 테이블: code 컬럼 추가 ────────────────────────

ALTER TABLE "badges"
  ADD COLUMN IF NOT EXISTS "code" "BadgeType";

CREATE UNIQUE INDEX IF NOT EXISTS "badges_code_key" ON "badges"("code");

-- ── 3. students 테이블: XP·주간 목표 컬럼 추가 ──────────────

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "total_xp"              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weekly_goal_target"    INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "weekly_goal_current"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weekly_goal_reset_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── 4. daily_missions 테이블: 누락 컬럼 추가 (테이블은 이미 존재) ──

ALTER TABLE "daily_missions"
  ADD COLUMN IF NOT EXISTS "status"              TEXT NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN IF NOT EXISTS "missions_json"       JSONB,
  ADD COLUMN IF NOT EXISTS "total_missions"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completed_missions"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "started_at"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "xp_earned"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "streak_counted"      BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "daily_missions_status_idx" ON "daily_missions"("status");

-- ── 5. student_streaks 테이블 생성 (없으면) ──────────────────

CREATE TABLE IF NOT EXISTS "student_streaks" (
    "id"                  TEXT NOT NULL,
    "student_id"          TEXT NOT NULL,
    "current_streak"      INTEGER NOT NULL DEFAULT 0,
    "longest_streak"      INTEGER NOT NULL DEFAULT 0,
    "last_activity_date"  TIMESTAMP(3),
    "total_days"          INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "student_streaks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_streaks_student_id_key"
  ON "student_streaks"("student_id");

ALTER TABLE "student_streaks"
  DROP CONSTRAINT IF EXISTS "student_streaks_student_id_fkey";

ALTER TABLE "student_streaks"
  ADD CONSTRAINT "student_streaks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. student_xp 테이블 생성 (없으면) ──────────────────────

CREATE TABLE IF NOT EXISTS "student_xp" (
    "id"          TEXT NOT NULL,
    "student_id"  TEXT NOT NULL,
    "amount"      INTEGER NOT NULL,
    "source"      TEXT NOT NULL,
    "source_id"   TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_xp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_xp_student_id_idx" ON "student_xp"("student_id");
CREATE INDEX IF NOT EXISTS "student_xp_created_at_idx" ON "student_xp"("created_at");

ALTER TABLE "student_xp"
  DROP CONSTRAINT IF EXISTS "student_xp_student_id_fkey";

ALTER TABLE "student_xp"
  ADD CONSTRAINT "student_xp_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
