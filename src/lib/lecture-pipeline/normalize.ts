// TTS 전 텍스트 정규화 — 발음 사전(lectures/pronunciation-dict.json) + 숫자·기호 규칙
// 화면·자막에는 원문을 쓰고, 음성에만 정규화한 문장을 보낸다.

import type { Lang } from './types'

export interface PronunciationDict {
  ko: Record<string, string>
  en: Record<string, string>
}

const LATIN = /[A-Za-z]/
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface CompiledEntry { re: RegExp; to: string }

/** 긴 말부터 바꾸도록 정렬하고, 영문으로 시작·끝나는 말은 다른 영단어 안에서 바뀌지 않게 경계를 둔다 */
export function compileDict(entries: Record<string, string>): CompiledEntry[] {
  return Object.entries(entries)
    .filter(([from]) => from && !from.startsWith('_'))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([from, to]) => {
      const head = LATIN.test(from[0]) ? '(?<![A-Za-z])' : ''
      const tail = LATIN.test(from[from.length - 1]) ? '(?![A-Za-z])' : ''
      // 한 글자 약어(O, X, S)는 대소문자를 구분하고, 긴 영문 말은 대소문자를 가리지 않는다
      const flags = from.replace(/[^A-Za-z]/g, '').length > 2 ? 'gi' : 'g'
      return { re: new RegExp(`${head}${escapeRe(from)}${tail}`, flags), to }
    })
}

// ── 문장 공식 S+V+O ───────────────────────────────────────

const FORMULA_RE = /(?<![A-Za-z])[SVOC](?:\s*\+\s*[SVOC])+(?![A-Za-z])/g
const FORMULA_WORD: Record<string, string> = { S: '주어', V: '동사', O: '목적어', C: '보어' }

function readFormula(text: string): string {
  return text.replace(FORMULA_RE, (m) => m.split('+').map((p) => FORMULA_WORD[p.trim()] ?? p).join(', '))
}

// ── 숫자 ──────────────────────────────────────────────────

const SINO_DIGIT = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']

/** 한자어 수 (0 ~ 9999만) — 일, 십이, 백오, 삼천 */
export function sinoNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n)
  if (n === 0) return '영'
  const units: [number, string][] = [[10000, '만'], [1000, '천'], [100, '백'], [10, '십']]
  let out = ''
  let rest = Math.floor(n)
  for (const [value, name] of units) {
    const q = Math.floor(rest / value)
    if (q > 0) {
      out += value === 10000 ? sinoNumber(q) + name : (q === 1 ? '' : SINO_DIGIT[q]) + name
      rest %= value
    }
  }
  return out + SINO_DIGIT[rest]
}

const NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔']

/** 고유어 수 + 단위 앞 형태 (1~99) — 한, 두, 세, 스무, 서른두. 100 이상은 한자어 */
export function nativeNumber(n: number): string {
  if (n < 1 || n > 99) return sinoNumber(n)
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (n === 20) return '스무'
  return NATIVE_TENS[tens] + NATIVE_ONES[ones]
}

/** 고유어로 읽는 단위 */
const NATIVE_COUNTERS = ['가지', '개', '명', '살', '마리', '권', '잔', '문장', '단어', '시간', '군데', '번째', '번']
/** 한자어로 읽는 단위 */
const SINO_COUNTERS = ['인칭', '형식', '단계', '레벨', '단원', '강', '과', '장', '쪽', '페이지', '분', '초', '년', '월', '일', '점', '퍼센트', '%', '등', '학년', '층', '호']

function readNumbers(text: string): string {
  // 1번째 → 첫 번째 (고유어 서수)
  let out = text.replace(/(?<!\d)(\d{1,2})\s?번째/g, (_, d: string) => (Number(d) === 1 ? '첫 번째' : `${nativeNumber(Number(d))} 번째`))
  // 1번 문제·3번 보기 → 일 번 (번호)
  out = out.replace(/(?<!\d)(\d+)\s?번(?=\s?(?:문제|문항|보기|예문|답|선택지))/g, (_, d: string) => `${sinoNumber(Number(d))} 번`)
  const counter = (list: string[]) => list.map(escapeRe).join('|')
  out = out.replace(new RegExp(`(?<![\\d.])(\\d{1,2})\\s?(${counter(NATIVE_COUNTERS)})`, 'g'), (_, d: string, c: string) => `${nativeNumber(Number(d))} ${c}`)
  out = out.replace(new RegExp(`(?<![\\d.])(\\d+)\\s?(${counter(SINO_COUNTERS)})`, 'g'), (_, d: string, c: string) =>
    c === '%' ? `${sinoNumber(Number(d))} 퍼센트` : `${sinoNumber(Number(d))}${c === '인칭' || c === '형식' ? '' : ' '}${c}`,
  )
  // 남은 정수는 한자어로
  out = out.replace(/(?<![\d.])\d{1,7}(?![\d.])/g, (d) => sinoNumber(Number(d)))
  return out
}

// ── 기호 ──────────────────────────────────────────────────

function readSymbols(text: string, lang: Lang): string {
  let out = text
  out = out.replace(/_{2,}|＿+/g, lang === 'ko' ? ' 빈칸 ' : ' blank ')
  out = out.replace(/[→⇒➜➔]/g, lang === 'ko' ? ', ' : ', then ')
  if (lang === 'ko') {
    out = out.replace(/\s*\+\s*/g, ', ')
    out = out.replace(/(?<=[가-힣])\s*\/\s*(?=[가-힣])/g, ' 또는 ')
    out = out.replace(/\s*\/\s*/g, ', ')
    out = out.replace(/\s*=\s*/g, ', 즉 ')
    out = out.replace(/&/g, ' 그리고 ')
    out = out.replace(/[~∼〜]/g, ' ')
    out = out.replace(/[·•ㆍ]/g, ', ')
  } else {
    out = out.replace(/\s*\/\s*/g, ' or ')
    out = out.replace(/&/g, ' and ')
    out = out.replace(/[~∼]/g, ' ')
  }
  // 괄호: 안의 말은 살리고 쉼표로 감싼다
  out = out.replace(/\s*[([{【「『]\s*/g, ', ').replace(/\s*[)\]}】」』]\s*/g, ', ')
  // 따옴표·강조 기호는 읽지 않는다
  out = out.replace(/["“”‘’'`*#]/g, (m) => (lang === 'en' && (m === "'" || m === '’') ? "'" : ''))
  out = out.replace(/…|\.{3}/g, ', ')
  out = out.replace(/\s*:\s*/g, ', ')
  return out
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?])\s*,/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .replace(/,\s*(?=[.!?])/g, '')
    .replace(/([,.!?])(?=[^\s,.!?])/g, '$1 ')
    .trim()
}

export function compileNormalizer(dict: PronunciationDict) {
  const ko = compileDict(dict.ko ?? {})
  const en = compileDict(dict.en ?? {})
  return function normalizeForTts(text: string, lang: Lang): string {
    let out = text
    if (lang === 'ko') out = readFormula(out)
    for (const e of lang === 'ko' ? ko : en) out = out.replace(e.re, e.to)
    if (lang === 'ko') out = readNumbers(out)
    out = readSymbols(out, lang)
    return tidy(out)
  }
}

/** 사전 말·S+V+O 공식 위치를 같은 길이의 한글로 가린다 — 영어 분리(mixed.ts)가 사전 말을 영어로 보지 않게 */
export function maskDictTerms(text: string, dict: PronunciationDict): string {
  let out = text.replace(FORMULA_RE, (m) => '가'.repeat(m.length))
  for (const e of compileDict(dict.ko ?? {})) out = out.replace(e.re, (m) => '가'.repeat(m.length))
  return out
}
