-- ─── 출결관리 RLS ────────────────────────────────────────────────────────────
-- 원칙:
--   읽기  : 같은 학원(본원 또는 학원장이 소유한 지점) 소속 사용자
--           단, 학생은 출결 기록·변경 이력 중 본인 것만 조회
--   쓰기  : ACADEMY_OWNER · TEACHER (출결 설정은 ACADEMY_OWNER만)
--   SUPER_ADMIN : 전체
-- 앱의 조회·수정은 서버(Prisma)에서 권한 검증 후 수행하며, 이 정책은 직접 접근 방어용이다.
-- 헬퍼 get_my_role(), get_my_student_id()는 20240101000000_rls_policies.sql과 동일한 정의
-- (운영 DB에 해당 파일이 적용되지 않았을 수 있어 여기서도 create or replace 한다)

create or replace function public.get_my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid()::text;
$$;

create or replace function public.get_my_student_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select id from public.students where user_id = auth.uid()::text;
$$;

-- 현재 사용자가 해당 학원에 소속(또는 학원장으로서 지점을 소유)하는지
create or replace function public.can_access_academy(p_academy_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_academy_id = (select academy_id from public.users where id = auth.uid()::text)
      or exists (
        select 1 from public.academies a
        where a.id = p_academy_id
          and a.owner_id = auth.uid()::text
      );
$$;

-- 반이 접근 가능한 학원 소속인지
create or replace function public.can_access_class(p_class_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and public.can_access_academy(c.academy_id)
  );
$$;

alter table public.attendance_settings     enable row level security;
alter table public.class_schedules         enable row level security;
alter table public.class_sessions          enable row level security;
alter table public.attendance_records      enable row level security;
alter table public.attendance_change_logs  enable row level security;


-- ============================================================
-- attendance_settings — 쓰기는 학원장만
-- ============================================================

create policy "attendance_settings: super_admin 전체 접근"
  on public.attendance_settings for all
  using (public.get_my_role() = 'SUPER_ADMIN');

create policy "attendance_settings: 같은 학원 조회"
  on public.attendance_settings for select
  using (public.can_access_academy(academy_id));

create policy "attendance_settings: owner 쓰기"
  on public.attendance_settings for all
  using (public.get_my_role() = 'ACADEMY_OWNER' and public.can_access_academy(academy_id))
  with check (public.get_my_role() = 'ACADEMY_OWNER' and public.can_access_academy(academy_id));


-- ============================================================
-- class_schedules
-- ============================================================

create policy "class_schedules: super_admin 전체 접근"
  on public.class_schedules for all
  using (public.get_my_role() = 'SUPER_ADMIN');

create policy "class_schedules: 같은 학원 조회"
  on public.class_schedules for select
  using (public.can_access_class(class_id));

create policy "class_schedules: owner·teacher 쓰기"
  on public.class_schedules for all
  using (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_class(class_id))
  with check (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_class(class_id));


-- ============================================================
-- class_sessions
-- ============================================================

create policy "class_sessions: super_admin 전체 접근"
  on public.class_sessions for all
  using (public.get_my_role() = 'SUPER_ADMIN');

create policy "class_sessions: 같은 학원 조회"
  on public.class_sessions for select
  using (public.can_access_class(class_id));

create policy "class_sessions: owner·teacher 쓰기"
  on public.class_sessions for all
  using (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_class(class_id))
  with check (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_class(class_id));


-- ============================================================
-- attendance_records — 학생은 본인 기록만 조회
-- ============================================================

create policy "attendance_records: super_admin 전체 접근"
  on public.attendance_records for all
  using (public.get_my_role() = 'SUPER_ADMIN');

create policy "attendance_records: owner·teacher 같은 학원 조회"
  on public.attendance_records for select
  using (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_academy(academy_id));

create policy "attendance_records: student 본인 조회"
  on public.attendance_records for select
  using (public.get_my_role() = 'STUDENT' and student_id = public.get_my_student_id());

create policy "attendance_records: owner·teacher 쓰기"
  on public.attendance_records for all
  using (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_academy(academy_id))
  with check (public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER') and public.can_access_academy(academy_id));


-- ============================================================
-- attendance_change_logs — 기록 기준으로 판정
-- ============================================================

create policy "attendance_change_logs: super_admin 전체 접근"
  on public.attendance_change_logs for all
  using (public.get_my_role() = 'SUPER_ADMIN');

create policy "attendance_change_logs: owner·teacher 같은 학원 조회"
  on public.attendance_change_logs for select
  using (
    public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER')
    and exists (
      select 1 from public.attendance_records r
      where r.id = attendance_change_logs.record_id
        and public.can_access_academy(r.academy_id)
    )
  );

create policy "attendance_change_logs: student 본인 조회"
  on public.attendance_change_logs for select
  using (
    public.get_my_role() = 'STUDENT'
    and exists (
      select 1 from public.attendance_records r
      where r.id = attendance_change_logs.record_id
        and r.student_id = public.get_my_student_id()
    )
  );

create policy "attendance_change_logs: owner·teacher 쓰기"
  on public.attendance_change_logs for all
  using (
    public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER')
    and exists (
      select 1 from public.attendance_records r
      where r.id = attendance_change_logs.record_id
        and public.can_access_academy(r.academy_id)
    )
  )
  with check (
    public.get_my_role() in ('ACADEMY_OWNER', 'TEACHER')
    and exists (
      select 1 from public.attendance_records r
      where r.id = attendance_change_logs.record_id
        and public.can_access_academy(r.academy_id)
    )
  );
