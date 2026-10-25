import { describe, expect, it } from 'vitest'
import { joinTokens, type Token } from '../../../types/grammar-video'
import { mergeWithNext, retokenize, setTokenRole, splitToken, splitWords } from './token-edit'

const sentence: Token[] = [
  { text: 'The letter', role: 'obj' },
  { text: 'was written', role: 'verb' },
  { text: 'by Tom', role: 'subj' },
  { text: '.' },
]

describe('splitWords', () => {
  it('단어·문장부호·축약형', () => {
    expect(splitWords("It's a well-known song, isn't it?")).toEqual(["It's", 'a', 'well-known', 'song', ',', "isn't", 'it', '?'])
  })
})

describe('retokenize', () => {
  it('그대로면 묶음·색 유지', () => {
    expect(retokenize(joinTokens(sentence), sentence)).toEqual(sentence)
  })
  it('바뀐 부분만 색 없는 조각, 남은 묶음은 유지', () => {
    const out = retokenize('The letter was sent by Tom.', sentence)
    expect(out).toEqual([
      { text: 'The letter', role: 'obj' },
      { text: 'was' },
      { text: 'sent' },
      { text: 'by Tom', role: 'subj' },
      { text: '.' },
    ])
    expect(joinTokens(out)).toBe('The letter was sent by Tom.')
  })
})

describe('조각 편집', () => {
  it('색 바꾸기·지우기', () => {
    expect(setTokenRole(sentence, 3, 'hl')[3]).toEqual({ text: '.', role: 'hl' })
    expect(setTokenRole(sentence, 0, null)[0]).toEqual({ text: 'The letter' })
  })
  it('합치기는 문장부호 앞 공백 없이', () => {
    expect(mergeWithNext(sentence, 2)[2]).toEqual({ text: 'by Tom.', role: 'subj' })
    expect(mergeWithNext(sentence, 3)).toBe(sentence)
  })
  it('나누기는 같은 색으로', () => {
    expect(splitToken(sentence, 1).slice(1, 3)).toEqual([
      { text: 'was', role: 'verb' },
      { text: 'written', role: 'verb' },
    ])
  })
})
