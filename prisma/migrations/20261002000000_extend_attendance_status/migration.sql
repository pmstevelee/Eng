-- 출결관리: 기존 AttendanceStatus enum에 값 추가
-- (새 값을 같은 트랜잭션에서 DEFAULT로 쓸 수 없어 add_attendance_models와 분리)

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'EARLY_LEAVE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'MAKEUP';
ALTER TYPE "AttendanceStatus" ADD VALUE 'UNCHECKED';
