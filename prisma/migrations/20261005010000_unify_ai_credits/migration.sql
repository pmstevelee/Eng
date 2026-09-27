-- 통합 크레딧: AI 사용분 차감 항목 기록 + AI 단가 시드 + 기존 AI 크레딧 잔액을 통합 지갑으로 적립
-- ai_credits 테이블은 그대로 두며, 전환 이후 코드는 더 이상 읽지 않는다.

ALTER TABLE "credit_transactions" ADD COLUMN "item" "CreditChannel";

-- AI 1회당 크레딧 (1크레딧 ≈ 1원, 플랜 초과 요금 수준)
INSERT INTO "credit_pricings" ("id", "channel", "credit_per_message", "updated_at") VALUES
    (gen_random_uuid()::text, 'AI_WRITING', 50, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'AI_QUESTION', 100, CURRENT_TIMESTAMP)
ON CONFLICT ("channel") DO NOTHING;

-- 만료 전 AI 크레딧 잔액을 회당 단가로 환산해 본원 지갑에 적립 (지점 크레딧은 본원 지갑으로)
CREATE TEMP TABLE "_ai_credit_convert" ON COMMIT DROP AS
SELECT COALESCE(a."parent_academy_id", c."academy_id") AS "wallet_id",
       SUM(CASE WHEN c."type" = 'WRITING' THEN c."amount" * 50 ELSE c."amount" * 100 END)::int AS "credits",
       SUM(CASE WHEN c."type" = 'WRITING' THEN c."amount" ELSE 0 END)::int AS "writing",
       SUM(CASE WHEN c."type" = 'QUESTION' THEN c."amount" ELSE 0 END)::int AS "question"
FROM "ai_credits" c
JOIN "academies" a ON a."id" = c."academy_id"
WHERE c."amount" > 0 AND (c."expires_at" IS NULL OR c."expires_at" > now())
GROUP BY 1;

INSERT INTO "credit_wallets" ("id", "academy_id", "balance", "updated_at")
SELECT gen_random_uuid()::text, "wallet_id", "credits", now() FROM "_ai_credit_convert"
ON CONFLICT ("academy_id") DO UPDATE SET "balance" = "credit_wallets"."balance" + EXCLUDED."balance", "updated_at" = now();

INSERT INTO "credit_transactions" ("id", "academy_id", "type", "amount", "balance_after", "memo", "created_at")
SELECT gen_random_uuid()::text, t."wallet_id", 'ADMIN_ADJUST', t."credits", w."balance",
       '기존 AI 크레딧 전환 (쓰기 ' || t."writing" || '회 · 문제 생성 ' || t."question" || '회)', now()
FROM "_ai_credit_convert" t JOIN "credit_wallets" w ON w."academy_id" = t."wallet_id";
