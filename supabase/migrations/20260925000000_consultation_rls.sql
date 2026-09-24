-- ─── 상담관리 RLS ────────────────────────────────────────────────────────────
-- 학부모·미성년자 개인정보를 다루므로 anon/authenticated 직접 접근을 전면 차단한다.
-- 정책을 두지 않으면 RLS 활성 테이블은 모든 행이 거부되며,
-- 조회·수정은 서버(Prisma, service role)에서 권한 검증 후에만 수행한다.

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;
