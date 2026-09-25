import { getConsultationActor } from '@/lib/consultation/access'
import { appBaseUrl } from '@/lib/consultation/app-url'
import { getAssigneeOptions } from '@/lib/consultation/queries'
import { getStudentConsultationData } from '@/lib/consultation/student-consultation-queries'
import { StudentConsultationSection } from './student-consultation-section'

/** 학생 상세의 "상담" 영역 (서버에서 권한 확인 후 데이터 조회) — 학원장 섹션 / 교사 탭 공용 */
export async function StudentConsultationPanel({ studentId }: { studentId: string }) {
  const actor = await getConsultationActor()
  if (!actor) return null
  const data = await getStudentConsultationData(actor, studentId, appBaseUrl())
  if (!data) return null
  const counselorOptions = data.academyId ? await getAssigneeOptions(actor, data.academyId) : []

  return (
    <StudentConsultationSection
      data={data}
      isOwner={actor.role === 'ACADEMY_OWNER'}
      consultationBasePath={actor.role === 'ACADEMY_OWNER' ? '/owner/consultations' : '/teacher/consultations'}
      counselorOptions={counselorOptions}
      currentUserId={actor.userId}
    />
  )
}
