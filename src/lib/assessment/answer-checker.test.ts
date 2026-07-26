import { describe, it, expect } from 'vitest'
import { normalizeAnswer, isAnswerMatch } from './answer-checker'

describe('normalizeAnswer', () => {
  it('대소문자 차이를 무시한다', () => {
    expect(normalizeAnswer('WERE')).toBe(normalizeAnswer('were'))
  })

  it('앞뒤 공백과 중복 공백을 정리한다', () => {
    expect(normalizeAnswer('  were   ')).toBe('were')
  })

  it('스마트 따옴표를 ASCII로 통일한다', () => {
    expect(normalizeAnswer('don’t')).toBe("don't")
  })

  it('전각 문자를 반각으로 변환한다', () => {
    expect(normalizeAnswer('ｗｅｒｅ')).toBe('were')
  })

  it('문장 끝 구두점을 제거한다', () => {
    expect(normalizeAnswer('were.')).toBe('were')
    expect(normalizeAnswer('were!')).toBe('were')
  })
})

describe('isAnswerMatch', () => {
  it('완전히 동일한 답은 정답 처리한다', () => {
    expect(isAnswerMatch('were', 'were')).toBe(true)
  })

  it('대소문자만 다른 답도 정답 처리한다 (스크린샷 재현 케이스)', () => {
    expect(isAnswerMatch('WERE', 'were')).toBe(true)
    expect(isAnswerMatch('Were', 'were')).toBe(true)
  })

  it('정답이 보기 문자("B")로 저장되어 있어도 보기 본문 입력을 정답 처리한다', () => {
    const options = ['was', 'were', 'is', 'be']
    // content.correct_answer === 'B' (1-indexed 아님, A=0)
    expect(isAnswerMatch('were', 'B', options)).toBe(true)
    expect(isAnswerMatch('were', 'b', options)).toBe(true)
  })

  it('학생이 보기 문자로 답하고 정답이 본문으로 저장된 경우도 정답 처리한다', () => {
    const options = ['was', 'were', 'is', 'be']
    expect(isAnswerMatch('B', 'were', options)).toBe(true)
  })

  it('보기 텍스트에 "B) were" 접두어가 섞여 있어도 정답 처리한다', () => {
    expect(isAnswerMatch('were', 'B) were')).toBe(true)
    expect(isAnswerMatch('B) were', 'were')).toBe(true)
  })

  it('오답은 여전히 오답으로 판정한다', () => {
    const options = ['was', 'were', 'is', 'be']
    expect(isAnswerMatch('was', 'B', options)).toBe(false)
    expect(isAnswerMatch('is not right', 'were')).toBe(false)
  })

  it('빈 답안은 오답 처리한다', () => {
    expect(isAnswerMatch('', 'were')).toBe(false)
  })
})
