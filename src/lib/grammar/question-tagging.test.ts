import { describe, expect, it } from 'vitest'
import { buildTaggingUserPrompt, getQuestionPreview, parseTaggingResponse } from './question-tagging'

const points = [
  { code: 'G01-01-01', title: 'be동사 현재형', group: '동사 › be동사' },
  { code: 'G01-01-02', title: 'be동사 부정문', group: '동사 › be동사' },
  { code: 'G05-02-01', title: '수동태의 기본', group: '수동태 › 기본' },
]

const q = (id: string, sub: string | null, text: string) => ({
  id,
  subCategory: sub,
  contentJson: { type: 'multiple_choice', question_text: text, options: ['is', 'are', 'am', 'be'], correct_answer: 'B' },
})

describe('buildTaggingUserPrompt', () => {
  it('같은 subCategory는 한 번만 적고 문항 번호는 입력 순서를 따른다', () => {
    const prompt = buildTaggingUserPrompt(
      [q('a', '시제 (기초)', 'They ____ students.'), q('b', null, 'He ____ tall.'), q('c', '시제 (기초)', 'We ____ happy.')],
      points,
    )
    expect(prompt.match(/기존 분류\(참고\): 시제 \(기초\)/g)).toHaveLength(1)
    expect(prompt).toContain('## 기존 분류(참고): (없음)\n2. He ____ tall.')
    expect(prompt).toContain('1. They ____ students.')
    expect(prompt).toContain('3. We ____ happy.')
    expect(prompt).toContain('정답: B (are)')
    expect(prompt.match(/\[동사 › be동사\]/g)).toHaveLength(1)
  })
})

describe('parseTaggingResponse', () => {
  const codes = new Set(points.map((p) => p.code))

  it('문항 순서대로 코드·확신도를 돌려주고, 빠지거나 틀린 코드는 null', () => {
    const res = parseTaggingResponse(
      {
        results: [
          { n: 1, code: 'g01-01-01', confidence: 0.93 },
          { n: 3, code: 'G99-99-99', confidence: 0.9 },
          { n: 1, code: 'G01-01-02', confidence: 0.5 }, // 같은 번호 두 번 → 처음 것
          { n: 9, code: 'G01-01-01', confidence: 1 }, // 없는 번호
          { n: '4', code: 'G05-02-01', confidence: 1.7 },
        ],
      },
      ['a', 'b', 'c', 'd'],
      codes,
    )
    expect(res).toEqual([
      { questionId: 'a', code: 'G01-01-01', confidence: 0.93 },
      { questionId: 'b', code: null, confidence: 0 },
      { questionId: 'c', code: null, confidence: 0 },
      { questionId: 'd', code: 'G05-02-01', confidence: 1 },
    ])
  })

  it('응답 형식이 다르면 전부 null', () => {
    expect(parseTaggingResponse({ items: [] }, ['a'], codes)).toEqual([{ questionId: 'a', code: null, confidence: 0 }])
  })
})

describe('getQuestionPreview', () => {
  it('정답 문자를 보기 인덱스로 바꾼다', () => {
    expect(getQuestionPreview(q('a', null, 'x').contentJson).answerIndex).toBe(1)
    expect(getQuestionPreview({ question_text: 'x', options: ['go', 'went'], correct_answer: 'went' }).answerIndex).toBe(1)
  })
  it('깨진 데이터도 안전하게 처리한다', () => {
    expect(getQuestionPreview(null)).toMatchObject({ type: 'unknown', text: '', options: [], answer: null, answerIndex: -1 })
  })
})
