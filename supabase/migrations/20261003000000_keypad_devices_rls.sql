-- ─── 출결 키패드 기기 RLS ───────────────────────────────────────────────────
-- 기기 토큰 해시·등록 코드 해시가 담긴 테이블이므로 API(PostgREST) 직접 접근은 모두 차단한다.
-- 앱은 서버(Prisma, RLS 우회 역할)에서만 읽고 쓴다. 정책이 없으면 RLS가 모든 행을 거부한다.

alter table public.keypad_devices enable row level security;
alter table public.keypad_registration_codes enable row level security;
