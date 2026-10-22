import { describe, it, expect } from 'vitest'
import { parseFlashcardText } from './flashcard-text-parser'

describe('parseFlashcardText', () => {
  it('단어만 적은 줄', () => {
    expect(parseFlashcardText('apple\nbanana').entries).toEqual([
      { term: 'apple', meaning: null },
      { term: 'banana', meaning: null },
    ])
  })

  it('여러 구분자로 단어와 뜻을 나눈다', () => {
    const { entries } = parseFlashcardText(
      ['apple 사과', 'banana - 바나나', 'cherry: 체리', 'grape = 포도', 'lemon\t레몬', 'melon, 멜론', 'peach | 복숭아'].join('\n'),
    )
    expect(entries.map((e) => [e.term, e.meaning])).toEqual([
      ['apple', '사과'],
      ['banana', '바나나'],
      ['cherry', '체리'],
      ['grape', '포도'],
      ['lemon', '레몬'],
      ['melon', '멜론'],
      ['peach', '복숭아'],
    ])
  })

  it('앞 번호와 숙어를 처리한다', () => {
    const { entries } = parseFlashcardText('1. look forward to 기대하다\n2) give up\n③ well-known 유명한')
    expect(entries).toEqual([
      { term: 'look forward to', meaning: '기대하다' },
      { term: 'give up', meaning: null },
      { term: 'well-known', meaning: '유명한' },
    ])
  })

  it('번호 뒤에 띄어쓰기가 없어도 번호를 뗀다', () => {
    expect(parseFlashcardText('1.apple\n2)banana 바나나\n10. cherry').entries.map((e) => e.term)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('뜻 없이 쉼표로 나열하면 여러 단어', () => {
    expect(parseFlashcardText('apple, banana, cherry').entries.map((e) => e.term)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('뜻에 쉼표가 있어도 한 단어로 본다', () => {
    expect(parseFlashcardText('run 달리다, 운영하다').entries).toEqual([{ term: 'run', meaning: '달리다, 운영하다' }])
  })

  it('중복은 건너뛰고 나중에 적은 뜻으로 채운다', () => {
    const r = parseFlashcardText('Apple\napple 사과')
    expect(r.entries).toEqual([{ term: 'Apple', meaning: '사과' }])
    expect(r.duplicateTerms).toEqual(['apple'])
  })

  it('영어 단어가 없는 줄은 사유와 함께 모은다', () => {
    const r = parseFlashcardText('사과\n\n!!!\napple')
    expect(r.entries.map((e) => e.term)).toEqual(['apple'])
    expect(r.invalidLines.map((l) => l.line)).toEqual(['사과', '!!!'])
    expect(r.invalidLines[0].reason).toContain('한글로 시작')
    expect(r.invalidLines[1].reason).toContain('영어 단어를 찾지')
  })

  it('악센트·숫자가 들어간 단어도 받는다', () => {
    expect(parseFlashcardText('café\nnaïve 순진한\nMP3\nCOVID-19\n24/7\n3D').entries.map((e) => e.term)).toEqual([
      'café',
      'naïve',
      'MP3',
      'COVID-19',
      '24/7',
      '3D',
    ])
  })

  it('괄호 안의 뜻과 약어를 처리한다', () => {
    expect(parseFlashcardText('apple (사과)\ne.g. 예를 들어\nMr. 씨').entries).toEqual([
      { term: 'apple', meaning: '사과' },
      { term: 'e.g.', meaning: '예를 들어' },
      { term: 'Mr.', meaning: '씨' },
    ])
  })

  it('물음표 등 쓸 수 없는 기호가 있으면 사유를 알려준다', () => {
    const r = parseFlashcardText('How are you? 잘 지내?')
    expect(r.entries).toEqual([])
    expect(r.invalidLines[0].reason).toContain('기호')
  })
})
