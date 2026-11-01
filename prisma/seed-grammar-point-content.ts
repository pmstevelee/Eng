/**
 * prisma/seed-grammar-point-content.ts
 * 본사 문법 포인트 하나의 콘텐츠(개념 정리·관리자 원고·검수 완료 문항)를 넣고, 원하면 공개한다.
 *
 * 실행: npm run seed:grammar-content -- G01-01-01              (검증 + 바뀔 내용만 출력, DB 변경 없음)
 *       npm run seed:grammar-content -- G01-01-01 --apply      (DB 반영, 상태는 그대로)
 *       npm run seed:grammar-content -- G01-01-01 --apply --publish  (반영 후 공개 — 검수 문항 22개 이상일 때만)
 *
 * - 데이터: prisma/data/grammar-content/{code}.json
 * - 여러 번 실행해도 안전: 원고는 같은 제목이 있으면 건너뛰고, 문항은 같은 문제 문장·보기가 있으면 건너뛴다.
 * - 개념 정리(summary/규칙/예문/흔한 오류)는 파일 내용으로 덮어쓴다.
 * - 열려 있는 '원고 없음' 보완 요청(DRAFT·ANALYZE)은 새 원고로 답한 것으로 처리(RESOLVED)한다.
 * - lecture가 있으면 본사 기본 강의(YouTube)로 등록한다. 이미 같은 영상이면 제목·길이만 고치고, 다른 영상이면 바꾸고 이전 시청 기록을 지운다.
 * - 서버 캐시(문법 커리큘럼 1시간)는 여기서 비울 수 없다. 공개 직후 바로 보이게 하려면 관리자 화면에서 상태를 저장하거나 최대 1시간 기다린다.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as dotenv from 'dotenv'
import { PrismaClient, type Prisma } from '../src/generated/prisma'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '../src/types/grammar'
import { POINT_LIST_MAX, POINT_SUMMARY_MAX } from '../src/lib/grammar/point-editing'
import { MIN_PUBLISH_QUESTIONS } from '../src/lib/grammar/constants'
import { LECTURE_DURATION_MAX, LECTURE_TITLE_MAX, parseYoutubeUrl } from '../src/lib/grammar/lecture-input'
import { LEVEL_TO_CEFR } from '../src/lib/constants/levels'

dotenv.config({ path: '.env.local' })
dotenv.config()

const LETTERS = ['A', 'B', 'C', 'D'] as const

interface QuestionContent {
  type: 'multiple_choice' | 'fill_blank'
  question_text: string
  question_text_ko?: string
  options?: string[]
  correct_answer: string
  explanation: string
}

interface ContentFile {
  code: string
  summary: string
  rules: unknown
  examples: unknown
  commonErrors: unknown
  sourceScript?: { title: string; content: string }
  /** 본사 기본 강의 — youtube는 영상 주소(youtu.be/ID 등), durationSec은 영상 길이(초) */
  lecture?: { title: string; youtube: string; durationSec?: number }
  questions: { difficulty: number; content: QuestionContent }[]
}

function fail(msg: string): never {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

function questionKey(c: QuestionContent): string {
  return norm(`${c.question_text} | ${(c.options ?? []).join(' / ')}`)
}

/** 문항 형식 검사 — 학생 화면·채점이 기대하는 모양인지 */
function checkQuestion(q: ContentFile['questions'][number], i: number): string | null {
  const c = q.content
  const at = `문항 ${i + 1}`
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 10) return `${at}: 난이도는 1~10`
  if (!c.question_text?.trim() || !c.explanation?.trim()) return `${at}: 문제 문장·해설이 비었어요`
  if (c.type === 'multiple_choice') {
    const opts = c.options ?? []
    if (opts.length !== 4 || opts.some((o) => !o.trim())) return `${at}: 보기는 4개`
    if (new Set(opts.map(norm)).size !== 4) return `${at}: 보기가 겹쳐요`
    if (!(LETTERS as readonly string[]).includes(c.correct_answer)) return `${at}: 정답은 A~D`
    return null
  }
  if (c.type === 'fill_blank') {
    if (!c.question_text.includes('____')) return `${at}: 빈칸(____)이 없어요`
    if (!c.correct_answer.trim()) return `${at}: 정답이 비었어요`
    if (c.options) return `${at}: 빈칸 문항엔 보기를 넣지 않아요`
    return null
  }
  return `${at}: 알 수 없는 형식 ${String((c as { type?: string }).type)}`
}

async function main() {
  const code = process.argv.slice(2).find((a) => !a.startsWith('--'))
  const apply = process.argv.includes('--apply')
  const publish = process.argv.includes('--publish')
  if (!code) fail('포인트 코드를 넣어 주세요. 예) npm run seed:grammar-content -- G01-01-01')
  if (publish && !apply) fail('--publish는 --apply와 같이 써 주세요.')

  const file = path.join(__dirname, 'data', 'grammar-content', `${code}.json`)
  const data = JSON.parse(readFileSync(file, 'utf8')) as ContentFile
  if (data.code !== code) fail(`파일의 code(${data.code})가 ${code}와 달라요.`)

  // ── 개념 정리 검증 (관리자 편집 화면과 같은 기준)
  const summary = data.summary.trim()
  const rules = parseGrammarRules(data.rules)
  const examples = parseGrammarExamples(data.examples)
  const commonErrors = parseGrammarCommonErrors(data.commonErrors)
  if (!summary || summary.length > POINT_SUMMARY_MAX) fail(`요약은 1~${POINT_SUMMARY_MAX}자 (지금 ${summary.length}자)`)
  for (const [name, list, raw] of [
    ['규칙', rules, data.rules],
    ['예문', examples, data.examples],
    ['흔한 오류', commonErrors, data.commonErrors],
  ] as const) {
    if (!Array.isArray(raw) || list.length !== raw.length) fail(`${name}에 빈 칸이 있어요.`)
    if (list.length === 0 || list.length > POINT_LIST_MAX) fail(`${name}는 1~${POINT_LIST_MAX}개 (지금 ${list.length}개)`)
  }
  for (const ex of examples) {
    if (ex.highlight && !ex.en.includes(ex.highlight)) fail(`예문 강조 "${ex.highlight}"가 문장에 없어요: ${ex.en}`)
  }

  // ── 문항 검증
  const keys = new Set<string>()
  data.questions.forEach((q, i) => {
    const err = checkQuestion(q, i)
    if (err) fail(err)
    const k = questionKey(q.content)
    if (keys.has(k)) fail(`문항 ${i + 1}: 같은 문항이 두 번 있어요`)
    keys.add(k)
  })
  // ── 강의 검증
  const lecture = data.lecture
    ? (() => {
        const videoId = parseYoutubeUrl(data.lecture.youtube)
        const title = data.lecture.title?.trim() ?? ''
        const durationSec = data.lecture.durationSec ?? null
        if (!videoId) fail(`강의 YouTube 주소를 읽지 못했어요: ${data.lecture.youtube}`)
        if (!title || title.length > LECTURE_TITLE_MAX) fail(`강의 제목은 1~${LECTURE_TITLE_MAX}자`)
        if (durationSec !== null && (!Number.isInteger(durationSec) || durationSec <= 0 || durationSec > LECTURE_DURATION_MAX)) fail('강의 길이(초)가 올바르지 않아요')
        return { videoId, title, durationSec }
      })()
    : null
  const letterCount = LETTERS.map((l) => data.questions.filter((q) => q.content.correct_answer === l).length)

  const prisma = new PrismaClient()
  try {
    const point = await prisma.grammarPoint.findFirst({
      where: { code, academyId: null },
      select: { id: true, title: true, status: true, categoryId: true },
    })
    if (!point) fail(`본사 포인트 ${code}가 없어요. 먼저 npm run seed:grammar-curriculum`)

    const [existingQuestions, existingScript, openGaps, existingLecture] = await Promise.all([
      prisma.question.findMany({
        where: { grammarPointId: point.id, academyId: null },
        select: { id: true, contentJson: true, isVerified: true, isActive: true },
      }),
      data.sourceScript
        ? prisma.grammarSourceScript.findFirst({
            where: { grammarPointId: point.id, title: data.sourceScript.title },
            select: { id: true },
          })
        : Promise.resolve(null),
      prisma.grammarContentGap.findMany({
        where: { grammarPointId: point.id, status: 'OPEN', origin: { in: ['DRAFT', 'ANALYZE'] } },
        select: { id: true, message: true },
      }),
      prisma.grammarLecture.findFirst({
        where: { grammarPointId: point.id, academyId: null, isActive: true },
        select: { id: true, videoId: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const existingKeys = new Set(
      existingQuestions.map((q) => questionKey(q.contentJson as unknown as QuestionContent)),
    )
    const newQuestions = data.questions.filter((q) => !existingKeys.has(questionKey(q.content)))
    const verifiedBefore = existingQuestions.filter((q) => q.isVerified && q.isActive).length
    const verifiedAfter = verifiedBefore + newQuestions.length

    console.log(`▶ ${code} ${point.title} (지금 상태 ${point.status})`)
    console.log(`  개념 정리: 요약 ${summary.length}자 · 규칙 ${rules.length} · 예문 ${examples.length} · 흔한 오류 ${commonErrors.length}`)
    console.log(`  원고: ${data.sourceScript ? (existingScript ? '이미 있음 → 건너뜀' : `새로 추가 "${data.sourceScript.title}"`) : '없음'}`)
    console.log(`  보완 요청: 열린 것 ${openGaps.length}개${openGaps.length && data.sourceScript ? ' → 원고로 답함(RESOLVED)' : ''}`)
    console.log(`  문항: 파일 ${data.questions.length}개 (정답 위치 A${letterCount[0]} B${letterCount[1]} C${letterCount[2]} D${letterCount[3]}) · 새로 넣을 것 ${newQuestions.length}개`)
    console.log(`  강의: ${!lecture ? '없음' : !existingLecture ? `새로 등록 ${lecture.videoId}` : existingLecture.videoId === lecture.videoId ? `같은 영상 ${lecture.videoId} → 제목·길이만 갱신` : `${existingLecture.videoId} → ${lecture.videoId}로 교체 (이전 시청 기록 삭제)`}`)
    console.log(`  검수 완료 문항: ${verifiedBefore} → ${verifiedAfter} (공개 기준 ${MIN_PUBLISH_QUESTIONS})`)
    if (publish && verifiedAfter < MIN_PUBLISH_QUESTIONS) fail('검수 완료 문항이 모자라 공개할 수 없어요.')

    if (!apply) {
      console.log('\n(검증만 했어요. 반영하려면 --apply)')
      return
    }

    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true }, orderBy: { createdAt: 'asc' } })

    await prisma.$transaction(async (tx) => {
      await tx.grammarPoint.update({
        where: { id: point.id },
        data: {
          summary,
          rulesJson: rules as unknown as Prisma.InputJsonArray,
          examplesJson: examples as unknown as Prisma.InputJsonArray,
          commonErrorsJson: commonErrors as unknown as Prisma.InputJsonArray,
        },
      })

      if (data.sourceScript && !existingScript) {
        const script = await tx.grammarSourceScript.create({
          data: {
            grammarPointId: point.id,
            title: data.sourceScript.title,
            content: data.sourceScript.content,
            gapId: openGaps[0]?.id ?? null,
            isActive: true,
            createdById: admin?.id ?? null,
          },
          select: { id: true },
        })
        if (openGaps.length > 0) {
          await tx.grammarContentGap.updateMany({
            where: { id: { in: openGaps.map((g) => g.id) } },
            data: { status: 'RESOLVED', resolvedScriptId: script.id, resolvedAt: new Date() },
          })
        }
      }

      if (newQuestions.length > 0) {
        await tx.question.createMany({
          data: newQuestions.map((q) => ({
            academyId: null,
            domain: 'GRAMMAR' as const,
            subCategory: point.title,
            difficulty: q.difficulty,
            cefrLevel: LEVEL_TO_CEFR[q.difficulty] ?? null,
            contentJson: q.content as unknown as Prisma.InputJsonObject,
            source: 'SYSTEM' as const,
            isVerified: true,
            isActive: true,
            grammarPointId: point.id,
            createdBy: admin?.id ?? null,
          })),
        })
      }

      if (lecture) {
        const lectureData = { title: lecture.title, provider: 'youtube', videoId: lecture.videoId, durationSec: lecture.durationSec }
        if (!existingLecture) {
          await tx.grammarLecture.create({ data: { ...lectureData, grammarPointId: point.id, academyId: null, createdById: admin?.id ?? null } })
        } else if (existingLecture.videoId !== lecture.videoId) {
          // 관리자 화면(upsertLecture)과 같게: 다른 영상이면 시청 기록을 지우고 AI 강의 스크립트 연결을 끊는다
          await tx.grammarLectureView.deleteMany({ where: { lectureId: existingLecture.id } })
          await tx.grammarLecture.update({ where: { id: existingLecture.id }, data: { ...lectureData, createdById: admin?.id ?? null, scriptId: null } })
        } else {
          await tx.grammarLecture.update({ where: { id: existingLecture.id }, data: lectureData })
        }
      }

      if (publish) {
        await tx.grammarPoint.update({
          where: { id: point.id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        })
      }
    })

    // 문제 뱅크 통계 캐시 — 바뀐 난이도만
    const difficulties = Array.from(new Set(newQuestions.map((q) => q.difficulty)))
    for (const difficulty of difficulties) {
      const where = { domain: 'GRAMMAR' as const, difficulty, isActive: true, academyId: null }
      const [totalCount, verifiedCount, quality] = await Promise.all([
        prisma.question.count({ where }),
        prisma.question.count({ where: { ...where, isVerified: true } }),
        prisma.question.aggregate({ where: { ...where, qualityScore: { not: null } }, _avg: { qualityScore: true } }),
      ])
      await prisma.questionBankStats.upsert({
        where: { domain_difficulty: { domain: 'GRAMMAR', difficulty } },
        create: { domain: 'GRAMMAR', difficulty, totalCount, verifiedCount, avgQualityScore: quality._avg.qualityScore ?? null, lastUpdatedAt: new Date() },
        update: { totalCount, verifiedCount, avgQualityScore: quality._avg.qualityScore ?? null, lastUpdatedAt: new Date() },
      })
    }

    const final = await prisma.grammarPoint.findUnique({ where: { id: point.id }, select: { status: true } })
    console.log(`✔ 반영 완료 — 상태 ${final?.status}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
