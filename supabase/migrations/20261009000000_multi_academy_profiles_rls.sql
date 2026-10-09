-- ─── 다중 학원 가입: 학원별 프로필 알림 RLS ─────────────────────────────────────
-- 한 로그인 계정(auth.uid())이 학원마다 users 행(프로필)을 가지며 users.auth_id로 묶인다.
-- 추가 학원 프로필의 users.id는 auth.uid()와 다르므로, 알림 실시간 구독(NotificationBell)이
-- "user_id = auth.uid()" 조건에 막히지 않도록 같은 계정의 프로필이면 허용한다.

create or replace function public.is_my_profile(profile_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = profile_id and auth_id = auth.uid()::text
  );
$$;

drop policy if exists "notifications: teacher 본인 알림 조회" on public.notifications;
create policy "notifications: teacher 본인 알림 조회"
  on public.notifications for select
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_profile(user_id)
  );

drop policy if exists "notifications: teacher 본인 알림 수정" on public.notifications;
create policy "notifications: teacher 본인 알림 수정"
  on public.notifications for update
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_profile(user_id)
  );

drop policy if exists "notifications: student 본인 알림 조회" on public.notifications;
create policy "notifications: student 본인 알림 조회"
  on public.notifications for select
  using (
    public.get_my_role() = 'STUDENT'
    and public.is_my_profile(user_id)
  );

drop policy if exists "notifications: student 본인 알림 수정" on public.notifications;
create policy "notifications: student 본인 알림 수정"
  on public.notifications for update
  using (
    public.get_my_role() = 'STUDENT'
    and public.is_my_profile(user_id)
  );
