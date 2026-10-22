-- 학생이 AI 플래시카드로 만든 개인 세트 출처
-- (ALTER TYPE ... ADD VALUE는 다음 마이그레이션과 분리)
ALTER TYPE "WordSetSource" ADD VALUE IF NOT EXISTS 'STUDENT';
