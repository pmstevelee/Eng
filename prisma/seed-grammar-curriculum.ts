/**
 * prisma/seed-grammar-curriculum.ts
 * 본사 문법 커리큘럼(대분류 → 중분류 → 포인트) + 선수 관계 + 기본 코스 6종 시드
 *
 * 실행: npm run seed:grammar-curriculum            (DB 반영)
 *       npm run seed:grammar-curriculum -- --dry-run (검증만, DB 변경 없음)
 *
 * - 데이터: prisma/data/grammar-curriculum.json
 * - code 기준 upsert라 여러 번 실행해도 안전하다.
 * - 이미 있는 포인트는 제목·레벨·순서·소속만 맞추고, 내용(summary/규칙/예문)과 status는 건드리지 않는다.
 * - JSON에서 빠진 기존 항목은 지우지 않고 경고만 출력한다.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as dotenv from 'dotenv'
import { PrismaClient } from '../src/generated/prisma'
import {
  flattenCurriculumPoints,
  validateCurriculum,
  type CurriculumData,
} from '../src/lib/grammar/curriculum-data'

dotenv.config()

const DATA_PATH = path.join(__dirname, 'data', 'grammar-curriculum.json')
const DRY_RUN = process.argv.includes('--dry-run')
const CHUNK = 10

function loadCurriculum(): CurriculumData {
  return JSON.parse(readFileSync(DATA_PATH, 'utf8')) as CurriculumData
}

/** 원격 DB 왕복을 줄이되 커넥션을 몰지 않도록 10개씩 병렬 실행 */
async function runChunked(tasks: Array<() => Promise<unknown>>): Promise<void> {
  for (let i = 0; i < tasks.length; i += CHUNK) {
    await Promise.all(tasks.slice(i, i + CHUNK).map((t) => t()))
  }
}

async function main() {
  const data = loadCurriculum()
  const errors = validateCurriculum(data)
  if (errors.length > 0) {
    console.error(`❌ 커리큘럼 데이터 오류 ${errors.length}건:`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const points = flattenCurriculumPoints(data)
  const subCount = data.categories.reduce((n, c) => n + c.children.length, 0)
  console.log(
    `✅ 검증 통과: 대분류 ${data.categories.length} / 중분류 ${subCount} / 포인트 ${points.length} / 코스 ${data.courses.length}`,
  )
  if (DRY_RUN) {
    console.log('--dry-run: DB는 변경하지 않았습니다.')
    return
  }

  const prisma = new PrismaClient()
  try {
    // ── 1. 카테고리 (대분류 먼저, 그다음 중분류) ─────────────────────────────
    const categoryId = new Map<string, string>()

    await runChunked(
      data.categories.map((cat) => async () => {
        const row = await prisma.grammarCategory.upsert({
          where: { code: cat.code },
          create: {
            code: cat.code,
            name: cat.name,
            description: cat.description ?? null,
            depth: 1,
            sortOrder: cat.sortOrder,
          },
          update: { name: cat.name, description: cat.description ?? null, depth: 1, parentId: null, sortOrder: cat.sortOrder },
          select: { id: true },
        })
        categoryId.set(cat.code, row.id)
      }),
    )

    await runChunked(
      data.categories.flatMap((cat) =>
        cat.children.map((sub) => async () => {
          const parentId = categoryId.get(cat.code)!
          const row = await prisma.grammarCategory.upsert({
            where: { code: sub.code },
            create: { code: sub.code, name: sub.name, depth: 2, parentId, sortOrder: sub.sortOrder },
            update: { name: sub.name, depth: 2, parentId, sortOrder: sub.sortOrder },
            select: { id: true },
          })
          categoryId.set(sub.code, row.id)
        }),
      ),
    )
    console.log(`카테고리 ${categoryId.size}개 반영`)

    // ── 2. 포인트 ────────────────────────────────────────────────────────────
    const existing = await prisma.grammarPoint.findMany({
      where: { code: { in: points.map((p) => p.code) } },
      select: { id: true, code: true, title: true, levelMin: true, levelMax: true, sortOrder: true, categoryId: true, academyId: true },
    })
    const existingByCode = new Map(existing.map((p) => [p.code, p]))
    const pointId = new Map<string, string>()
    let created = 0
    let updated = 0

    const pointTasks: Array<() => Promise<unknown>> = []
    for (const cat of data.categories) {
      for (const sub of cat.children) {
        const subId = categoryId.get(sub.code)!
        for (const p of sub.points) {
          const cur = existingByCode.get(p.code)
          if (!cur) {
            pointTasks.push(async () => {
              const row = await prisma.grammarPoint.create({
                data: {
                  code: p.code,
                  title: p.title,
                  categoryId: subId,
                  academyId: null,
                  levelMin: p.levelMin,
                  levelMax: p.levelMax,
                  sortOrder: p.sortOrder,
                  status: 'DRAFT',
                },
                select: { id: true },
              })
              pointId.set(p.code, row.id)
              created++
            })
            continue
          }
          pointId.set(p.code, cur.id)
          if (cur.academyId !== null) {
            console.warn(`⚠️ ${p.code}는 학원 전용 포인트라 건너뜀`)
            continue
          }
          const changed =
            cur.title !== p.title ||
            cur.levelMin !== p.levelMin ||
            cur.levelMax !== p.levelMax ||
            cur.sortOrder !== p.sortOrder ||
            cur.categoryId !== subId
          if (changed) {
            pointTasks.push(async () => {
              await prisma.grammarPoint.update({
                where: { id: cur.id },
                data: { title: p.title, levelMin: p.levelMin, levelMax: p.levelMax, sortOrder: p.sortOrder, categoryId: subId },
              })
              updated++
            })
          }
        }
      }
    }
    await runChunked(pointTasks)
    console.log(`포인트: 새로 ${created}개, 수정 ${updated}개, 그대로 ${points.length - created - updated}개`)

    // ── 3. 선수 관계 동기화 (JSON에 있는 포인트만) ──────────────────────────
    const ids = points.map((p) => pointId.get(p.code)!)
    const currentPrereqs = await prisma.grammarPrerequisite.findMany({
      where: { pointId: { in: ids } },
      select: { id: true, pointId: true, requiredPointId: true },
    })
    const desired = new Set(
      points.flatMap((p) => p.prerequisites.map((req) => `${pointId.get(p.code)}|${pointId.get(req)}`)),
    )
    const stale = currentPrereqs.filter((r) => !desired.has(`${r.pointId}|${r.requiredPointId}`))
    const have = new Set(currentPrereqs.map((r) => `${r.pointId}|${r.requiredPointId}`))
    const toCreate = Array.from(desired)
      .filter((key) => !have.has(key))
      .map((key) => {
        const [pid, rid] = key.split('|')
        return { pointId: pid, requiredPointId: rid }
      })

    if (stale.length > 0) {
      await prisma.grammarPrerequisite.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } })
    }
    if (toCreate.length > 0) {
      await prisma.grammarPrerequisite.createMany({ data: toCreate, skipDuplicates: true })
    }
    console.log(`선수 관계: 추가 ${toCreate.length}개, 제거 ${stale.length}개, 전체 ${desired.size}개`)

    // ── 4. 본사 기본 코스 (이름 + academyId null 기준) ──────────────────────
    for (const course of data.courses) {
      const found = await prisma.grammarCourse.findFirst({
        where: { name: course.name, academyId: null },
        select: { id: true },
      })
      const courseData = {
        description: course.description ?? null,
        targetLevel: course.targetLevel ?? null,
        sortOrder: course.sortOrder,
        isActive: true,
      }
      const courseId = found
        ? (await prisma.grammarCourse.update({ where: { id: found.id }, data: courseData, select: { id: true } })).id
        : (await prisma.grammarCourse.create({ data: { name: course.name, academyId: null, ...courseData }, select: { id: true } })).id

      const items = await prisma.grammarCourseItem.findMany({
        where: { courseId },
        select: { id: true, grammarPointId: true, sortOrder: true },
      })
      const wanted = new Map(course.points.map((code, i) => [pointId.get(code)!, i + 1]))
      const removeIds = items.filter((it) => !wanted.has(it.grammarPointId)).map((it) => it.id)
      const itemByPoint = new Map(items.map((it) => [it.grammarPointId, it]))
      const reorder = items.filter((it) => wanted.has(it.grammarPointId) && wanted.get(it.grammarPointId) !== it.sortOrder)
      const add = Array.from(wanted).filter(([pid]) => !itemByPoint.has(pid))

      if (removeIds.length > 0) await prisma.grammarCourseItem.deleteMany({ where: { id: { in: removeIds } } })
      await runChunked(
        reorder.map((it) => () =>
          prisma.grammarCourseItem.update({ where: { id: it.id }, data: { sortOrder: wanted.get(it.grammarPointId)! } }),
        ),
      )
      if (add.length > 0) {
        await prisma.grammarCourseItem.createMany({
          data: add.map(([grammarPointId, sortOrder]) => ({ courseId, grammarPointId, sortOrder })),
          skipDuplicates: true,
        })
      }
      console.log(`코스 "${course.name}": ${course.points.length}개 포인트 (추가 ${add.length}, 제거 ${removeIds.length}, 순서 변경 ${reorder.length})`)
    }

    // ── 5. JSON에 없는 기존 본사 항목 경고 ─────────────────────────────────
    const jsonCodes = new Set(points.map((p) => p.code))
    const orphans = await prisma.grammarPoint.findMany({
      where: { academyId: null, code: { notIn: Array.from(jsonCodes) } },
      select: { code: true },
    })
    if (orphans.length > 0) {
      console.warn(`⚠️ JSON에 없는 본사 포인트 ${orphans.length}개(삭제하지 않음): ${orphans.map((o) => o.code).join(', ')}`)
    }

    console.log('🎉 문법 커리큘럼 시드 완료')
    console.log('※ 앱의 커리큘럼 캐시(grammar-curriculum)는 최대 1시간 뒤에 반영됩니다.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
