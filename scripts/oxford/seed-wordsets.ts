/**
 * Oxford 단어로 CEFR 레벨별 공용 WordSet을 자동 생성한다.
 *
 * - meaning이 채워진 단어만 사용 (플래시카드/리콜/스펠 모두 뜻 필요)
 * - CEFR(A1~C1)별로 SET_SIZE개씩 묶어 공용 세트(isPublic=true, academyId=null) 생성
 * - 멱등성: 같은 title의 세트가 이미 있으면 스킵
 *
 * 실행: npm run oxford:seed:sets [-- --setsPerLevel=3 --size=20]
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '@/lib/prisma/client'
import { OxfordCefr, WordSetSource } from '@/generated/prisma'

const args = process.argv.slice(2)
function argVal(name: string, def: number): number {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  if (!a) return def
  const v = Number(a.split('=')[1])
  return Number.isFinite(v) && v > 0 ? v : def
}

const SET_SIZE = argVal('size', 20)
const SETS_PER_LEVEL = argVal('setsPerLevel', 3)

const CEFR_ORDER: OxfordCefr[] = [
  OxfordCefr.A1,
  OxfordCefr.A2,
  OxfordCefr.B1,
  OxfordCefr.B2,
  OxfordCefr.C1,
]

const CEFR_LABEL: Record<OxfordCefr, string> = {
  A1: 'A1 기초',
  A2: 'A2 초급',
  B1: 'B1 중급',
  B2: 'B2 중상급',
  C1: 'C1 고급',
}

function sourceForCefr(cefr: OxfordCefr): WordSetSource {
  return cefr === 'B2' || cefr === 'C1'
    ? WordSetSource.OXFORD_5000
    : WordSetSource.OXFORD_3000
}

async function main() {
  console.log(`▶ WordSet 자동 생성 시작 (레벨당 ${SETS_PER_LEVEL}세트 × ${SET_SIZE}단어)\n`)
  let createdSets = 0
  let createdItems = 0
  let skipped = 0

  for (const cefr of CEFR_ORDER) {
    const words = await prisma.word.findMany({
      where: { oxfordCefr: cefr, meaning: { not: null } },
      select: { id: true, cefrLevel: true, term: true },
      orderBy: { term: 'asc' },
      take: SET_SIZE * SETS_PER_LEVEL,
    })

    if (words.length === 0) {
      console.log(`  ${cefr}: meaning 있는 단어 없음 — 스킵`)
      continue
    }

    const cefrLevel = words[0].cefrLevel

    for (let i = 0; i < SETS_PER_LEVEL; i++) {
      const chunk = words.slice(i * SET_SIZE, (i + 1) * SET_SIZE)
      if (chunk.length === 0) break

      const title = `Oxford ${CEFR_LABEL[cefr]} 단어 ${i + 1}`

      const existing = await prisma.wordSet.findFirst({
        where: { title, isPublic: true },
        select: { id: true },
      })
      if (existing) {
        skipped++
        console.log(`  ⏭  "${title}" 이미 존재 — 스킵`)
        continue
      }

      const set = await prisma.wordSet.create({
        data: {
          title,
          description: `${CEFR_LABEL[cefr]} 수준 핵심 어휘 ${chunk.length}개`,
          cefrLevel,
          isPublic: true,
          academyId: null,
          source: sourceForCefr(cefr),
        },
        select: { id: true },
      })

      await prisma.wordSetItem.createMany({
        data: chunk.map((w, idx) => ({
          setId: set.id,
          wordId: w.id,
          order: idx,
        })),
      })

      createdSets++
      createdItems += chunk.length
      console.log(`  ✅ "${title}" (${chunk.length}단어, cefrLevel ${cefrLevel})`)
    }
  }

  console.log(
    `\n완료 — 신규 세트: ${createdSets}, 항목: ${createdItems}, 스킵: ${skipped}`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
