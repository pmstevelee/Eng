/**
 * example이 비어 있는 Word에 예문만 새로 채운다.
 * (예: 사용자 제공 파일로 새로 등록된 단어는 뜻/정의는 파일 원본을 쓰지만 예문이 없음 —
 *  기존 Oxford 단어들과 필드 구성을 동일하게 맞추기 위해 예문만 별도로 생성한다.)
 *
 * meaning/definition은 절대 덮어쓰지 않는다.
 *
 * 실행: npm run words:backfill-examples [-- --dry-run] [-- --source=PUBLISHER]
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '@/lib/prisma/client'
import { generateExampleOnly } from '@/lib/openai/word-enrichment'

async function loadDeps() {
  const [{ default: pLimit }, cliProgress] = await Promise.all([
    import('p-limit'),
    // @ts-expect-error cli-progress has no bundled types
    import('cli-progress') as Promise<any>,
  ])
  const { MultiBar, Presets } = cliProgress
  return { pLimit, MultiBar, Presets }
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    source: args.find((a) => a.startsWith('--source='))?.split('=')[1],
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw new Error('unreachable')
}

async function main() {
  const { dryRun, source } = parseArgs()
  const { pLimit, MultiBar, Presets } = await loadDeps()

  const words = await prisma.word.findMany({
    where: {
      example: null,
      meaning: { not: null },
      ...(source ? { source: source as 'PUBLISHER' | 'TEACHER' | 'AI_GENERATED' | 'OXFORD_3000' | 'OXFORD_5000' } : {}),
    },
    select: { id: true, term: true, partOfSpeech: true, meaning: true },
  })

  console.log(`▶ 예문 채우기 대상: ${words.length}개${dryRun ? ' [dry-run]' : ''}\n`)
  if (words.length === 0) {
    await prisma.$disconnect()
    return
  }

  let succeeded = 0
  let failed = 0
  let totalTokens = 0
  const failedWords: { term: string; error: string }[] = []

  const multibar = new MultiBar(
    { clearOnComplete: false, hideCursor: true, format: ' {bar} {percentage}% | {value}/{total} | {label}' },
    Presets.shades_grey,
  )
  const bar = multibar.create(words.length, 0, { label: '처리 중' })
  const limit = pLimit(10)

  await Promise.all(
    words.map((w) =>
      limit(async () => {
        try {
          const result = await withRetry(() =>
            generateExampleOnly({ term: w.term, partOfSpeech: w.partOfSpeech, meaning: w.meaning! }),
          )
          totalTokens += result.tokensUsed
          if (!dryRun) {
            await prisma.word.update({ where: { id: w.id }, data: { example: result.example } })
          }
          succeeded++
        } catch (err) {
          failed++
          failedWords.push({ term: w.term, error: err instanceof Error ? err.message : String(err) })
        }
        bar.increment({ label: w.term })
      }),
    ),
  )

  multibar.stop()

  const estimatedCost = (totalTokens / 1000) * 0.00015

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  완료 통계')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  성공:      ${succeeded}`)
  console.log(`  실패:      ${failed}`)
  console.log(`  총 토큰:   ${totalTokens.toLocaleString()}`)
  console.log(`  비용 추정: $${estimatedCost.toFixed(4)}`)
  if (failedWords.length > 0) {
    console.log('\n  실패 목록 (상위 10개):')
    failedWords.slice(0, 10).forEach((f) => console.log(`    - ${f.term}: ${f.error}`))
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (dryRun) console.log('※ dry-run 완료 — DB에 저장되지 않았습니다.\n')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
