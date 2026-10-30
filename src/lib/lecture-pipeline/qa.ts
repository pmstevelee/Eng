// 발음 검수 — Whisper 받아쓰기와 원문 비교 (한국어는 글자 오류율, 영어는 단어 오류율)
// 그리고 TTS 글자 타임스탬프 → 단어 타임스탬프 변환

import { sinoNumber } from './normalize'
import type { Lang } from './types'
import type { TimedWord } from './timing'

export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * Whisper는 한국어 음성의 "해브", "투부정사"를 영어(have, to부정사)로 받아 적곤 한다.
 * 받아쓰기 쪽 영어 문법 단어를 한글 표기로 되돌린 뒤 비교한다.
 */
const EN_TO_HANGUL: Record<string, string> = {
  have: '해브', has: '해즈', had: '해드', be: '비', been: '빈', being: '빙', do: '두', does: '더즈', did: '디드',
  ever: '에버', never: '네버', just: '저스트', already: '올레디', yet: '옛', since: '신스', for: '포', ago: '어고',
  to: '투', ing: '아이엔지', ed: '이디', pp: '과거분사', will: '윌', can: '캔', the: '더', a: '어', an: '언',
  not: '낫', is: '이즈', are: '아', was: '워즈', were: '워', it: '잇', that: '댓', there: '데어', wegoup: '위고업', english: '잉글리시',
}

function hangulizeTranscript(text: string): string {
  return text
    .replace(/p\.\s?p\.?/gi, '과거분사')
    .replace(/[A-Za-z]+/g, (w) => EN_TO_HANGUL[w.toLowerCase()] ?? '')
}

/** 한국어 비교용 — 숫자는 한자어로 읽고, 한글·영문·숫자 외 글자는 버린다 */
function koChars(text: string): string[] {
  const withNumbers = text.replace(/\d+/g, (d) => sinoNumber(Number(d)))
  return Array.from(withNumbers.toLowerCase().replace(/[^가-힣a-z]/g, ''))
}

const EN_CONTRACTIONS: [RegExp, string][] = [
  [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'re\b/g, '$1 are'], [/\b(\w+)'ll\b/g, '$1 will'],
  [/\b(\w+)'d\b/g, '$1 would'], [/\bcan't\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/\b(\w+)n't\b/g, '$1 not'],
  [/\bi'm\b/g, 'i am'], [/\b(he|she|it|that|what|there)'s\b/g, '$1 is'],
]

function enWords(text: string): string[] {
  let t = text.toLowerCase().replace(/[’‘]/g, "'")
  for (const [re, to] of EN_CONTRACTIONS) t = t.replace(re, to)
  return t.replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean)
}

export interface QaCompare {
  /** 0~1 (0이면 완전히 같음) */
  errorRate: number
  threshold: number
  passed: boolean
  unit: '글자' | '단어'
}

/** 기준 문장(정규화 문장·원문 중 더 가까운 쪽)과 받아쓰기 비교 */
export function compareTranscript(expected: string[], transcript: string, lang: Lang): QaCompare {
  if (lang === 'ko') {
    const got = koChars(hangulizeTranscript(transcript))
    const rates = expected.map((e) => {
      const want = koChars(e)
      return want.length ? levenshtein(want, got) / want.length : got.length ? 1 : 0
    })
    const errorRate = Math.min(...rates)
    const len = koChars(expected[0] ?? '').length
    const threshold = len < 8 ? 0.3 : 0.15
    return { errorRate, threshold, passed: errorRate <= threshold, unit: '글자' }
  }
  const got = enWords(transcript)
  const rates = expected.map((e) => {
    const want = enWords(e)
    if (want.length <= 2) {
      // 짧은 말(단어 1~2개)은 Whisper가 철자를 흔들기 쉬워 글자 단위로 본다
      const a = Array.from(want.join(''))
      const b = Array.from(got.join(''))
      return a.length ? levenshtein(a, b) / a.length : 0
    }
    return levenshtein(want, got) / want.length
  })
  const errorRate = Math.min(...rates)
  const threshold = enWords(expected[0] ?? '').length <= 2 ? 0.34 : 0.2
  return { errorRate, threshold, passed: errorRate <= threshold, unit: enWords(expected[0] ?? '').length <= 2 ? '글자' : '단어' }
}

/** TTS 글자별 시간(초) → 단어별 시간(ms). 공백으로 단어를 나눈다 */
export function alignmentToWords(chars: string[], starts: number[], ends: number[]): TimedWord[] {
  const words: TimedWord[] = []
  let cur: TimedWord | null = null
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur)
      cur = null
      return
    }
    const s = Math.round((starts[i] ?? 0) * 1000)
    const e = Math.round((ends[i] ?? starts[i] ?? 0) * 1000)
    if (!cur) cur = { text: ch, startMs: s, endMs: e }
    else {
      cur.text += ch
      cur.endMs = e
    }
  })
  if (cur) words.push(cur)
  return words
}

/** 단어 시간을 앞 무음을 잘라 낸 만큼 당기고, 잘린 길이 안으로 맞춘다 */
export function shiftWords(words: TimedWord[], offsetMs: number, durationMs: number): TimedWord[] {
  return words.map((w) => ({
    text: w.text,
    startMs: Math.max(0, Math.min(durationMs, w.startMs - offsetMs)),
    endMs: Math.max(0, Math.min(durationMs, w.endMs - offsetMs)),
  }))
}
