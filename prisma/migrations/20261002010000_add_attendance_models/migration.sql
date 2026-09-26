-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('CLASS', 'ACADEMY');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'KEYPAD', 'AUTO');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "keypad_code" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "mode" "AttendanceMode" NOT NULL DEFAULT 'ACADEMY',
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "auto_absent_on_end" BOOLEAN NOT NULL DEFAULT true,
    "notify_check_in" BOOLEAN NOT NULL DEFAULT true,
    "notify_check_out" BOOLEAN NOT NULL DEFAULT true,
    "notify_absent" BOOLEAN NOT NULL DEFAULT false,
    "include_study_summary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "session_id" TEXT,
    "date" DATE NOT NULL,
    "mode" "AttendanceMode" NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'UNCHECKED',
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_change_logs" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "from_status" "AttendanceStatus" NOT NULL,
    "to_status" "AttendanceStatus" NOT NULL,
    "changed_by_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_settings_academy_id_key" ON "attendance_settings"("academy_id");

-- CreateIndex
CREATE INDEX "class_schedules_class_id_day_of_week_idx" ON "class_schedules"("class_id", "day_of_week");

-- CreateIndex
CREATE INDEX "class_sessions_date_idx" ON "class_sessions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_class_id_date_start_at_key" ON "class_sessions"("class_id", "date", "start_at");

-- CreateIndex
CREATE INDEX "attendance_records_academy_id_date_idx" ON "attendance_records"("academy_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_student_id_date_idx" ON "attendance_records"("student_id", "date");

-- CreateIndex
CREATE INDEX "attendance_records_session_id_idx" ON "attendance_records"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_student_id_session_id_key" ON "attendance_records"("student_id", "session_id");

-- CreateIndex
CREATE INDEX "attendance_change_logs_record_id_changed_at_idx" ON "attendance_change_logs"("record_id", "changed_at");

-- CreateIndex
CREATE INDEX "students_keypad_code_idx" ON "students"("keypad_code");

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_change_logs" ADD CONSTRAINT "attendance_change_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_change_logs" ADD CONSTRAINT "attendance_change_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 원 출결(ACADEMY) 모드: 학생·날짜당 1건 (sessionId가 null이면 위 unique가 동작하지 않으므로 부분 인덱스로 보강)
CREATE UNIQUE INDEX "attendance_records_academy_mode_student_date_key" ON "attendance_records"("student_id", "date") WHERE "session_id" IS NULL AND "mode" = 'ACADEMY';

-- 키패드 번호 백필: 기존 학부모 연락처 뒷 4자리
UPDATE "students" SET "keypad_code" = RIGHT("parent_phone", 4) WHERE "parent_phone" IS NOT NULL AND LENGTH("parent_phone") >= 4;
