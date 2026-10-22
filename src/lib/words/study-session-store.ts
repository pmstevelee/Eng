import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { todayKst } from '@/lib/attendance/time'
import type { StudySessionState, StudyStage } from '@/lib/words/study-session'

/** 학습 단계 진행 상태 저장 (오늘 KST 날짜로 덮어쓴다) */
export async function upsertStudySession(
  studentId: string,
  setId: string,
  stage: StudyStage,
  state: StudySessionState,
): Promise<void> {
  const studyDate = todayKst()
  await prisma.wordStudySession.upsert({
    where: { studentId_setId_stage: { studentId, setId, stage } },
    create: { studentId, setId, stage, studyDate, stateJson: state },
    update: { studyDate, stateJson: state },
  })
}
