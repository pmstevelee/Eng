-- ─── 시험별 단어 카테고리 RLS ─────────────────────────────────────────────────

-- word_exam_categories 테이블: 인증 사용자 SELECT만 허용 (수정은 서버 사이드만)
ALTER TABLE word_exam_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_exam_categories_select_authenticated"
  ON word_exam_categories FOR SELECT
  TO authenticated
  USING (true);
