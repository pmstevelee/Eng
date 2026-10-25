import { describe, expect, it } from 'vitest'
import {
  getPublishBlockReason,
  getStatusChangeBlockReason,
  parseGrammarPointDraft,
  validateGrammarPointInput,
} from './point-editing'

const base = {
  title: ' 수동태의 기본 ',
  levelMin: 4,
  levelMax: 6,
  summary: ' be + p.p. ',
  rules: [{ text: 'be동사 + 과거분사', formula: 'be + p.p.' }, { text: '  ' }],
  examples: [{ en: 'The window was broken.', ko: '창문이 깨졌다.' }, { en: '', ko: '' }],
  commonErrors: [{ wrong: 'The door was open by him.', correct: 'The door was opened by him.', reason: '과거분사' }],
  prerequisiteIds: ['a', 'a', 'b'],
}

describe('validateGrammarPointInput', () => {
  it('공백을 지우고 빈 행·중복 선수를 정리한다', () => {
    const r = validateGrammarPointInput(base, 'self')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.title).toBe('수동태의 기본')
    expect(r.value.summary).toBe('be + p.p.')
    expect(r.value.rules).toHaveLength(1)
    expect(r.value.examples).toHaveLength(1)
    expect(r.value.prerequisiteIds).toEqual(['a', 'b'])
  })

  it('제목이 비면 막는다', () => {
    expect(validateGrammarPointInput({ ...base, title: '  ' }, 'self').ok).toBe(false)
  })

  it('레벨 범위가 뒤집히면 막는다', () => {
    expect(validateGrammarPointInput({ ...base, levelMin: 7, levelMax: 3 }, 'self').ok).toBe(false)
    expect(validateGrammarPointInput({ ...base, levelMin: 0 }, 'self').ok).toBe(false)
  })

  it('자기 자신을 선수로 지정하면 막는다', () => {
    expect(validateGrammarPointInput({ ...base, prerequisiteIds: ['self'] }, 'self').ok).toBe(false)
  })
})

describe('상태 변경', () => {
  it('문항 22개 미만이면 공개를 막는다', () => {
    expect(getPublishBlockReason(21)).toContain('21개')
    expect(getPublishBlockReason(22)).toBeNull()
    expect(getStatusChangeBlockReason('REVIEW', 'PUBLISHED', 5)).not.toBeNull()
    expect(getStatusChangeBlockReason('REVIEW', 'PUBLISHED', 30)).toBeNull()
  })

  it('검수 요청은 초안에서만', () => {
    expect(getStatusChangeBlockReason('DRAFT', 'REVIEW', 0)).toBeNull()
    expect(getStatusChangeBlockReason('PUBLISHED', 'REVIEW', 0)).not.toBeNull()
  })

  it('초안으로 되돌리기는 항상 가능', () => {
    expect(getStatusChangeBlockReason('PUBLISHED', 'DRAFT', 0)).toBeNull()
    expect(getStatusChangeBlockReason('DRAFT', 'DRAFT', 0)).not.toBeNull()
  })
})

describe('parseGrammarPointDraft', () => {
  it('필수 항목이 다 있으면 통과', () => {
    const d = parseGrammarPointDraft({
      summary: '요약',
      rules: [{ text: '규칙' }],
      examples: [{ en: 'I am a boy.', ko: '나는 소년이다.' }],
      commonErrors: [{ wrong: 'I is', correct: 'I am', reason: '주어 일치' }],
    })
    expect(d?.rules).toHaveLength(1)
  })

  it('형식이 틀리면 null', () => {
    expect(parseGrammarPointDraft(null)).toBeNull()
    expect(parseGrammarPointDraft([])).toBeNull()
    expect(parseGrammarPointDraft({ summary: '요약', rules: 'x', examples: [], commonErrors: [] })).toBeNull()
  })
})
