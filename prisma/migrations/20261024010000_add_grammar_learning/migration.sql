-- 문법학습관리: 커리큘럼 트리·문법 포인트·강의·코스·배정·진도·시도 이력·태깅 제안 + 문제은행 grammar_point_id

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "grammar_point_id" TEXT;

-- CreateTable
CREATE TABLE "grammar_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "depth" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_points" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "academy_id" TEXT,
    "level_min" INTEGER NOT NULL DEFAULT 1,
    "level_max" INTEGER NOT NULL DEFAULT 10,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "rules_json" JSONB,
    "examples_json" JSONB,
    "common_errors_json" JSONB,
    "status" "GrammarPointStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_prerequisites" (
    "id" TEXT NOT NULL,
    "point_id" TEXT NOT NULL,
    "required_point_id" TEXT NOT NULL,

    CONSTRAINT "grammar_prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_lectures" (
    "id" TEXT NOT NULL,
    "grammar_point_id" TEXT NOT NULL,
    "academy_id" TEXT,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'youtube',
    "video_id" TEXT NOT NULL,
    "duration_sec" INTEGER,
    "notes_url" TEXT,
    "created_by_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_lecture_views" (
    "id" TEXT NOT NULL,
    "lecture_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "watched_percent" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_lecture_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_courses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "academy_id" TEXT,
    "target_level" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_course_items" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "grammar_point_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grammar_course_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_assignments" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "class_id" TEXT,
    "student_id" TEXT,
    "grammar_point_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "due_date" DATE,
    "assigned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_point_progress" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grammar_point_id" TEXT NOT NULL,
    "state" "GrammarMasteryState" NOT NULL DEFAULT 'NOT_STARTED',
    "current_step" TEXT NOT NULL DEFAULT 'CONCEPT',
    "concept_done_at" TIMESTAMP(3),
    "practice_correct" INTEGER NOT NULL DEFAULT 0,
    "practice_total" INTEGER NOT NULL DEFAULT 0,
    "best_check_score" INTEGER,
    "last_check_score" INTEGER,
    "check_attempts" INTEGER NOT NULL DEFAULT 0,
    "low_score_count" INTEGER NOT NULL DEFAULT 0,
    "review_streak" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMP(3),
    "passed_at" TIMESTAMP(3),
    "mastered_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grammar_point_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_attempts" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grammar_point_id" TEXT,
    "category_id" TEXT,
    "kind" "GrammarAttemptKind" NOT NULL,
    "score" INTEGER NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "answers_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_tag_suggestions" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "suggested_point_id" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "grammar_tag_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grammar_categories_code_key" ON "grammar_categories"("code");

-- CreateIndex
CREATE INDEX "grammar_categories_parent_id_sort_order_idx" ON "grammar_categories"("parent_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_points_code_key" ON "grammar_points"("code");

-- CreateIndex
CREATE INDEX "grammar_points_category_id_sort_order_idx" ON "grammar_points"("category_id", "sort_order");

-- CreateIndex
CREATE INDEX "grammar_points_status_idx" ON "grammar_points"("status");

-- CreateIndex
CREATE INDEX "grammar_points_academy_id_idx" ON "grammar_points"("academy_id");

-- CreateIndex
CREATE INDEX "grammar_prerequisites_required_point_id_idx" ON "grammar_prerequisites"("required_point_id");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_prerequisites_point_id_required_point_id_key" ON "grammar_prerequisites"("point_id", "required_point_id");

-- CreateIndex
CREATE INDEX "grammar_lectures_grammar_point_id_academy_id_idx" ON "grammar_lectures"("grammar_point_id", "academy_id");

-- CreateIndex
CREATE INDEX "grammar_lectures_academy_id_idx" ON "grammar_lectures"("academy_id");

-- CreateIndex
CREATE INDEX "grammar_lecture_views_student_id_idx" ON "grammar_lecture_views"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_lecture_views_lecture_id_student_id_key" ON "grammar_lecture_views"("lecture_id", "student_id");

-- CreateIndex
CREATE INDEX "grammar_courses_academy_id_idx" ON "grammar_courses"("academy_id");

-- CreateIndex
CREATE INDEX "grammar_course_items_course_id_sort_order_idx" ON "grammar_course_items"("course_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_course_items_course_id_grammar_point_id_key" ON "grammar_course_items"("course_id", "grammar_point_id");

-- CreateIndex
CREATE INDEX "grammar_assignments_class_id_sort_order_idx" ON "grammar_assignments"("class_id", "sort_order");

-- CreateIndex
CREATE INDEX "grammar_assignments_student_id_idx" ON "grammar_assignments"("student_id");

-- CreateIndex
CREATE INDEX "grammar_assignments_academy_id_idx" ON "grammar_assignments"("academy_id");

-- CreateIndex
CREATE INDEX "grammar_assignments_grammar_point_id_idx" ON "grammar_assignments"("grammar_point_id");

-- CreateIndex
CREATE INDEX "grammar_point_progress_student_id_state_idx" ON "grammar_point_progress"("student_id", "state");

-- CreateIndex
CREATE INDEX "grammar_point_progress_student_id_next_review_at_idx" ON "grammar_point_progress"("student_id", "next_review_at");

-- CreateIndex
CREATE INDEX "grammar_point_progress_grammar_point_id_state_idx" ON "grammar_point_progress"("grammar_point_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_point_progress_student_id_grammar_point_id_key" ON "grammar_point_progress"("student_id", "grammar_point_id");

-- CreateIndex
CREATE INDEX "grammar_attempts_student_id_grammar_point_id_created_at_idx" ON "grammar_attempts"("student_id", "grammar_point_id", "created_at");

-- CreateIndex
CREATE INDEX "grammar_attempts_grammar_point_id_kind_idx" ON "grammar_attempts"("grammar_point_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_tag_suggestions_question_id_key" ON "grammar_tag_suggestions"("question_id");

-- CreateIndex
CREATE INDEX "grammar_tag_suggestions_status_idx" ON "grammar_tag_suggestions"("status");

-- CreateIndex
CREATE INDEX "questions_grammar_point_id_is_active_idx" ON "questions"("grammar_point_id", "is_active");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_categories" ADD CONSTRAINT "grammar_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "grammar_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_points" ADD CONSTRAINT "grammar_points_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "grammar_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_points" ADD CONSTRAINT "grammar_points_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_prerequisites" ADD CONSTRAINT "grammar_prerequisites_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_prerequisites" ADD CONSTRAINT "grammar_prerequisites_required_point_id_fkey" FOREIGN KEY ("required_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lectures" ADD CONSTRAINT "grammar_lectures_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lectures" ADD CONSTRAINT "grammar_lectures_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lectures" ADD CONSTRAINT "grammar_lectures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lecture_views" ADD CONSTRAINT "grammar_lecture_views_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "grammar_lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lecture_views" ADD CONSTRAINT "grammar_lecture_views_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_courses" ADD CONSTRAINT "grammar_courses_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_course_items" ADD CONSTRAINT "grammar_course_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "grammar_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_course_items" ADD CONSTRAINT "grammar_course_items_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_assignments" ADD CONSTRAINT "grammar_assignments_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_assignments" ADD CONSTRAINT "grammar_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_assignments" ADD CONSTRAINT "grammar_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_assignments" ADD CONSTRAINT "grammar_assignments_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_assignments" ADD CONSTRAINT "grammar_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_point_progress" ADD CONSTRAINT "grammar_point_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_point_progress" ADD CONSTRAINT "grammar_point_progress_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_attempts" ADD CONSTRAINT "grammar_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_attempts" ADD CONSTRAINT "grammar_attempts_grammar_point_id_fkey" FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_attempts" ADD CONSTRAINT "grammar_attempts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "grammar_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_tag_suggestions" ADD CONSTRAINT "grammar_tag_suggestions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_tag_suggestions" ADD CONSTRAINT "grammar_tag_suggestions_suggested_point_id_fkey" FOREIGN KEY ("suggested_point_id") REFERENCES "grammar_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 서버(Prisma)에서만 읽고 쓴다 — 정책 없음 = API(PostgREST) 직접 접근 차단
ALTER TABLE "grammar_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_prerequisites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_lectures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_lecture_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_course_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_point_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grammar_tag_suggestions" ENABLE ROW LEVEL SECURITY;
