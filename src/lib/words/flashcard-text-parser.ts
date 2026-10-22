// 업로드한 단어 텍스트 → 단어 목록 (서버·클라이언트 공용, 순수 함수)
//
// 한 줄에 한 단어가 기본이며 아래 형식을 모두 받는다.
//   apple                    → 단어만 (뜻은 AI가 채움)
//   apple 사과 / apple - 사과 / apple: 사과 / apple = 사과 / apple<TAB>사과 / apple, 사과 / apple (사과)
//   1. apple 사과 / ① apple   → 앞 번호는 무시
//   apple, banana, cherry     → 뜻 없이 쉼표로 나열하면 여러 단어
//   look forward to 기대하다  → 숙어도 한 단어로 취급
//   café, naïve, MP3, COVID-19, 24/7 → 악센트·숫자가 들어간 단어도 인정

export const FLASHCARD_MAX_WORDS = 100
export const FLASHCARD_TERM_MAX_LENGTH = 60
export const FLASHCARD_MEANING_MAX_LENGTH = 100

export type ParsedFlashcardEntry = {
  term: string
  /** 사용자가 적은 한글 뜻 (없으면 AI가 생성) */
  meaning: string | null
}

export type InvalidFlashcardLine = {
  line: string
  /** 사용자에게 보여줄 제외 사유 */
  reason: string
}

export type FlashcardParseResult = {
  entries: ParsedFlashcardEntry[]
  /** 단어로 만들 수 없는 줄 (원문 + 사유) */
  invalidLines: InvalidFlashcardLine[]
  /** 이미 위에 있던 단어라 건너뛴 단어 */
  duplicateTerms: string[]
}

const HANGUL = /[ㄱ-ㆎ가-힣]/
/** 라틴 문자(악센트 포함) 또는 숫자 — 단어로 인정하려면 하나 이상 있어야 한다 */
const WORD_CHAR = /[A-Za-z0-9À-ɏ]/
/** 단어/숙어로 인정하는 문자: 알파벳(악센트 포함)·숫자·공백·하이픈·아포스트로피·마침표·괄호·슬래시·물결·&·+ */
const TERM_CHARS = /^[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ\s'’\-./()~&+]*$/
const LEADING_NUMBER = /^\s*(?:\(?\d{1,4}[.)](?!\d)|\d{1,4}\s|[①-⑳]|[-*•·])\s*/
/** 단어와 뜻을 가르는 구분자 (앞쪽부터 우선) */
const SEPARATORS = ['\t', '|', ' = ', '=', ' : ', ':', ' - ', ' – ', ' — ', ' / ', ',']
/** 끝 마침표를 지우지 않는 약어 */
const ABBREVIATION_END = /(?:^|[\s.])[A-Za-z]\.$|\b(?:Mr|Mrs|Ms|Dr|St|etc|vs)\.$/i

function cleanTerm(raw: string): string {
  let term = raw
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”]+/, '')
    .replace(/[\s"'“”,;:~\-–—=|]+$/, '')
    .trim()
  // 짝이 안 맞는 괄호 정리: "apple (사과)" → "apple"
  const open = term.match(/\(/g)?.length ?? 0
  const close = term.match(/\)/g)?.length ?? 0
  if (open !== close) term = term.replace(/[()]/g, '').trim()
  // 끝의 마침표는 약어(e.g., Mr.)가 아니면 제거
  if (term.endsWith('.') && !ABBREVIATION_END.test(term)) term = term.slice(0, -1).trim()
  return term
}

function cleanMeaning(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”\-:=|(]+/, '')
    .replace(/[\s"'“”)]+$/, '')
    .trim()
}

function isValidTerm(term: string): boolean {
  return term.length > 0 && term.length <= FLASHCARD_TERM_MAX_LENGTH && WORD_CHAR.test(term) && TERM_CHARS.test(term)
}

/** 단어로 만들 수 없는 줄의 사유 */
function invalidReason(text: string): string {
  const t = text.trim()
  if (HANGUL.test(t.charAt(0))) return '한글로 시작합니다. 영어 단어를 먼저 쓰고 뜻을 뒤에 적어주세요.'
  if (!WORD_CHAR.test(t)) return '영어 단어를 찾지 못했습니다.'
  const head = t.split(HANGUL)[0] ?? t
  if (cleanTerm(head).length > FLASHCARD_TERM_MAX_LENGTH) {
    return `단어가 너무 깁니다 (최대 ${FLASHCARD_TERM_MAX_LENGTH}자). 문장 대신 단어·숙어만 적어주세요.`
  }
  return '단어에 쓸 수 없는 기호가 있습니다 (예: ! ? @ # 등).'
}

/** 한 줄 → 단어 0개 이상 (null = 해석 불가) */
function parseLine(text: string): ParsedFlashcardEntry[] | null {
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

  // 2) 구분자 없이 "apple 사과" / "apple (사과)" — 첫 한글 앞까지가 단어
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
  const invalidLines: InvalidFlashcardLine[] = []
  const duplicateTerms: string[] = []
  const seen = new Map<string, number>()

  for (const line of input.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue
    const text = line.replace(LEADING_NUMBER, '').trim()
    const parsed = parseLine(text)
    if (parsed === null) {
      invalidLines.push({ line: line.trim(), reason: invalidReason(text) })
      continue
    }
    for (const entry of parsed) {
      const key = entry.term.toLowerCase()
      const prev = seen.get(key)
      if (prev !== undefined) {
        duplicateTerms.push(entry.term)
        // 앞에서 뜻 없이 적었고 뒤에서 뜻을 적었으면 뜻을 채운다
        if (!entries[prev].meaning && entry.meaning) entries[prev] = { ...entries[prev], meaning: entry.meaning }
        continue
      }
      seen.set(key, entries.length)
      entries.push(entry)
    }
  }

  return { entries, invalidLines, duplicateTerms }
}
