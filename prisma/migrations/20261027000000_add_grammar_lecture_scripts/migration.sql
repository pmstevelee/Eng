-- AlterTable
ALTER TABLE "grammar_lectures" ADD COLUMN     "script_id" TEXT;

-- CreateTable
CREATE TABLE "grammar_lecture_scripts" (
    "id" TEXT NOT NULL,
    "grammar_point_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "series_no" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'AI',
    "source_text" TEXT,
    "scenes_json" JSONB NOT NULL DEFAULT '[]',
    "ko_voice_id" TEXT,
    "en_voice_id" TEXT,
    "total_chars" INTEGER NOT NULL DEFAULT 0,
    "duration_sec" INTEGER,
    "created_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "audio_ready_at" TIMESTAMP(3),
    "linked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_lecture_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grammar_lecture_scripts_grammar_point_id_created_at_idx" ON "grammar_lecture_scripts"("grammar_point_id", "created_at");

-- CreateIndex
CREATE INDEX "grammar_lecture_scripts_status_idx" ON "grammar_lecture_scripts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_lectures_script_id_key" ON "grammar_lectures"("script_id");

-- AddForeignKey
ALTER TABLE "grammar_lectures" ADD CONSTRAINT "grammar_lectures_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "grammar_lecture_scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lecture_scripts" ADD CONSTRAINT "grammar_lecture_scripts_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lecture_scripts" ADD CONSTRAINT "grammar_lecture_scripts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 관리자 전용 — 서버(Prisma)에서만 읽고 쓴다. 정책 없음 = API(PostgREST) 직접 접근 차단
ALTER TABLE "grammar_lecture_scripts" ENABLE ROW LEVEL SECURITY;
