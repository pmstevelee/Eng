// 문법 커리큘럼 코드 형식 — 대분류 G07, 중분류 G07-01, 포인트 G07-01-03
// 외부 의존 없는 순수 함수 (시드·서버·테스트 공용)

export type GrammarCodeDepth = 1 | 2 | 3

const CODE_PATTERNS: Record<GrammarCodeDepth, RegExp> = {
  1: /^G\d{2}$/,
  2: /^G\d{2}-\d{2}$/,
  3: /^G\d{2}-\d{2}-\d{2}$/,
}

/** 코드 깊이 — 1 대분류, 2 중분류, 3 포인트. 형식이 틀리면 null */
export function getGrammarCodeDepth(code: string): GrammarCodeDepth | null {
  if (CODE_PATTERNS[1].test(code)) return 1
  if (CODE_PATTERNS[2].test(code)) return 2
  if (CODE_PATTERNS[3].test(code)) return 3
  return null
}

/**
 * 코드 형식 검사. depth를 주면 그 깊이인지까지 확인한다.
 * 번호 00은 쓰지 않는다 (G00, G01-00 등은 무효).
 */
export function isValidGrammarCode(code: string, depth?: GrammarCodeDepth): boolean {
  const actual = getGrammarCodeDepth(code)
  if (actual === null) return false
  if (code.split('-').some((part) => /^G?00$/.test(part))) return false
  return depth === undefined || actual === depth
}

/** 상위 코드 — G07-01-03 → G07-01, G07-01 → G07, 대분류·무효 코드는 null */
export function getParentGrammarCode(code: string): string | null {
  const depth = getGrammarCodeDepth(code)
  if (depth === null || depth === 1) return null
  return code.slice(0, code.lastIndexOf('-'))
}
