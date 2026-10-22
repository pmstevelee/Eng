-- 단어 세트 학습 단계(플래시카드/리콜/스펠)별 진행 상태 — 중단 후 재접속 시 이어서 학습

CREATE TABLE "word_study_sessions" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "stage" "LearnStage" NOT NULL,
    "study_date" TEXT NOT NULL,
    "state_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "word_study_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "word_study_sessions_set_id_idx" ON "word_study_sessions"("set_id");
CREATE UNIQUE INDEX "word_study_sessions_student_id_set_id_stage_key" ON "word_study_sessions"("student_id", "set_id", "stage");
ALTER TABLE "word_study_sessions" ADD CONSTRAINT "word_study_sessions_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "word_study_sessions" ADD CONSTRAINT "word_study_sessions_set_id_fkey"
    FOREIGN KEY ("set_id") REFERENCES "word_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 서버(Prisma)에서만 읽고 쓴다 — 정책 없음 = API 직접 접근 차단
ALTER TABLE "word_study_sessions" ENABLE ROW LEVEL SECURITY;
