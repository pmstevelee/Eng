import * as fs from 'fs'
import * as path from 'path'

// pdf-parse v2 uses browser-only globals — polyfill before requiring
type AnyObj = Record<string, unknown>
const g = global as unknown as AnyObj
if (!g['DOMMatrix']) {
  g['DOMMatrix'] = class {
    constructor() {
      return new Proxy({}, { get: () => () => new (g['DOMMatrix'] as new () => object)() })
    }
  }
}
if (!g['ImageData']) g['ImageData'] = class {}
if (!g['Path2D']) g['Path2D'] = class {}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

// ─── 타입 ────────────────────────────────────────────────────────────────────

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type SourceType = 'OXFORD_3000' | 'OXFORD_5000'

interface OxfordWord {
  term: string
  partOfSpeech: string
  cefrLevel: CefrLevel
  contextNote?: string
  homonymIndex?: number
  source: SourceType
}

// ─── 경로 ─────────────────────────────────────────────────────────────────────

const RAW_DIR = path.join(process.cwd(), 'scripts/oxford/raw')
const DATA_DIR = path.join(process.cwd(), 'scripts/oxford/data')

// ─── 정제 헬퍼 ───────────────────────────────────────────────────────────────

/** 제거할 헤더/푸터 패턴 */
const SKIP_PATTERNS = [
  /^©\s*Oxford University Press/i,
  /^The Oxford (3000|5000)[™™]?\s+by CEFR level/i,
  /^\d+\s*\/\s*\d+$/,          // "1 / 12" 페이지 표시
  /^\d+$/,                      // 단독 페이지 번호
  /^Oxford 3000/i,
  /^Oxford 5000/i,
]

function shouldSkip(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  return SKIP_PATTERNS.some((re) => re.test(trimmed))
}

/** CEFR 헤더 단독 라인 */
const CEFR_RE = /^(A1|A2|B1|B2|C1)$/

/**
 * 단어 라인 파싱
 * 패턴: TERM[HOMONYM_IDX][ (CONTEXT_NOTE)] POS[, POS...]
 *   - TERM: 소문자(공백/하이픈/어포스트로피 허용), 대문자 약어 허용
 *   - HOMONYM_IDX: 숫자 바로 뒤에 붙음 (예: can1)
 *   - CONTEXT_NOTE: 괄호 안 설명 (예: (money))
 *   - POS: word. 또는 word word. 패턴, 콤마로 다중 허용
 */
const WORD_RE =
  /^([A-Za-z][A-Za-z0-9 '’-]*)(\d+)?(?:\s*\(([^)]+)\))?\s+([a-z]+(?:\s+[a-z]+)*\.(?:,\s*[a-z]+(?:\s+[a-z]+)*\.)*)$/

function parseLine(
  line: string,
  cefrLevel: CefrLevel,
  source: SourceType
): OxfordWord[] | null {
  const trimmed = line.trim()
  const m = WORD_RE.exec(trimmed)
  if (!m) return null

  const term = m[1].trim().toLowerCase()
  const homonymIndex = m[2] ? parseInt(m[2], 10) : undefined
  const contextNote = m[3]?.trim() || undefined
  const posStr = m[4]

  // 다중 품사 분리: "prep., adv." → ["prep", "adv"]
  const posList = posStr
    .split(',')
    .map((p) => p.trim().replace(/\.$/, '').trim())
    .filter(Boolean)

  return posList.map((pos) => ({
    term,
    partOfSpeech: pos,
    cefrLevel,
    contextNote,
    homonymIndex,
    source,
  }))
}

// ─── PDF 파싱 ─────────────────────────────────────────────────────────────────

async function parsePdf(
  pdfPath: string,
  source: SourceType
): Promise<{ words: OxfordWord[]; unparsed: string[] }> {
  const buffer = fs.readFileSync(pdfPath)
  const data = await pdfParse(buffer)
  const rawLines: string[] = data.text.split('\n')

  // 1단계: 헤더/푸터 제거 및 공백 정규화
  const cleaned: string[] = []
  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!shouldSkip(trimmed)) {
      cleaned.push(trimmed)
    }
  }

  // 2단계: 줄 끝 콤마 → 다음 줄과 합치기
  const joined: string[] = []
  let carry = ''
  for (const line of cleaned) {
    if (carry) {
      carry = carry + ' ' + line
    } else {
      carry = line
    }
    if (!carry.endsWith(',')) {
      joined.push(carry)
      carry = ''
    }
  }
  if (carry) joined.push(carry)

  // 3단계: CEFR 헤더 → 단어 파싱
  const words: OxfordWord[] = []
  const unparsed: string[] = []
  let currentLevel: CefrLevel | null = null

  for (const line of joined) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cefrMatch = CEFR_RE.exec(trimmed)
    if (cefrMatch) {
      currentLevel = cefrMatch[1] as CefrLevel
      continue
    }

    if (!currentLevel) {
      // CEFR 헤더 이전 라인(표지 등)은 무시
      continue
    }

    const entries = parseLine(trimmed, currentLevel, source)
    if (entries) {
      words.push(...entries)
    } else {
      unparsed.push(trimmed)
    }
  }

  return { words, unparsed }
}

// ─── 중복 제거 (5000 우선) ────────────────────────────────────────────────────

function mergeWords(
  words3000: OxfordWord[],
  words5000: OxfordWord[]
): OxfordWord[] {
  // key: term|partOfSpeech|homonymIndex
  const map = new Map<string, OxfordWord>()

  const makeKey = (w: OxfordWord) =>
    `${w.term}|${w.partOfSpeech}|${w.homonymIndex ?? ''}`

  // 3000 먼저 삽입
  for (const w of words3000) {
    map.set(makeKey(w), w)
  }
  // 5000이 덮어씀 (우선순위 높음)
  for (const w of words5000) {
    map.set(makeKey(w), w)
  }

  return [...map.values()]
}

// ─── 통계 출력 ────────────────────────────────────────────────────────────────

function printStats(
  label: string,
  words: OxfordWord[]
): void {
  const byLevel: Record<string, number> = {}
  for (const w of words) {
    byLevel[w.cefrLevel] = (byLevel[w.cefrLevel] ?? 0) + 1
  }
  console.log(`\n[${label}] 총 ${words.length}개 레코드`)
  for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1'] as CefrLevel[]) {
    console.log(`  ${lvl}: ${byLevel[lvl] ?? 0}`)
  }
}

function printMergedStats(words: OxfordWord[]): void {
  const byLevel: Record<string, number> = {}
  let homonyms = 0
  let withNote = 0
  for (const w of words) {
    byLevel[w.cefrLevel] = (byLevel[w.cefrLevel] ?? 0) + 1
    if (w.homonymIndex !== undefined) homonyms++
    if (w.contextNote) withNote++
  }
  console.log('\n── 통합 결과 ──────────────────────────')
  console.log(`총 레코드 (중복 제거): ${words.length}`)
  for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1'] as CefrLevel[]) {
    console.log(`  ${lvl}: ${byLevel[lvl] ?? 0}`)
  }
  console.log(`동음이의어 (homonymIndex 있음): ${homonyms}`)
  console.log(`contextNote 보유: ${withNote}`)
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true })

  const pdf3000 = path.join(RAW_DIR, 'oxford-3000.pdf')
  const pdf5000 = path.join(RAW_DIR, 'oxford-5000.pdf')

  for (const p of [pdf3000, pdf5000]) {
    if (!fs.existsSync(p)) {
      console.error(`✗ PDF 없음: ${p}\n  먼저 npm run oxford:download 실행`)
      process.exit(1)
    }
  }

  console.log('Oxford 3000 파싱 중...')
  const { words: words3000, unparsed: up3000 } = await parsePdf(pdf3000, 'OXFORD_3000')
  printStats('Oxford 3000', words3000)
  console.log(`  미파싱 라인: ${up3000.length}`)

  console.log('\nOxford 5000 파싱 중...')
  const { words: words5000, unparsed: up5000 } = await parsePdf(pdf5000, 'OXFORD_5000')
  printStats('Oxford 5000', words5000)
  console.log(`  미파싱 라인: ${up5000.length}`)

  const merged = mergeWords(words3000, words5000)
  printMergedStats(merged)

  // JSON 저장
  const outJson = path.join(DATA_DIR, 'oxford-words.json')
  fs.writeFileSync(outJson, JSON.stringify(merged, null, 2), 'utf-8')
  console.log(`\n✓ JSON 저장: ${outJson}`)

  // 미파싱 라인 저장
  const allUnparsed = [
    '=== Oxford 3000 unparsed ===',
    ...up3000,
    '',
    '=== Oxford 5000 unparsed ===',
    ...up5000,
  ]
  const outUnparsed = path.join(DATA_DIR, 'unparsed.txt')
  fs.writeFileSync(outUnparsed, allUnparsed.join('\n'), 'utf-8')
  console.log(`✓ 미파싱 저장: ${outUnparsed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
