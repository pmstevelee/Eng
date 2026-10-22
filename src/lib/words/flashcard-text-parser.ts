// 업로드한 단어 텍스트 → 단어 목록 (서버·클라이언트 공용, 순수 함수)
//
// 한 줄에 한 단어가 기본이며 아래 형식을 모두 받는다.
//   apple                    → 단어만 (뜻은 AI가 채움)
//   apple 사과 / apple - 사과 / apple: 사과 / apple = 사과 / apple<TAB>사과 / apple, 사과
//   1. apple 사과 / ① apple   → 앞 번호는 무시
//   apple, banana, cherry     → 뜻 없이 쉼표로 나열하면 여러 단어
//   look forward to 기대하다  → 숙어도 한 단어로 취급

export const FLASHCARD_MAX_WORDS = 100
export const FLASHCARD_TERM_MAX_LENGTH = 60
export const FLASHCARD_MEANING_MAX_LENGTH = 100

export type ParsedFlashcardEntry = {
  term: string
  /** 사용자가 적은 한글 뜻 (없으면 AI가 생성) */
  meaning: string | null
}

export type FlashcardParseResult = {
  entries: ParsedFlashcardEntry[]
  /** 영어 단어를 찾지 못한 줄 (원문) */
  invalidLines: string[]
  /** 이미 위에 있던 단어라 건너뛴 수 */
  duplicateCount: number
}

const HANGUL = /[ㄱ-ㆎ가-힣]/
const LATIN = /[A-Za-z]/
/** 영어 단어/숙어로 인정하는 문자: 알파벳, 공백, 하이픈, 아포스트로피, 마침표, 괄호, 슬래시 */
const TERM_CHARS = /^[A-Za-z][A-Za-z\s'’\-./()~]*$/
const LEADING_NUMBER = /^\s*(?:\(?\d{1,4}[.)]|\d{1,4}\s|[①-⑳]|[-*•·])\s*/
/** 단어와 뜻을 가르는 구분자 (앞쪽부터 우선) */
const SEPARATORS = ['\t', '|', ' = ', '=', ' : ', ':', ' - ', ' – ', ' — ', ' / ', ',']

function cleanTerm(raw: string): string {
  return raw
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”]+|[\s"'“”.,;]+$/g, '')
    .trim()
}

function cleanMeaning(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/^[\s"'“”\-:=|]+|[\s"'“”]+$/g, '').trim()
}

function isValidTerm(term: string): boolean {
  return term.length > 0 && term.length <= FLASHCARD_TERM_MAX_LENGTH && LATIN.test(term) && TERM_CHARS.test(term)
}

/** 한 줄 → 단어 0개 이상 (null = 해석 불가) */
function parseLine(line: string): ParsedFlashcardEntry[] | null {
  const text = line.replace(LEADING_NUMBER, '').trim()
  if (!text) return []

  // 1) 구분자로 단어 | 뜻 분리
  for (const sep of SEPARATORS) {
    const idx = text.indexOf(sep)
    if (idx <= 0) continue
    const left = cleanTerm(text.slice(0, idx))
    const right = text.slice(idx + sep.length)

    // 쉼표로만 나열된 영어 단어 목록 (뜻 없음)
    if (sep === ',' && !HANGUL.test(right)) {
      const terms = text.split(',').map(cleanTerm).filter(Boolean)
      if (terms.length > 0 && terms.every(isValidTerm)) return terms.map((term) => ({ term, meaning: null }))
      return null
    }

    if (!isValidTerm(left)) continue
    const meaning = cleanMeaning(right)
    return [{ term: left, meaning: meaning ? meaning.slice(0, FLASHCARD_MEANING_MAX_LENGTH) : null }]
  }

  // 2) 구분자 없이 "apple 사과" — 첫 한글 앞까지가 단어
  const hangulIdx = text.search(HANGUL)
  if (hangulIdx > 0) {
    const term = cleanTerm(text.slice(0, hangulIdx))
    if (!isValidTerm(term)) return null
    const meaning = cleanMeaning(text.slice(hangulIdx))
    return [{ term, meaning: meaning.slice(0, FLASHCARD_MEANING_MAX_LENGTH) }]
  }
  if (hangulIdx === 0) return null

  // 3) 단어(숙어)만
  const term = cleanTerm(text)
  return isValidTerm(term) ? [{ term, meaning: null }] : null
}

export function parseFlashcardText(input: string): FlashcardParseResult {
  const entries: ParsedFlashcardEntry[] = []
  const invalidLines: string[] = []
  const seen = new Map<string, number>()
  let duplicateCount = 0

  for (const line of input.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue
    const parsed = parseLine(line)
    if (parsed === null) {
      invalidLines.push(line.trim())
      continue
    }
    for (const entry of parsed) {
      const key = entry.term.toLowerCase()
      const prev = seen.get(key)
      if (prev !== undefined) {
        duplicateCount++
        // 앞에서 뜻 없이 적었고 뒤에서 뜻을 적었으면 뜻을 채운다
        if (!entries[prev].meaning && entry.meaning) entries[prev] = { ...entries[prev], meaning: entry.meaning }
        continue
      }
      seen.set(key, entries.length)
      entries.push(entry)
    }
  }

  return { entries, invalidLines, duplicateCount }
}
