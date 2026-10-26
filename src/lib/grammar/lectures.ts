// 문법 포인트 강의(YouTube 일부공개 링크) 데이터 함수 — 서버 전용
//
// - 포인트·학원당 강의 1편 (academyId null = 본사 기본 강의)
// - 학생에게는 학원 강의 → 본사 기본 순으로 하나만 보여 준다
// - 권한 확인은 호출하는 Server Action에서 한다 (관리자는 academyId=null만, 교사·학원장은 자기 학원만)

import { prisma } from '@/lib/prisma/client'
import { LECTURE_COMPLETE_PERCENT, pickLectureForAcademy, type LectureInput } from './lecture-input'

export { parseYoutubeUrl, LECTURE_COMPLETE_PERCENT } from './lecture-input'

/** 학생 화면에 보낼 강의 */
export interface StudentLecture {
  id: string
  title: string
  videoId: string
  durationSec: number | null
  notesUrl: string | null
  /** 학원 강의면 true, 본사 기본이면 false */
  isAcademy: boolean
  /** 학원 강의를 등록한 선생님 이름 */
  teacherName: string | null
  watchedPercent: number
  completed: boolean
}

/** 학생 강의 조회용 select — 단원 페이지 웨이브에서도 같이 쓴다 */
export function studentLectureSelect(studentId: string) {
  return {
    id: true,
    title: true,
    videoId: true,
    durationSec: true,
    notesUrl: true,
    academyId: true,
    createdBy: { select: { name: true } },
    views: { where: { studentId }, select: { watchedPercent: true, completedAt: true }, take: 1 },
  } as const
}

type StudentLectureRow = {
  id: string
  title: string
  videoId: string
  durationSec: number | null
  notesUrl: string | null
  academyId: string | null
  createdBy: { name: string } | null
  views: { watchedPercent: number; completedAt: Date | null }[]
}

export function toStudentLecture(rows: StudentLectureRow[], academyId: string): StudentLecture | null {
  const l = pickLectureForAcademy(rows, academyId)
  if (!l) return null
  const view = l.views[0]
  return {
    id: l.id,
    title: l.title,
    videoId: l.videoId,
    durationSec: l.durationSec,
    notesUrl: l.notesUrl,
    isAcademy: l.academyId !== null,
    teacherName: l.academyId !== null ? (l.createdBy?.name ?? null) : null,
    watchedPercent: view?.watchedPercent ?? 0,
    completed: !!view?.completedAt,
  }
}

/** 포인트의 학원·본사 강의 후보 조건 */
export function lectureVisibleWhere(academyId: string) {
  return { isActive: true, OR: [{ academyId: null }, { academyId }] }
}

/** 학생이 볼 강의 1편 — 학원 강의 우선, 없으면 본사 강의, 없으면 null */
export async function getLectureForStudent(pointId: string, academyId: string, studentId: string): Promise<StudentLecture | null> {
  const rows = await prisma.grammarLecture.findMany({
    where: { grammarPointId: pointId, ...lectureVisibleWhere(academyId) },
    select: studentLectureSelect(studentId),
    take: 2,
  })
  return toStudentLecture(rows, academyId)
}

// ─── 관리 (관리자·교사·학원장) ──────────────────────────────────────────────

export interface ManagedLecture {
  id: string
  title: string
  videoId: string
  durationSec: number | null
  notesUrl: string | null
  academyId: string | null
  academyName: string | null
  createdByName: string | null
  completedCount: number
  updatedAt: Date
}

/** 포인트에 등록된 강의 목록 (본사 기본 먼저) — academyId를 주면 본사 + 그 학원 것만 */
export async function getPointLectures(pointId: string, academyId?: string): Promise<ManagedLecture[]> {
  const rows = await prisma.grammarLecture.findMany({
    where: {
      grammarPointId: pointId,
      isActive: true,
      ...(academyId ? { OR: [{ academyId: null }, { academyId }] } : {}),
    },
    select: {
      id: true,
      title: true,
      videoId: true,
      durationSec: true,
      notesUrl: true,
      academyId: true,
      updatedAt: true,
      academy: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { views: { where: { completedAt: { not: null } } } } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      videoId: r.videoId,
      durationSec: r.durationSec,
      notesUrl: r.notesUrl,
      academyId: r.academyId,
      academyName: r.academy?.name ?? null,
      createdByName: r.createdBy?.name ?? null,
      completedCount: r._count.views,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => Number(a.academyId !== null) - Number(b.academyId !== null))
}

/**
 * 강의 등록·수정 — 포인트·학원당 1편이므로 이미 있으면 그 강의를 고친다.
 * 영상이 바뀌면 이전 시청 기록은 새 영상과 맞지 않으므로 지운다.
 */
export async function upsertLecture(params: {
  grammarPointId: string
  academyId: string | null
  input: LectureInput
  userId: string
}): Promise<{ id: string; created: boolean; detachedScriptId: string | null }> {
  const { grammarPointId, academyId, input, userId } = params
  const existing = await prisma.grammarLecture.findFirst({
    where: { grammarPointId, academyId, isActive: true },
    select: { id: true, videoId: true, scriptId: true },
    orderBy: { updatedAt: 'desc' },
  })
  const data = {
    title: input.title,
    provider: 'youtube',
    videoId: input.videoId,
    durationSec: input.durationSec,
    notesUrl: input.notesUrl,
  }
  if (!existing) {
    const created = await prisma.grammarLecture.create({
      data: { ...data, grammarPointId, academyId, createdById: userId },
      select: { id: true },
    })
    return { id: created.id, created: true, detachedScriptId: null }
  }
  if (existing.videoId !== input.videoId) {
    // 다른 영상으로 바꾸면 AI 강의 스크립트와의 연결도 끊는다 (스크립트 상태는 호출한 쪽에서 되돌림)
    await prisma.$transaction([
      prisma.grammarLectureView.deleteMany({ where: { lectureId: existing.id } }),
      prisma.grammarLecture.update({ where: { id: existing.id }, data: { ...data, createdById: userId, scriptId: null } }),
    ])
    return { id: existing.id, created: false, detachedScriptId: existing.scriptId }
  }
  await prisma.grammarLecture.update({ where: { id: existing.id }, data })
  return { id: existing.id, created: false, detachedScriptId: null }
}

/** 강의 삭제 — academyId가 맞는 강의만 (시청 기록은 함께 삭제됨) */
export async function deleteLecture(
  lectureId: string,
  academyId: string | null,
): Promise<{ grammarPointId: string; scriptId: string | null } | null> {
  const lecture = await prisma.grammarLecture.findFirst({
    where: { id: lectureId, academyId },
    select: { id: true, grammarPointId: true, scriptId: true },
  })
  if (!lecture) return null
  await prisma.grammarLecture.delete({ where: { id: lecture.id } })
  return { grammarPointId: lecture.grammarPointId, scriptId: lecture.scriptId }
}

// ─── 학생 시청 기록 ──────────────────────────────────────────────────────────

/**
 * 시청률 저장 — 기존 값보다 클 때만 올리고, 80% 이상이 처음이면 completedAt 기록.
 * 단원 진도가 미학습이면 학습 중으로만 바꾼다 (통과 판정에는 영향 없음).
 * 학생이 볼 수 없는 강의(다른 학원·숨김)면 null.
 */
export async function saveLectureProgress(params: {
  lectureId: string
  watchedPercent: number
  studentId: string
  academyId: string
  /** 주면 이 포인트의 강의인지도 확인 */
  grammarPointId?: string
}): Promise<{ watchedPercent: number; completed: boolean } | null> {
  const { lectureId, studentId, academyId, grammarPointId } = params
  const percent = Math.max(0, Math.min(100, Math.floor(Number(params.watchedPercent) || 0)))

  const [lecture, view] = await Promise.all([
    prisma.grammarLecture.findFirst({
      where: { id: lectureId, ...(grammarPointId ? { grammarPointId } : {}), ...lectureVisibleWhere(academyId) },
      select: { id: true, grammarPointId: true },
    }),
    prisma.grammarLectureView.findUnique({
      where: { lectureId_studentId: { lectureId, studentId } },
      select: { watchedPercent: true, completedAt: true },
    }),
  ])
  if (!lecture) return null

  const prev = view?.watchedPercent ?? 0
  const next = Math.max(prev, percent)
  const completedAt = view?.completedAt ?? (next >= LECTURE_COMPLETE_PERCENT ? new Date() : null)
  const now = new Date()

  const writes = []
  if (!view) {
    writes.push(prisma.grammarLectureView.create({ data: { lectureId, studentId, watchedPercent: next, completedAt } }))
  } else if (next > prev || (completedAt && !view.completedAt)) {
    writes.push(
      prisma.grammarLectureView.update({
        where: { lectureId_studentId: { lectureId, studentId } },
        data: { watchedPercent: next, completedAt },
      }),
    )
  }
  if (next > 0) {
    writes.push(
      prisma.grammarPointProgress.upsert({
        where: { studentId_grammarPointId: { studentId, grammarPointId: lecture.grammarPointId } },
        create: {
          studentId,
          grammarPointId: lecture.grammarPointId,
          state: 'IN_PROGRESS',
          currentStep: 'LECTURE',
          lastActivityAt: now,
        },
        update: { lastActivityAt: now },
      }),
      prisma.grammarPointProgress.updateMany({
        where: { studentId, grammarPointId: lecture.grammarPointId, state: 'NOT_STARTED' },
        data: { state: 'IN_PROGRESS' },
      }),
    )
  }
  if (writes.length > 0) await prisma.$transaction(writes)

  return { watchedPercent: next, completed: completedAt !== null }
}
