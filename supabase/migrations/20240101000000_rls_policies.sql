-- ============================================================
-- IVY LMS - Row Level Security 정책
-- ============================================================
-- 원칙:
--   SUPER_ADMIN  : 전체 접근
--   ACADEMY_OWNER: 자기 학원 데이터만
--   TEACHER      : 담당 반/학생만
--   STUDENT      : 본인 데이터만
-- ============================================================

-- ─── 헬퍼 함수 ───────────────────────────────────────────────

-- 현재 로그인 사용자의 역할 반환
create or replace function public.get_my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid()::text;
$$;

-- 현재 로그인 사용자의 academy_id 반환
create or replace function public.get_my_academy_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select academy_id from public.users where id = auth.uid()::text;
$$;

-- 현재 로그인 사용자의 students.id 반환 (STUDENT 역할만 해당)
create or replace function public.get_my_student_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select id from public.students where user_id = auth.uid()::text;
$$;

-- 특정 student가 현재 교사의 담당 반에 속하는지 확인
create or replace function public.is_my_student(p_student_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = auth.uid()::text
  );
$$;


-- ─── RLS 활성화 ──────────────────────────────────────────────

alter table public.academies         enable row level security;
alter table public.users             enable row level security;
alter table public.students          enable row level security;
alter table public.classes           enable row level security;
alter table public.tests             enable row level security;
alter table public.test_sessions     enable row level security;
alter table public.questions         enable row level security;
alter table public.question_responses enable row level security;
alter table public.skill_assessments enable row level security;
alter table public.learning_paths    enable row level security;
alter table public.teacher_comments  enable row level security;
alter table public.reports           enable row level security;
alter table public.notifications     enable row level security;
alter table public.attendance        enable row level security;
alter table public.badges            enable row level security;
alter table public.badge_earnings    enable row level security;
alter table public.enrollments       enable row level security;


-- ============================================================
-- 1. academies
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "academies: super_admin 전체 접근"
  on public.academies for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원
create policy "academies: owner 자기 학원 조회"
  on public.academies for select
  using (id = public.get_my_academy_id());

create policy "academies: owner 자기 학원 수정"
  on public.academies for update
  using (id = public.get_my_academy_id());

-- TEACHER: 자기 학원 조회
create policy "academies: teacher 자기 학원 조회"
  on public.academies for select
  using (
    public.get_my_role() = 'TEACHER'
    and id = public.get_my_academy_id()
  );

-- STUDENT: 자기 학원 조회
create policy "academies: student 자기 학원 조회"
  on public.academies for select
  using (
    public.get_my_role() = 'STUDENT'
    and id = public.get_my_academy_id()
  );


-- ============================================================
-- 2. users
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "users: super_admin 전체 접근"
  on public.users for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 사용자 전체 관리
create policy "users: owner 자기 학원 조회"
  on public.users for select
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

create policy "users: owner 자기 학원 등록"
  on public.users for insert
  with check (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

create policy "users: owner 자기 학원 수정"
  on public.users for update
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

create policy "users: owner 자기 학원 삭제"
  on public.users for delete
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 같은 학원 사용자 조회 (학생/동료 확인 용도)
create policy "users: teacher 같은 학원 조회"
  on public.users for select
  using (
    public.get_my_role() = 'TEACHER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 자기 정보 수정
create policy "users: teacher 본인 수정"
  on public.users for update
  using (
    public.get_my_role() = 'TEACHER'
    and id = auth.uid()::text
  );

-- STUDENT: 본인 조회/수정만
create policy "users: student 본인 조회"
  on public.users for select
  using (
    public.get_my_role() = 'STUDENT'
    and id = auth.uid()::text
  );

create policy "users: student 본인 수정"
  on public.users for update
  using (
    public.get_my_role() = 'STUDENT'
    and id = auth.uid()::text
  );


-- ============================================================
-- 3. students
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "students: super_admin 전체 접근"
  on public.students for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 학생 전체 관리
create policy "students: owner 자기 학원 전체 접근"
  on public.students for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.users u
      where u.id = students.user_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 반 학생 조회/수정
create policy "students: teacher 담당 학생 조회"
  on public.students for select
  using (
    public.get_my_role() = 'TEACHER'
    and (
      -- 담당 반 소속
      class_id in (
        select id from public.classes where teacher_id = auth.uid()::text
      )
      -- 또는 학원 내 학생 (반 배정 전 학생 관리)
      or exists (
        select 1 from public.users u
        where u.id = students.user_id
          and u.academy_id = public.get_my_academy_id()
      )
    )
  );

create policy "students: teacher 담당 학생 수정"
  on public.students for update
  using (
    public.get_my_role() = 'TEACHER'
    and class_id in (
      select id from public.classes where teacher_id = auth.uid()::text
    )
  );

-- STUDENT: 본인 조회/수정
create policy "students: student 본인 조회"
  on public.students for select
  using (
    public.get_my_role() = 'STUDENT'
    and user_id = auth.uid()::text
  );

create policy "students: student 본인 수정"
  on public.students for update
  using (
    public.get_my_role() = 'STUDENT'
    and user_id = auth.uid()::text
  );


-- ============================================================
-- 4. classes
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "classes: super_admin 전체 접근"
  on public.classes for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 반 전체 관리
create policy "classes: owner 자기 학원 전체 접근"
  on public.classes for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 본인 담당 반 조회/수정
create policy "classes: teacher 담당 반 조회"
  on public.classes for select
  using (
    public.get_my_role() = 'TEACHER'
    and academy_id = public.get_my_academy_id()
  );

create policy "classes: teacher 담당 반 수정"
  on public.classes for update
  using (
    public.get_my_role() = 'TEACHER'
    and teacher_id = auth.uid()::text
  );

-- STUDENT: 자기가 속한 반 조회
create policy "classes: student 소속 반 조회"
  on public.classes for select
  using (
    public.get_my_role() = 'STUDENT'
    and id = (
      select class_id from public.students where user_id = auth.uid()::text
    )
  );


-- ============================================================
-- 5. tests
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "tests: super_admin 전체 접근"
  on public.tests for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 테스트 전체 관리
create policy "tests: owner 자기 학원 전체 접근"
  on public.tests for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 자기 학원 테스트 조회/생성/수정
create policy "tests: teacher 자기 학원 조회"
  on public.tests for select
  using (
    public.get_my_role() = 'TEACHER'
    and academy_id = public.get_my_academy_id()
  );

create policy "tests: teacher 테스트 생성"
  on public.tests for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and academy_id = public.get_my_academy_id()
    and created_by = auth.uid()::text
  );

create policy "tests: teacher 본인 테스트 수정"
  on public.tests for update
  using (
    public.get_my_role() = 'TEACHER'
    and created_by = auth.uid()::text
  );

-- STUDENT: 활성화된 테스트 조회
create policy "tests: student 활성 테스트 조회"
  on public.tests for select
  using (
    public.get_my_role() = 'STUDENT'
    and academy_id = public.get_my_academy_id()
    and is_active = true
  );


-- ============================================================
-- 6. test_sessions
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "test_sessions: super_admin 전체 접근"
  on public.test_sessions for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 학생 세션 전체
create policy "test_sessions: owner 자기 학원 전체 접근"
  on public.test_sessions for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1
      from public.students s
      join public.users u on u.id = s.user_id
      where s.id = test_sessions.student_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 학생 세션 조회
create policy "test_sessions: teacher 담당 학생 세션 조회"
  on public.test_sessions for select
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

-- STUDENT: 본인 세션 조회/생성/수정
create policy "test_sessions: student 본인 세션 조회"
  on public.test_sessions for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );

create policy "test_sessions: student 본인 세션 생성"
  on public.test_sessions for insert
  with check (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );

create policy "test_sessions: student 본인 세션 수정"
  on public.test_sessions for update
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 7. questions
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "questions: super_admin 전체 접근"
  on public.questions for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 문제 + 공용 문제(academy_id IS NULL)
create policy "questions: owner 자기 학원 + 공용 조회"
  on public.questions for select
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and (academy_id = public.get_my_academy_id() or academy_id is null)
  );

create policy "questions: owner 자기 학원 문제 관리"
  on public.questions for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 자기 학원 + 공용 문제 조회/생성/수정
create policy "questions: teacher 조회"
  on public.questions for select
  using (
    public.get_my_role() = 'TEACHER'
    and (academy_id = public.get_my_academy_id() or academy_id is null)
  );

create policy "questions: teacher 문제 생성"
  on public.questions for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and academy_id = public.get_my_academy_id()
    and created_by = auth.uid()::text
  );

create policy "questions: teacher 본인 문제 수정"
  on public.questions for update
  using (
    public.get_my_role() = 'TEACHER'
    and created_by = auth.uid()::text
  );

-- STUDENT: 자기 학원 + 공용 문제 조회 (응시 중)
create policy "questions: student 문제 조회"
  on public.questions for select
  using (
    public.get_my_role() = 'STUDENT'
    and (academy_id = public.get_my_academy_id() or academy_id is null)
  );


-- ============================================================
-- 8. question_responses
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "question_responses: super_admin 전체 접근"
  on public.question_responses for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 응답 전체
create policy "question_responses: owner 자기 학원 전체 접근"
  on public.question_responses for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1
      from public.test_sessions ts
      join public.students s on s.id = ts.student_id
      join public.users u on u.id = s.user_id
      where ts.id = question_responses.session_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 학생 응답 조회
create policy "question_responses: teacher 담당 학생 응답 조회"
  on public.question_responses for select
  using (
    public.get_my_role() = 'TEACHER'
    and exists (
      select 1
      from public.test_sessions ts
      where ts.id = question_responses.session_id
        and public.is_my_student(ts.student_id::text)
    )
  );

-- STUDENT: 본인 응답 조회/생성/수정
create policy "question_responses: student 본인 응답 조회"
  on public.question_responses for select
  using (
    public.get_my_role() = 'STUDENT'
    and exists (
      select 1 from public.test_sessions ts
      where ts.id = question_responses.session_id
        and ts.student_id = public.get_my_student_id()
    )
  );

create policy "question_responses: student 본인 응답 생성"
  on public.question_responses for insert
  with check (
    public.get_my_role() = 'STUDENT'
    and exists (
      select 1 from public.test_sessions ts
      where ts.id = question_responses.session_id
        and ts.student_id = public.get_my_student_id()
    )
  );

create policy "question_responses: student 본인 응답 수정"
  on public.question_responses for update
  using (
    public.get_my_role() = 'STUDENT'
    and exists (
      select 1 from public.test_sessions ts
      where ts.id = question_responses.session_id
        and ts.student_id = public.get_my_student_id()
    )
  );


-- ============================================================
-- 9. skill_assessments
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "skill_assessments: super_admin 전체 접근"
  on public.skill_assessments for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 학생 평가 전체
create policy "skill_assessments: owner 자기 학원 전체 접근"
  on public.skill_assessments for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.students s
      join public.users u on u.id = s.user_id
      where s.id = skill_assessments.student_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 학생 평가 조회/생성/수정
create policy "skill_assessments: teacher 담당 학생 조회"
  on public.skill_assessments for select
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

create policy "skill_assessments: teacher 담당 학생 생성"
  on public.skill_assessments for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

create policy "skill_assessments: teacher 담당 학생 수정"
  on public.skill_assessments for update
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

-- STUDENT: 본인 평가 조회
create policy "skill_assessments: student 본인 조회"
  on public.skill_assessments for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 10. learning_paths
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "learning_paths: super_admin 전체 접근"
  on public.learning_paths for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 학생 학습 경로 전체
create policy "learning_paths: owner 자기 학원 전체 접근"
  on public.learning_paths for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.students s
      join public.users u on u.id = s.user_id
      where s.id = learning_paths.student_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 학생 학습 경로 조회/생성/수정
create policy "learning_paths: teacher 담당 학생 조회"
  on public.learning_paths for select
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

create policy "learning_paths: teacher 담당 학생 생성"
  on public.learning_paths for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

create policy "learning_paths: teacher 담당 학생 수정"
  on public.learning_paths for update
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

-- STUDENT: 본인 학습 경로 조회
create policy "learning_paths: student 본인 조회"
  on public.learning_paths for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 11. teacher_comments
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "teacher_comments: super_admin 전체 접근"
  on public.teacher_comments for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 코멘트 전체
create policy "teacher_comments: owner 자기 학원 전체 접근"
  on public.teacher_comments for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.users u
      where u.id = teacher_comments.teacher_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 본인이 작성한 코멘트만 관리
create policy "teacher_comments: teacher 본인 코멘트 조회"
  on public.teacher_comments for select
  using (
    public.get_my_role() = 'TEACHER'
    and teacher_id = auth.uid()::text
  );

create policy "teacher_comments: teacher 코멘트 생성"
  on public.teacher_comments for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and teacher_id = auth.uid()::text
    and public.is_my_student(student_id::text)
  );

create policy "teacher_comments: teacher 본인 코멘트 수정"
  on public.teacher_comments for update
  using (
    public.get_my_role() = 'TEACHER'
    and teacher_id = auth.uid()::text
  );

create policy "teacher_comments: teacher 본인 코멘트 삭제"
  on public.teacher_comments for delete
  using (
    public.get_my_role() = 'TEACHER'
    and teacher_id = auth.uid()::text
  );

-- STUDENT: 본인에 대한 코멘트 조회
create policy "teacher_comments: student 본인 코멘트 조회"
  on public.teacher_comments for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 12. reports
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "reports: super_admin 전체 접근"
  on public.reports for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 학생 리포트 전체
create policy "reports: owner 자기 학원 전체 접근"
  on public.reports for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.students s
      join public.users u on u.id = s.user_id
      where s.id = reports.student_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 학생 리포트 조회/생성
create policy "reports: teacher 담당 학생 조회"
  on public.reports for select
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

create policy "reports: teacher 담당 학생 생성"
  on public.reports for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
    and generated_by = auth.uid()::text
  );

-- STUDENT: 본인 리포트 조회
create policy "reports: student 본인 조회"
  on public.reports for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 13. notifications
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "notifications: super_admin 전체 접근"
  on public.notifications for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 알림 전체
create policy "notifications: owner 자기 학원 전체 접근"
  on public.notifications for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and (
      user_id = auth.uid()::text
      or academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 본인 알림 조회/수정 (읽음 처리)
create policy "notifications: teacher 본인 알림 조회"
  on public.notifications for select
  using (
    public.get_my_role() = 'TEACHER'
    and user_id = auth.uid()::text
  );

create policy "notifications: teacher 본인 알림 수정"
  on public.notifications for update
  using (
    public.get_my_role() = 'TEACHER'
    and user_id = auth.uid()::text
  );

-- STUDENT: 본인 알림 조회/수정 (읽음 처리)
create policy "notifications: student 본인 알림 조회"
  on public.notifications for select
  using (
    public.get_my_role() = 'STUDENT'
    and user_id = auth.uid()::text
  );

create policy "notifications: student 본인 알림 수정"
  on public.notifications for update
  using (
    public.get_my_role() = 'STUDENT'
    and user_id = auth.uid()::text
  );


-- ============================================================
-- 14. attendance
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "attendance: super_admin 전체 접근"
  on public.attendance for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 출석 전체
create policy "attendance: owner 자기 학원 전체 접근"
  on public.attendance for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.classes c
      where c.id = attendance.class_id
        and c.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 반 출석 조회/생성/수정
create policy "attendance: teacher 담당 반 조회"
  on public.attendance for select
  using (
    public.get_my_role() = 'TEACHER'
    and class_id in (
      select id from public.classes where teacher_id = auth.uid()::text
    )
  );

create policy "attendance: teacher 담당 반 생성"
  on public.attendance for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and class_id in (
      select id from public.classes where teacher_id = auth.uid()::text
    )
  );

create policy "attendance: teacher 담당 반 수정"
  on public.attendance for update
  using (
    public.get_my_role() = 'TEACHER'
    and class_id in (
      select id from public.classes where teacher_id = auth.uid()::text
    )
  );

-- STUDENT: 본인 출석 조회
create policy "attendance: student 본인 조회"
  on public.attendance for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 15. badges
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "badges: super_admin 전체 접근"
  on public.badges for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 + 공용 배지 관리
create policy "badges: owner 자기 학원 + 공용 조회"
  on public.badges for select
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and (academy_id = public.get_my_academy_id() or academy_id is null)
  );

create policy "badges: owner 자기 학원 배지 관리"
  on public.badges for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 자기 학원 + 공용 배지 조회
create policy "badges: teacher 조회"
  on public.badges for select
  using (
    public.get_my_role() = 'TEACHER'
    and (academy_id = public.get_my_academy_id() or academy_id is null)
  );

-- STUDENT: 자기 학원 + 공용 배지 조회
create policy "badges: student 조회"
  on public.badges for select
  using (
    public.get_my_role() = 'STUDENT'
    and (academy_id = public.get_my_academy_id() or academy_id is null)
  );


-- ============================================================
-- 16. badge_earnings
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "badge_earnings: super_admin 전체 접근"
  on public.badge_earnings for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 학생 배지 전체
create policy "badge_earnings: owner 자기 학원 전체 접근"
  on public.badge_earnings for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and exists (
      select 1 from public.students s
      join public.users u on u.id = s.user_id
      where s.id = badge_earnings.student_id
        and u.academy_id = public.get_my_academy_id()
    )
  );

-- TEACHER: 담당 학생 배지 조회/수여
create policy "badge_earnings: teacher 담당 학생 조회"
  on public.badge_earnings for select
  using (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

create policy "badge_earnings: teacher 담당 학생 수여"
  on public.badge_earnings for insert
  with check (
    public.get_my_role() = 'TEACHER'
    and public.is_my_student(student_id::text)
  );

-- STUDENT: 본인 배지 조회
create policy "badge_earnings: student 본인 조회"
  on public.badge_earnings for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );


-- ============================================================
-- 17. enrollments
-- ============================================================

-- SUPER_ADMIN: 전체
create policy "enrollments: super_admin 전체 접근"
  on public.enrollments for all
  using (public.get_my_role() = 'SUPER_ADMIN');

-- ACADEMY_OWNER: 자기 학원 수강 등록 전체
create policy "enrollments: owner 자기 학원 전체 접근"
  on public.enrollments for all
  using (
    public.get_my_role() = 'ACADEMY_OWNER'
    and academy_id = public.get_my_academy_id()
  );

-- TEACHER: 담당 반 수강 등록 조회
create policy "enrollments: teacher 담당 반 조회"
  on public.enrollments for select
  using (
    public.get_my_role() = 'TEACHER'
    and class_id in (
      select id from public.classes where teacher_id = auth.uid()::text
    )
  );

-- STUDENT: 본인 수강 등록 조회
create policy "enrollments: student 본인 조회"
  on public.enrollments for select
  using (
    public.get_my_role() = 'STUDENT'
    and student_id = public.get_my_student_id()
  );
