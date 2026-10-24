import { describe, it, expect } from 'vitest'
import {
  parseGrammarRules,
  parseGrammarExamples,
  parseGrammarCommonErrors,
  parseGrammarAttemptAnswers,
} from './grammar'

describe('문법 포인트 JSON 파서', () => {
  it('배열이 아니면 빈 배열', () => {
    expect(parseGrammarRules(null)).toEqual([])
    expect(parseGrammarExamples({ en: 'a' })).toEqual([])
    expect(parseGrammarCommonErrors('x')).toEqual([])
  })

  it('규칙: text 없는 항목은 버리고 formula는 있을 때만', () => {
    expect(parseGrammarRules([{ text: ' be + p.p. ' }, { formula: 'x' }, { text: '규칙', formula: 'be + p.p.' }])).toEqual([
      { text: 'be + p.p.' },
      { text: '규칙', formula: 'be + p.p.' },
    ])
  })

  it('예문: en·ko 둘 다 있어야 함', () => {
    expect(
      parseGrammarExamples([
        { en: 'The window was broken.', ko: '창문이 깨졌다.' },
        { en: 'Only English' },
        { en: 'It was made in Korea.', ko: '한국에서 만들어졌다.', highlight: 'was made' },
      ]),
    ).toEqual([
      { en: 'The window was broken.', ko: '창문이 깨졌다.' },
      { en: 'It was made in Korea.', ko: '한국에서 만들어졌다.', highlight: 'was made' },
    ])
  })

  it('흔한 오류: wrong·correct·reason 모두 필요', () => {
    expect(
      parseGrammarCommonErrors([
        { wrong: 'It was build.', correct: 'It was built.', reason: '과거분사 형태' },
        { wrong: 'x', correct: 'y' },
      ]),
    ).toEqual([{ wrong: 'It was build.', correct: 'It was built.', reason: '과거분사 형태' }])
  })

  it('시도 답안: isCorrect가 boolean이 아니면 버림', () => {
    expect(
      parseGrammarAttemptAnswers([
        { questionId: 'q1', answer: 'B', isCorrect: true },
        { questionId: 'q2', isCorrect: false },
        { questionId: 'q3', answer: 'A', isCorrect: 'yes' },
      ]),
    ).toEqual([
      { questionId: 'q1', answer: 'B', isCorrect: true },
      { questionId: 'q2', answer: '', isCorrect: false },
    ])
  })
})
