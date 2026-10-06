import 'server-only'

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { addDays, dayOfWeekOf, dbDate, todayKst } from '@/lib/attendance/time'
import { parseWordLearningSettings } from '@/lib/words/settings'
import type { Prisma } from '@/generated/prisma'

// 학습 랭킹 — 포인트(= XP)와 학습량(단어 응답 수)을 기간·범위별로 순위화한다.
// 원천 데이터: StudentDailyStat(일자별 집계). 누적은 Student.totalXp 기준.

export type RankingPeriod = 'week' | 'month' | 'all'
export type RankingScope = 'class' | 'academy' | 'global'

export const RANKING_PERIOD_LABEL: Record<RankingPeriod, string> = {
  week: '이번 주',
  month: '이번 달',
  all: '누적',
}

export const RANKING_SCOPE_LABEL: Record<RankingScope, string> = {
  class: '우리 반',
  academy: '우리 학원',
  global: '전체',
}

export function parseRankingPeriod(v: string | undefined): RankingPeriod {
  return v === 'month' || v === 'all' ? v : 'week'
}

export function parseRankingScope(v: string | undefined): RankingScope {
  return v === 'class' || v === 'global' ? v : 'academy'
}

export interface RankingEntry {
  rank: number
  studentId: string
  name: string
  level: number
  className: string | null
  points: number
  /** 학습량 = 학습 완료 신규 단어 + 복습 단어 */
  words: number
  mastered: number
  grammar: number
}

export interface RankingResult {
  period: RankingPeriod
  scope: RankingScope
  /** KST 기간 표시 (예: 10.6 ~ 10.12) */
  rangeLabel: string
  totalParticipants: number
  top: RankingEntry[]
  me: RankingEntry | null
}

const TOP_N = 50

/** 이름 마스킹 (전체 랭킹용): 김민수 → 김*수, 이준 → 이*, 남궁민수 → 남**수 */
export function maskName(name: string): string {
  const chars = Array.from(name.trim())
  if (chars.length <= 1) return name
  if (chars.length === 2) return `${chars[0]}*`
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`
}

/** 기간 시작 KST 날짜 키 (주: 월요일 시작) */
function periodStartKey(period: RankingPeriod, today: string): string | null {
  if (period === 'all') return null
  if (period === 'month') return `${today.slice(0, 7)}-01`
  const dow = dayOfWeekOf(today) // 0=일
  return addDays(today, dow === 0 ? -6 : 1 - dow)
}

function formatRange(startKey: string | null, today: string): string {
  const fmt = (k: string) => `${Number(k.slice(5, 7))}.${Number(k.slice(8, 10))}`
  return startKey ? `${fmt(startKey)} ~ ${fmt(today)}` : '전체 기간'
}

/** 전체 랭킹에 참여하지 않는 학원 (학원장 설정 globalRanking=false) */
const getGlobalOptOutAcademyIds = unstable_cache(
  async () => {
    const academies = await prisma.academy.findMany({
      where: { isDeleted: false },
      select: { id: true, settingsJson: true },
    })
    return academies.filter((a) => !parseWordLearningSettings(a.settingsJson).globalRanking).map((a) => a.id)
  },
  ['ranking-global-optout'],
  { revalidate: 300, tags: ['ranking-optout'] },
)

type ScopeTarget = { scope: RankingScope; academyId: string | null; classId: string | null }

async function studentScopeWhere(target: ScopeTarget): Promise<Prisma.StudentWhereInput> {
  const base: Prisma.StudentWhereInput = { status: 'ACTIVE', user: { isDeleted: false } }
  if (target.scope === 'class' && target.classId) return { ...base, classId: target.classId }
  if (target.scope === 'global') {
    const optOut = await getGlobalOptOutAcademyIds()
    return {
      ...base,
      user: { isDeleted: false, academyId: { not: null, ...(optOut.length > 0 ? { notIn: optOut } : {}) } },
    }
  }
  return { ...base, user: { isDeleted: false, academyId: target.academyId ?? '__none__' } }
}

type Row = { studentId: string; points: number; words: number; mastered: number; grammar: number }

async function loadRows(target: ScopeTarget, period: RankingPeriod, today: string): Promise<Row[]> {
  const studentWhere = await studentScopeWhere(target)
  const startKey = periodStartKey(period, today)

  const stats = await prisma.studentDailyStat.groupBy({
    by: ['studentId'],
    where: {
      student: studentWhere,
      ...(startKey ? { statDate: { gte: dbDate(startKey) } } : {}),
    },
    _sum: { points: true, wordCorrect: true, wordWrong: true, masteredWords: true, grammarSolved: true },
  })
  const rows = new Map<string, Row>(
    stats.map((s) => [
      s.studentId,
      {
        studentId: s.studentId,
        points: s._sum.points ?? 0,
        words: (s._sum.wordCorrect ?? 0) + (s._sum.wordWrong ?? 0),
        mastered: s._sum.masteredWords ?? 0,
        grammar: s._sum.grammarSolved ?? 0,
      },
    ]),
  )

  // 누적: 포인트는 집계 도입 이전 XP까지 포함한 Student.totalXp 사용
  if (period === 'all') {
    const students = await prisma.student.findMany({
      where: { ...studentWhere, totalXp: { gt: 0 } },
      select: { id: true, totalXp: true },
    })
    for (const s of students) {
      const row = rows.get(s.id) ?? { studentId: s.id, points: 0, words: 0, mastered: 0, grammar: 0 }
      row.points = s.totalXp
      rows.set(s.id, row)
    }
  }

  return Array.from(rows.values())
    .filter((r) => r.points > 0 || r.words > 0)
    .sort((a, b) => b.points - a.points || b.words - a.words)
}

/** 동점은 같은 순위 (1, 1, 3 …) */
function assignRanks(rows: Row[]): (Row & { rank: number })[] {
  let prev: Row | null = null
  let prevRank = 0
  return rows.map((r, i) => {
    const rank = prev && prev.points === r.points && prev.words === r.words ? prevRank : i + 1
    prev = r
    prevRank = rank
    return { ...r, rank }
  })
}

const getCachedRanking = (target: ScopeTarget, period: RankingPeriod, today: string) =>
  unstable_cache(
    async () => {
      const ranked = assignRanks(await loadRows(target, period, today))
      const topIds = ranked.slice(0, TOP_N).map((r) => r.studentId)
      const students = await prisma.student.findMany({
        where: { id: { in: topIds } },
        select: { id: true, currentLevel: true, user: { select: { name: true } }, class: { select: { name: true } } },
      })
      const info = new Map(students.map((s) => [s.id, s]))
      return {
        // 내 순위 계산용 전체 목록(이름 없이) + 상위 N명 상세
        ranked: ranked.map(({ studentId, rank, points, words, mastered, grammar }) => ({
          studentId,
          rank,
          points,
          words,
          mastered,
          grammar,
        })),
        topInfo: topIds.map((id) => {
          const s = info.get(id)
          return {
            studentId: id,
            name: s?.user.name ?? '알 수 없음',
            level: s?.currentLevel ?? 1,
            className: s?.class?.name ?? null,
          }
        }),
      }
    },
    ['learning-ranking', target.scope, target.academyId ?? '-', target.classId ?? '-', period, today],
    { revalidate: 60, tags: ['learning-ranking'] },
  )()

export async function getLearningRanking(params: {
  scope: RankingScope
  period: RankingPeriod
  academyId: string | null
  classId: string | null
  /** 학생 본인 (내 순위 표시) */
  viewer?: { studentId: string; name: string; level: number; className: string | null } | null
}): Promise<RankingResult> {
  const { period, viewer } = params
  // 반이 없으면 우리 반 → 우리 학원으로 대체
  const scope: RankingScope = params.scope === 'class' && !params.classId ? 'academy' : params.scope
  const target: ScopeTarget = {
    scope,
    academyId: scope === 'global' ? null : params.academyId,
    classId: scope === 'class' ? params.classId : null,
  }
  const today = todayKst()
  const { ranked, topInfo } = await getCachedRanking(target, period, today)
  const mask = scope === 'global'

  const top: RankingEntry[] = topInfo.map((info, i) => {
    const r = ranked[i]
    const isMe = viewer?.studentId === info.studentId
    return {
      ...r,
      name: mask && !isMe ? maskName(info.name) : info.name,
      level: info.level,
      className: mask ? null : info.className,
    }
  })

  let me: RankingEntry | null = null
  if (viewer) {
    const mine = ranked.find((r) => r.studentId === viewer.studentId)
    me = mine
      ? { ...mine, name: viewer.name, level: viewer.level, className: mask ? null : viewer.className }
      : {
          rank: 0,
          studentId: viewer.studentId,
          name: viewer.name,
          level: viewer.level,
          className: mask ? null : viewer.className,
          points: 0,
          words: 0,
          mastered: 0,
          grammar: 0,
        }
  }

  return {
    period,
    scope,
    rangeLabel: formatRange(periodStartKey(period, today), today),
    totalParticipants: ranked.length,
    top,
    me,
  }
}
