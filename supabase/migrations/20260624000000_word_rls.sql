-- ─── Word Learning Module RLS Policies ───────────────────────────────────────

-- words 테이블: 인증 사용자 SELECT만 허용 (수정은 서버 사이드만)
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "words_select_authenticated"
  ON words FOR SELECT
  TO authenticated
  USING (true);

-- word_sets 테이블: isPublic이거나 본인 소유이거나 같은 학원
ALTER TABLE word_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_sets_select"
  ON word_sets FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR owner_id = auth.uid()
    OR academy_id = (
      SELECT academy_id FROM users WHERE id = auth.uid()
    )
  );

-- word_set_items 테이블: 접근 가능한 세트의 항목만
ALTER TABLE word_set_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_set_items_select"
  ON word_set_items FOR SELECT
  TO authenticated
  USING (
    set_id IN (
      SELECT id FROM word_sets
      WHERE
        is_public = true
        OR owner_id = auth.uid()
        OR academy_id = (SELECT academy_id FROM users WHERE id = auth.uid())
    )
  );

-- word_progress 테이블: 본인 데이터만 CRUD
ALTER TABLE word_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_progress_select_own"
  ON word_progress FOR SELECT
  TO authenticated
  USING (
    student_id = (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "word_progress_insert_own"
  ON word_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "word_progress_update_own"
  ON word_progress FOR UPDATE
  TO authenticated
  USING (
    student_id = (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id = (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- word_tests 테이블: 본인 데이터만
ALTER TABLE word_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_tests_select_own"
  ON word_tests FOR SELECT
  TO authenticated
  USING (
    student_id = (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "word_tests_insert_own"
  ON word_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );
