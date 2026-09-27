-- 통합 크레딧: AI 기능 차감 항목 추가
-- (ALTER TYPE ... ADD VALUE로 추가한 값은 같은 트랜잭션에서 쓸 수 없어 다음 마이그레이션과 분리)
ALTER TYPE "CreditChannel" ADD VALUE IF NOT EXISTS 'AI_WRITING';
ALTER TYPE "CreditChannel" ADD VALUE IF NOT EXISTS 'AI_QUESTION';
