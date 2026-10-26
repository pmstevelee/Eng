import { GrammarClassScreen, parseGrammarClassView } from '@/components/grammar/manage/screens'

// 학원 문제 AI 생성(생성 + 2차 검토)이 30초~1분 걸린다
export const maxDuration = 120

export default async function OwnerGrammarClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams])
  return <GrammarClassScreen role="ACADEMY_OWNER" classId={classId} view={parseGrammarClassView(query.view)} />
}
