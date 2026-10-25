-- CreateTable
CREATE TABLE "grammar_source_scripts" (
    "id" TEXT NOT NULL,
    "category_id" TEXT,
    "grammar_point_id" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "gap_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_source_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_content_gaps" (
    "id" TEXT NOT NULL,
    "category_id" TEXT,
    "grammar_point_id" TEXT,
    "message" TEXT NOT NULL,
    "request" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "origin" TEXT NOT NULL DEFAULT 'ANALYZE',
    "resolved_script_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "grammar_content_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grammar_source_scripts_category_id_created_at_idx" ON "grammar_source_scripts"("category_id", "created_at");

-- CreateIndex
CREATE INDEX "grammar_source_scripts_grammar_point_id_created_at_idx" ON "grammar_source_scripts"("grammar_point_id", "created_at");

-- CreateIndex
CREATE INDEX "grammar_content_gaps_status_category_id_idx" ON "grammar_content_gaps"("status", "category_id");

-- CreateIndex
CREATE INDEX "grammar_content_gaps_status_grammar_point_id_idx" ON "grammar_content_gaps"("status", "grammar_point_id");

-- AddForeignKey
ALTER TABLE "grammar_source_scripts" ADD CONSTRAINT "grammar_source_scripts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "grammar_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_source_scripts" ADD CONSTRAINT "grammar_source_scripts_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_source_scripts" ADD CONSTRAINT "grammar_source_scripts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_content_gaps" ADD CONSTRAINT "grammar_content_gaps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "grammar_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_content_gaps" ADD CONSTRAINT "grammar_content_gaps_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 서버(Prisma)에서만 읽고 쓴다 — 정책 없음 = API(PostgREST) 직접 접근 차단
ALTER TABLE "grammar_source_scripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_content_gaps" ENABLE ROW LEVEL SECURITY;
