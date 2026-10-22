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

  it('뜻 없이 쉼표로 나열하면 여러 단어', () => {
    expect(parseFlashcardText('apple, banana, cherry').entries.map((e) => e.term)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('뜻에 쉼표가 있어도 한 단어로 본다', () => {
    expect(parseFlashcardText('run 달리다, 운영하다').entries).toEqual([{ term: 'run', meaning: '달리다, 운영하다' }])
  })

  it('중복은 건너뛰고 나중에 적은 뜻으로 채운다', () => {
    const r = parseFlashcardText('Apple\napple 사과')
    expect(r.entries).toEqual([{ term: 'Apple', meaning: '사과' }])
    expect(r.duplicateCount).toBe(1)
  })

  it('영어 단어가 없는 줄은 오류로 모은다', () => {
    const r = parseFlashcardText('사과\n\n12345\napple')
    expect(r.entries.map((e) => e.term)).toEqual(['apple'])
    expect(r.invalidLines).toEqual(['사과', '12345'])
  })
})
