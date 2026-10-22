'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { todayKst } from '@/lib/attendance/time'
import { upsertStudySession } from '@/lib/words/study-session-store'
import {
  StudySessionStateSchema,
  parseStudySessionState,
  type StudySessionState,
  type StudyStage,
} from '@/lib/words/study-session'

// 단어 세트 학습 단계(플래시카드/리콜/스펠)별 진행 상태 저장·조회.
// 진행은 KST 하루 단위 — 날짜가 바뀌면 오늘의 학습 배치가 달라지므로 새로 시작한다.

const StageSchema = z.enum(['FLASHCARD', 'RECALL', 'SPELL'])
const KeySchema = z.object({ setId: z.string().uuid(), stage: StageSchema })

/** 오늘 저장된 진행 상태 (없거나 지난 날짜면 null) */
export async function getWordStudySession(
  setId: string,
  stage: StudyStage,
): Promise<StudySessionState | null> {
  const key = KeySchema.safeParse({ setId, stage })
  if (!key.success) return null
  const { studentId } = await requireStudent()
  try {
    const row = await prisma.wordStudySession.findUnique({
      where: { studentId_setId_stage: { studentId, setId: key.data.setId, stage: key.data.stage } },
      select: { studyDate: true, stateJson: true },
    })
    if (!row || row.studyDate !== todayKst()) return null
    return parseStudySessionState(row.stateJson)
  } catch {
    // 진행 상태를 못 읽어도 학습은 처음부터 정상 진행
    return null
  }
}

/** 세트 개요 화면용 — 단계별 오늘 진행(답한 수/라운드 단어 수) */
export async function getWordStudySessionSummary(
  setId: string,
): Promise<Partial<Record<StudyStage, { done: number; total: number }>>> {
  if (!z.string().uuid().safeParse(setId).success) return {}
  const { studentId } = await requireStudent()
  try {
    const rows = await prisma.wordStudySession.findMany({
      where: { studentId, setId, studyDate: todayKst() },
      select: { stage: true, stateJson: true },
    })
    const summary: Partial<Record<StudyStage, { done: number; total: number }>> = {}
    for (const row of rows) {
      const state = parseStudySessionState(row.stateJson)
      if (!state || state.index === 0 || state.index >= state.deck.length) continue
      if (row.stage === 'FLASHCARD' || row.stage === 'RECALL' || row.stage === 'SPELL') {
        summary[row.stage] = { done: state.index, total: state.deck.length }
      }
    }
    return summary
  } catch {
    return {}
  }
}

const SaveSchema = KeySchema.extend({ state: StudySessionStateSchema })

export async function saveWordStudySession(
  input: z.infer<typeof SaveSchema>,
): Promise<{ ok: boolean }> {
  const parsed = SaveSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const { setId, stage, state } = parsed.data
  const { studentId } = await requireStudent()
  try {
    await upsertStudySession(studentId, setId, stage, state)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** 라운드를 마쳤거나 처음부터 다시 할 때 진행 상태 삭제 */
export async function clearWordStudySession(input: z.infer<typeof KeySchema>): Promise<{ ok: boolean }> {
  const parsed = KeySchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const { studentId } = await requireStudent()
  try {
    await prisma.wordStudySession.deleteMany({
      where: { studentId, setId: parsed.data.setId, stage: parsed.data.stage },
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
