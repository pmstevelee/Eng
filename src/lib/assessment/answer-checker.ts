// 주관식/객관식 답안 채점 공용 유틸리티
//
// 단순 문자열 비교(toLowerCase + trim)로는 아래 케이스가 전부 오답 처리되는 문제가 있어
// 모든 채점 경로(오늘의 미션, 배정 미션, 학습공간, 일반/적응형 테스트)가 이 모듈을 사용한다.
//  - 정답이 보기 문자("B")로 저장된 문제에 학생이 보기 본문("were")을 입력한 경우
//  - 보기 텍스트에 "B) were"처럼 문자 접두어가 포함된 데이터
//  - iPad 스마트 문장부호(' " 등), 전각 문자, 이중 공백, 문장 끝 마침표 차이

/** 스마트 따옴표/대시 → ASCII 통일 */
const CHAR_REPLACEMENTS: [RegExp, string][] = [
  [/[‘’‚‛′`´]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[–—−]/g, '-'],
]

/** 답안 정규화: 전각→반각(NFKC), 따옴표 통일, 소문자, 공백 정리, 끝 구두점 제거 */
export function normalizeAnswer(raw: string): string {
  let s = raw.normalize('NFKC')
  for (const [pattern, replacement] of CHAR_REPLACEMENTS) {
    s = s.replace(pattern, replacement)
  }
  s = s.toLowerCase().replace(/\s+/g, ' ').trim()
  // 문장 끝 구두점(. ! ?)은 정답 여부에 영향 없음
  s = s.replace(/[.!?]+$/, '').trim()
  return s
}

/** "b) were", "b. were", "(b) were" 형태의 보기 문자 접두어 제거 (정규화된 문자열 기준) */
function stripOptionPrefix(s: string): string {
  const match = s.match(/^\(?([a-h])\)\s*|^([a-h])[.)]\s+/)
  if (match) {
    const rest = s.slice(match[0].length).trim()
    if (rest) return rest
  }
  return s
}

/** 정규화된 단일 문자(a~h)를 보기 인덱스로 변환. 해당 없으면 null */
function letterToIndex(s: string): number | null {
  return /^[a-h]$/.test(s) ? s.charCodeAt(0) - 97 : null
}

/**
 * 학생 답안이 정답인지 판정한다.
 * - 정규화 후 동일하면 정답
 * - 보기 문자 접두어("B) were")를 제거한 형태끼리 동일해도 정답
 * - options가 있으면 보기 문자("B")와 보기 본문("were")을 상호 인정
 */
export function isAnswerMatch(
  studentAnswer: string,
  correctAnswer: string,
  options?: string[],
): boolean {
  const student = normalizeAnswer(studentAnswer)
  const correct = normalizeAnswer(correctAnswer)
  if (!student || !correct) return false
  if (student === correct) return true

  const studentText = stripOptionPrefix(student)
  const correctText = stripOptionPrefix(correct)
  if (studentText === correctText) return true

  if (options && options.length > 0) {
    const optionTexts = options.map((opt) => stripOptionPrefix(normalizeAnswer(opt)))

    // 정답이 보기 문자인 경우: 학생이 해당 보기 본문을 입력해도 정답
    const correctIdx = letterToIndex(correct)
    if (correctIdx !== null && optionTexts[correctIdx] !== undefined) {
      if (optionTexts[correctIdx] === studentText) return true
    }

    // 학생이 보기 문자로 답한 경우: 해당 보기 본문이 정답 텍스트와 일치하면 정답
    const studentIdx = letterToIndex(student)
    if (studentIdx !== null && optionTexts[studentIdx] !== undefined) {
      if (optionTexts[studentIdx] === correctText) return true
    }
  }

  return false
}
