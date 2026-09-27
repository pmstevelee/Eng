-- ─── 알림 크레딧 · 출결 알림 발송 작업 RLS ─────────────────────────────────────
-- 잔액·결제·학부모 연락처가 담긴 테이블이므로 API(PostgREST) 직접 접근은 모두 차단한다.
-- 앱은 서버(Prisma, RLS 우회 역할)에서만 읽고 쓴다. 정책이 없으면 RLS가 모든 행을 거부한다.

alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.credit_pricings enable row level security;
alter table public.credit_packages enable row level security;
alter table public.notification_jobs enable row level security;
