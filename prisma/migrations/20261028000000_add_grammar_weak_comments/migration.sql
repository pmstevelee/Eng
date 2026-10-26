-- CreateTable
CREATE TABLE "grammar_weak_comments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grammar_point_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "comment" TEXT NOT NULL,
    "samples_json" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_weak_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grammar_weak_comments_grammar_point_id_idx" ON "grammar_weak_comments"("grammar_point_id");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_weak_comments_student_id_grammar_point_id_week_star_key" ON "grammar_weak_comments"("student_id", "grammar_point_id", "week_start");

-- AddForeignKey
ALTER TABLE "grammar_weak_comments" ADD CONSTRAINT "grammar_weak_comments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_weak_comments" ADD CONSTRAINT "grammar_weak_comments_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 서버(Prisma)에서만 읽고 쓴다. 정책 없음 = API(PostgREST) 직접 접근 차단
ALTER TABLE "grammar_weak_comments" ENABLE ROW LEVEL SECURITY;
