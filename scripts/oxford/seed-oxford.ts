import * as dotenv from 'dotenv'
import path from 'path'

// Next.js처럼 .env → .env.local 순서로 로드 (.env.local이 덮어씀)
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
import fs from 'fs'
import { PrismaClient } from '../../src/generated/prisma'
import { mapOxfordCefrToWegoupLevel } from '../../src/lib/words/cefr-mapping'
import { enrichWord } from '../../src/lib/openai/word-enrichment'

// p-limit, cli-progress는 동적 import (ESM 전용 패키지)
async function loadDeps() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ default: pLimit }, cliProgress] = await Promise.all([
    import('p-limit'),
    // @ts-expect-error cli-progress has no bundled types; install @types/cli-progress if needed
    import('cli-progress') as Promise<any>,
  ])
  const { MultiBar, Presets } = cliProgress
  return { pLimit, MultiBar, Presets }
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

type OxfordWord = {
  term: string
  partOfSpeech: string
  cefrLevel: string        // A1 | A2 | B1 | B2 | C1
  source: string           // OXFORD_3000 | OXFORD_5000
  contextNote?: string
  homonymIndex?: number
}

type Stats = {
  created: number
  updated: number
  skipped: number
  failed: number
  totalTokens: number
  cefrDist: Record<string, number>
  failedWords: { term: string; pos: string; error: string }[]
}

// ── 인수 파싱 ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    retryFailed: args.includes('--retry-failed'),
    filter: args.find((a) => a.startsWith('--filter='))?.split('=')[1] ?? null,
  }
}

// ── 재시도 헬퍼 ───────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      const delay = 1000 * 2 ** (attempt - 1) // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, force, retryFailed, filter } = parseArgs()
  const { pLimit, MultiBar, Presets } = await loadDeps()

  const prisma = new PrismaClient()

  const dataPath = path.join(__dirname, 'data', 'oxford-words.json')
  const allWords: OxfordWord[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  // 필터 적용
  let words = filter ? allWords.filter((w) => w.cefrLevel === filter) : allWords

  // --retry-failed: meaning이 없는 것만 대상
  if (retryFailed) {
    const existing = await prisma.word.findMany({
      where: { meaning: null, source: { in: ['OXFORD_3000', 'OXFORD_5000'] } },
      select: { term: true, partOfSpeech: true, homonymIndex: true },
    })
    const failedSet = new Set(existing.map((w) => `${w.term}::${w.partOfSpeech}::${w.homonymIndex ?? ''}` ))
    words = words.filter((w) =>
      failedSet.has(`${w.term}::${w.partOfSpeech}::${w.homonymIndex ?? ''}`),
    )
    console.log(`\n--retry-failed: meaning 없는 단어 ${words.length}개 재시도`)
  }

  // --dry-run: 처음 5개만
  if (dryRun) {
    words = words.slice(0, 5)
    console.log('\n[DRY-RUN] 처음 5개 미리보기:\n')
  }

  console.log(`대상 단어: ${words.length}개${filter ? ` (CEFR: ${filter})` : ''}`)

  const stats: Stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    totalTokens: 0,
    cefrDist: {},
    failedWords: [],
  }

  const multibar = new MultiBar(
    { clearOnComplete: false, hideCursor: true, format: ' {bar} {percentage}% | {value}/{total} | {label}' },
    Presets.shades_grey,
  )
  const bar = multibar.create(words.length, 0, { label: '처리 중' })

  const limit = pLimit(10)

  const tasks = words.map((word) =>
    limit(async () => {
      const cefr = word.cefrLevel
      stats.cefrDist[cefr] = (stats.cefrDist[cefr] ?? 0) + 1

      try {
        // --force가 아니면 meaning 있는 것 스킵
        if (!force) {
          const existing = await prisma.word.findFirst({
            where: {
              term: word.term,
              partOfSpeech: word.partOfSpeech,
              homonymIndex: word.homonymIndex ?? null,
            },
            select: { meaning: true },
          })
          if (existing?.meaning) {
            stats.skipped++
            bar.increment({ label: `스킵: ${word.term}` })
            return
          }
        }

        const enriched = await withRetry(() =>
          enrichWord({
            term: word.term,
            partOfSpeech: word.partOfSpeech,
            oxfordCefr: word.cefrLevel,
            contextNote: word.contextNote,
            homonymIndex: word.homonymIndex,
          }),
        )
        stats.totalTokens += enriched.tokensUsed

        if (dryRun) {
          console.log(`\n▶ ${word.term} (${word.partOfSpeech}, ${word.cefrLevel})`)
          if (word.contextNote) console.log(`  contextNote: ${word.contextNote}`)
          console.log(`  meaning:    ${enriched.meaning}`)
          console.log(`  definition: ${enriched.definition}`)
          console.log(`  example:    ${enriched.example}`)
          stats.created++
          bar.increment({ label: word.term })
          return
        }

        const cefrLevel = mapOxfordCefrToWegoupLevel(word.cefrLevel)
        const source = (word.source === 'OXFORD_5000' ? 'OXFORD_5000' : 'OXFORD_3000') as
          | 'OXFORD_3000'
          | 'OXFORD_5000'

        const existing = await prisma.word.findFirst({
          where: {
            term: word.term,
            partOfSpeech: word.partOfSpeech,
            homonymIndex: word.homonymIndex ?? null,
          },
          select: { id: true },
        })

        if (existing) {
          await prisma.word.update({
            where: { id: existing.id },
            data: {
              meaning: enriched.meaning,
              definition: enriched.definition,
              example: enriched.example,
              cefrLevel,
              oxfordCefr: word.cefrLevel as 'A1' | 'A2' | 'B1' | 'B2' | 'C1',
              source,
              contextNote: word.contextNote ?? null,
            },
          })
          stats.updated++
        } else {
          await prisma.word.create({
            data: {
              term: word.term,
              partOfSpeech: word.partOfSpeech,
              cefrLevel,
              oxfordCefr: word.cefrLevel as 'A1' | 'A2' | 'B1' | 'B2' | 'C1',
              source,
              contextNote: word.contextNote ?? null,
              homonymIndex: word.homonymIndex ?? null,
              meaning: enriched.meaning,
              definition: enriched.definition,
              example: enriched.example,
            },
          })
          stats.created++
        }
      } catch (err) {
        stats.failed++
        stats.failedWords.push({
          term: word.term,
          pos: word.partOfSpeech,
          error: err instanceof Error ? err.message : String(err),
        })
      }

      bar.increment({ label: word.term })
    }),
  )

  await Promise.all(tasks)
  multibar.stop()

  // ── 완료 통계 ────────────────────────────────────────────────────────────────
  const costPer1kTokens = 0.00015 // gpt-4o-mini input ~$0.15/1M → $0.00015/1k
  const estimatedCost = (stats.totalTokens / 1000) * costPer1kTokens

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  완료 통계')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  신규 생성: ${stats.created}`)
  console.log(`  업데이트:  ${stats.updated}`)
  console.log(`  스킵:      ${stats.skipped}`)
  console.log(`  실패:      ${stats.failed}`)
  console.log(`  총 토큰:   ${stats.totalTokens.toLocaleString()}`)
  console.log(`  비용 추정: $${estimatedCost.toFixed(4)}`)
  console.log('\n  CEFR 분포:')
  for (const [cefr, count] of Object.entries(stats.cefrDist).sort()) {
    console.log(`    ${cefr}: ${count}개`)
  }

  if (stats.failedWords.length > 0) {
    console.log('\n  실패 목록 (상위 10개):')
    stats.failedWords.slice(0, 10).forEach((f) => {
      console.log(`    - ${f.term} (${f.pos}): ${f.error}`)
    })
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (dryRun) {
    console.log('※ dry-run 완료 — DB에 저장되지 않았습니다.\n')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
