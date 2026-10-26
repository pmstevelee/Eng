'use server'

// 주간 문법 리포트 — 화면이 뜬 뒤 빠진 취약 포인트 AI 코멘트를 채운다 (같은 주에 이미 있으면 OpenAI를 부르지 않음)

import { requireStudent } from '@/lib/auth-student'
import { ensureWeakComments } from './weekly-report'
import { findManagedStudent, getGrammarManageScope } from './manage-access'

type Result = { ok: true; comments: Record<string, string> } | { ok: false; error: string }

async function run(studentId: string): Promise<Result> {
  try {
    return { ok: true, comments: await ensureWeakComments(studentId) }
  } catch (error) {
    console.error('[grammar-weekly] 코멘트 처리 실패:', error)
    return { ok: false, error: 'AI 코멘트를 불러오지 못했습니다.' }
  }
}

/** 학생 본인 (문법 홈) */
export async function ensureMyWeakComments(): Promise<Result> {
  const { studentId } = await requireStudent()
  return run(studentId)
}

/** 교사·학원장 (학생 상세 '문법' 탭) — 관리 범위 학생만 */
export async function ensureStudentWeakComments(studentId: string): Promise<Result> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: '권한이 없습니다.' }
  const student = await findManagedStudent(scope, studentId)
  if (!student) return { ok: false, error: '학생을 찾을 수 없거나 관리 권한이 없습니다.' }
  return run(student.id)
}
