import { GrammarClassScreen } from '@/components/grammar/manage/screens'

// 학원 문제 AI 생성(생성 + 2차 검토)이 30초~1분 걸린다
export const maxDuration = 120

export default async function OwnerGrammarClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  return <GrammarClassScreen role="ACADEMY_OWNER" classId={classId} />
}
