'use server'

// 문법 성취도 조회 액션 — 화면에서 필요할 때만 불러온다 (히트맵 칸 팝오버, 학생 상세 '문법' 탭)
// 권한은 매번 다시 확인한다: 교사는 담당 반 학생, 학원장은 본원+소유 지점.

import { prisma } from '@/lib/prisma/client'
import { classStudentWhere, findManagedClass, findManagedStudent, getGrammarManageScope } from './manage-access'
import { getPointAttempts, getStudentGrammarDetail, type GrammarAttemptItem, type StudentGrammarDetail } from './achievement-queries'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const NO_PERMISSION = '권한이 없습니다.'

/** 히트맵 칸 — 그 학생·포인트의 시도 기록 */
export async function loadHeatmapCellAttempts(
  classId: string,
  studentId: string,
  grammarPointId: string,
): Promise<Result<GrammarAttemptItem[]>> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const cls = await findManagedClass(scope, classId)
  if (!cls || typeof studentId !== 'string' || typeof grammarPointId !== 'string') return { ok: false, error: NO_PERMISSION }

  const [student, assignment] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, ...classStudentWhere(cls.id) }, select: { id: true } }),
    prisma.grammarAssignment.findFirst({ where: { classId: cls.id, grammarPointId }, select: { id: true } }),
  ])
  if (!student || !assignment) return { ok: false, error: '기록을 찾을 수 없습니다.' }

  try {
    return { ok: true, data: await getPointAttempts(student.id, grammarPointId) }
  } catch (error) {
    console.error('[grammar-achievement] 시도 기록 조회 실패:', error)
    return { ok: false, error: '기록을 불러오지 못했습니다.' }
  }
}

/** 교사 학생 상세 '문법' 탭 */
export async function loadStudentGrammarDetail(studentId: string): Promise<Result<StudentGrammarDetail>> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const student = await findManagedStudent(scope, studentId)
  if (!student) return { ok: false, error: '학생을 찾을 수 없거나 관리 권한이 없습니다.' }
  try {
    return { ok: true, data: await getStudentGrammarDetail(student) }
  } catch (error) {
    console.error('[grammar-achievement] 학생 문법 조회 실패:', error)
    return { ok: false, error: '문법 학습 기록을 불러오지 못했습니다.' }
  }
}
