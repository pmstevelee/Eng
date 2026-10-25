import { describe, expect, it } from 'vitest'
import { isAnswerMatch } from '../assessment/answer-checker'
import {
  buildReviewUserPrompt,
  hasTenseAmbiguity,
  parseGeneratedQuestions,
  parseReviewResponse,
  questionDedupKeys,
  selfGradeCheck,
  spreadDifficulty,
  toAnswerLetter,
  type GeneratedQuestionContent,
} from './question-generation'

const mc = (over: Record<string, unknown> = {}) => ({
  type: 'multiple_choice',
  kind: 'blank',
  question_text: 'The window ____ by Tom yesterday.',
  question_text_ko: '빈칸에 알맞은 것을 고르세요.',
  options: ['broke', 'was broken', 'is broken', 'breaks'],
  correct_answer: 'B',
  explanation: '어제 일어난 수동태이므로 was broken.',
  difficulty: 5,
  ...over,
})

const fb = (over: Record<string, unknown> = {}) => ({
  type: 'fill_blank',
  question_text: 'She ____ (go) to school yesterday.',
  question_text_ko: '괄호 안의 단어를 알맞은 형태로 쓰세요.',
  correct_answer: 'went',
  explanation: 'yesterday가 있으므로 과거형 went.',
  difficulty: 4,
  ...over,
})

const opts = { levelMin: 4, levelMax: 6 }

describe('parseGeneratedQuestions', () => {
  it('객관식·빈칸 문항을 저장 형식으로 바꾼다', () => {
    const { questions, dropped } = parseGeneratedQuestions({ questions: [mc(), fb()] }, opts)
    expect(dropped).toBe(0)
    expect(questions).toHaveLength(2)
    expect(questions[0].content).toEqual({
      type: 'multiple_choice',
      question_text: 'The window ____ by Tom yesterday.',
      question_text_ko: '빈칸에 알맞은 것을 고르세요.',
      options: ['broke', 'was broken', 'is broken', 'breaks'],
      correct_answer: 'B',
      explanation: '어제 일어난 수동태이므로 was broken.',
    })
    expect(questions[1].content.type).toBe('fill_blank')
    expect(questions[1].content.correct_answer).toBe('went')
  })

  it('보기 접두어를 지우고, 정답이 보기 본문이면 문자로 바꾼다', () => {
    const { questions } = parseGeneratedQuestions(
      { questions: [mc({ options: ['A) broke', 'B) was broken', 'C) is broken', 'D) breaks'], correct_answer: 'was broken' })] },
      opts,
    )
    expect(questions[0].content.options).toEqual(['broke', 'was broken', 'is broken', 'breaks'])
    expect(questions[0].content.correct_answer).toBe('B')
  })

  it('형식이 틀린 문항은 버린다', () => {
    const bad = [
      mc({ options: ['a', 'b', 'c'] }), // 보기 3개
      mc({ options: ['was', 'was', 'is', 'be'] }), // 보기 중복
      mc({ correct_answer: 'E' }), // 없는 보기
      mc({ explanation: '' }), // 해설 없음
      fb({ question_text: 'She went to school.' }), // 빈칸 없음
      fb({ question_text: 'She ____ (go) and ____ (eat).' }), // 빈칸 2개
      fb({ correct_answer: 'B' }), // 보기 문자처럼 보이는 답
      { type: 'essay', question_text: 'Write.', explanation: '-' }, // 지원 안 하는 형식
    ]
    const { questions, dropped } = parseGeneratedQuestions({ questions: bad }, opts)
    expect(questions).toHaveLength(0)
    expect(dropped).toBe(bad.length)
  })

  it('기존 문항·같은 응답 안의 중복은 버린다', () => {
    const existing = questionDedupKeys(mc())
    const { questions, dropped } = parseGeneratedQuestions({ questions: [mc(), fb(), fb()] }, { ...opts, existingTexts: existing })
    expect(questions).toHaveLength(1)
    expect(dropped).toBe(2)
  })

  it('난이도는 포인트 레벨 범위 안으로 맞춘다', () => {
    const { questions } = parseGeneratedQuestions(
      { questions: [mc({ difficulty: 9 }), fb({ difficulty: 1 }), mc({ question_text: 'It ____ made in 2020.', difficulty: 'x' })] },
      opts,
    )
    expect(questions.map((q) => q.difficulty)).toEqual([6, 4, 6])
  })

  it('최대 개수(기본 10, maxCount)까지만 남긴다', () => {
    const many = Array.from({ length: 14 }, (_, i) => fb({ question_text: `Q${i} ____ (go) there.` }))
    const { questions, dropped } = parseGeneratedQuestions({ questions: many }, opts)
    expect(questions).toHaveLength(10)
    expect(dropped).toBe(4)
    expect(parseGeneratedQuestions({ questions: many }, { ...opts, maxCount: 12 }).questions).toHaveLength(12)
  })

  it('응답 형식이 아예 다르면 빈 결과', () => {
    expect(parseGeneratedQuestions(null, opts).questions).toEqual([])
    expect(parseGeneratedQuestions({ items: [mc()] }, opts).questions).toEqual([])
  })
})

describe('생성 문항이 기존 채점기로 정상 채점된다', () => {
  const { questions } = parseGeneratedQuestions({ questions: [mc(), fb()] }, opts)
  const [choice, blank] = questions.map((q) => q.content)

  it('객관식: 정답 문자·정답 본문은 정답, 다른 보기는 오답', () => {
    const options = choice.options ?? []
    expect(isAnswerMatch('B', choice.correct_answer, options)).toBe(true)
    expect(isAnswerMatch('was broken', choice.correct_answer, options)).toBe(true)
    expect(isAnswerMatch('A', choice.correct_answer, options)).toBe(false)
    expect(isAnswerMatch('broke', choice.correct_answer, options)).toBe(false)
    expect(isAnswerMatch('is broken', choice.correct_answer, options)).toBe(false)
  })

  it('빈칸: 대소문자·끝 마침표·공백이 달라도 정답, 다른 형태는 오답', () => {
    expect(isAnswerMatch('went', blank.correct_answer)).toBe(true)
    expect(isAnswerMatch(' Went. ', blank.correct_answer)).toBe(true)
    expect(isAnswerMatch('goes', blank.correct_answer)).toBe(false)
    expect(isAnswerMatch('', blank.correct_answer)).toBe(false)
  })

  it('보기 본문이 다른 보기 문자와 겹쳐 오답이 정답으로 채점되는 문항은 버린다', () => {
    // 보기 "a"(B 자리)를 고르면 정답 문자 "A"와 같아져 오답이 정답 처리된다
    const risky: GeneratedQuestionContent = {
      type: 'multiple_choice',
      question_text: 'I have ____ umbrella.',
      options: ['an', 'a', 'the', 'some'],
      correct_answer: 'A',
      explanation: '모음 소리 앞에는 an.',
    }
    expect(selfGradeCheck(risky)).toBe(false)
    const { questions: kept } = parseGeneratedQuestions({ questions: [{ ...risky, difficulty: 4 }] }, opts)
    expect(kept).toHaveLength(0)
  })
})

describe('toAnswerLetter', () => {
  const options = ['broke', 'was broken', 'is broken', 'breaks']
  it.each([
    ['B', 'B'],
    ['b', 'B'],
    ['(C)', 'C'],
    ['D)', 'D'],
    ['B) was broken', 'B'],
    ['was broken', 'B'],
    ['WAS BROKEN.', 'B'],
  ])('%s → %s', (raw, letter) => {
    expect(toAnswerLetter(raw, options)).toBe(letter)
  })
  it('없는 보기는 null', () => {
    expect(toAnswerLetter('E', options)).toBeNull()
    expect(toAnswerLetter('was break', options)).toBeNull()
  })
})

describe('spreadDifficulty', () => {
  it('레벨 범위에 고르게 퍼뜨린다', () => {
    expect([0, 1, 2, 3, 4].map((i) => spreadDifficulty(i, 5, 3, 5))).toEqual([3, 4, 4, 5, 5])
    expect(spreadDifficulty(3, 10, 4, 4)).toBe(4)
  })
})

describe('AI 검토(2차)', () => {
  const { questions } = parseGeneratedQuestions({ questions: [mc(), fb()] }, opts)
  const contents = questions.map((q) => q.content)

  it('검토 요청에 번호·보기·정답·해설을 담는다', () => {
    const prompt = buildReviewUserPrompt(contents)
    expect(prompt).toContain('1. [객관식] 빈칸에 알맞은 것을 고르세요. The window ____ by Tom yesterday.')
    expect(prompt).toContain('보기: A) broke / B) was broken / C) is broken / D) breaks')
    expect(prompt).toContain('2. [빈칸 쓰기]')
    expect(prompt).toContain('정답: went')
  })

  it('ok=false인 문항만 탈락, 빠진 번호는 통과', () => {
    expect(parseReviewResponse({ results: [{ n: 2, ok: false, issue: '두 개가 정답' }, { n: 9, ok: false }] }, 3)).toEqual([
      { ok: true, issue: '' },
      { ok: false, issue: '두 개가 정답' },
      { ok: true, issue: '' },
    ])
  })

  it('형식이 틀리면 null', () => {
    expect(parseReviewResponse({ items: [] }, 2)).toBeNull()
  })
})

describe('hasTenseAmbiguity', () => {
  const base = { explanation: '-', question_text_ko: '' }
  it('시제 단서 없이 is/was 보기가 같이 있으면 모호', () => {
    expect(
      hasTenseAmbiguity({ ...base, type: 'multiple_choice', question_text: 'The song ____ by the choir.', options: ['is sung', 'was sung', 'sang', 'sung'], correct_answer: 'A' }),
    ).toBe(true)
    expect(hasTenseAmbiguity({ ...base, type: 'fill_blank', question_text: 'The letter ____ (write) by my sister.', correct_answer: 'was written' })).toBe(true)
  })
  it('시제 단서가 있거나 시제와 무관하면 통과', () => {
    expect(
      hasTenseAmbiguity({ ...base, type: 'multiple_choice', question_text: 'The house ____ by my father last year.', options: ['was built', 'is built', 'built', 'build'], correct_answer: 'A' }),
    ).toBe(false)
    expect(hasTenseAmbiguity({ ...base, type: 'fill_blank', question_text: 'The homework ____ (finish) by the students last week.', correct_answer: 'was finished' })).toBe(false)
    expect(hasTenseAmbiguity({ ...base, type: 'fill_blank', question_text: 'She ____ (go) to school.', correct_answer: 'goes' })).toBe(false)
    expect(
      hasTenseAmbiguity({ ...base, type: 'multiple_choice', question_text: 'Which sentence is NOT correct?', options: ['a b', 'c d', 'e f', 'g h'], correct_answer: 'B' }),
    ).toBe(false)
  })
  it('검토자가 다른 정답을 적으면 탈락', () => {
    expect(parseReviewResponse({ results: [{ n: 1, ok: true, other_answers: ['B'] }] }, 1)).toEqual([{ ok: false, issue: '정답이 둘 이상입니다.' }])
  })
})
