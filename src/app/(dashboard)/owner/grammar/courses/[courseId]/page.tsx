import { GrammarCourseEditScreen } from '@/components/grammar/manage/screens'

export default async function OwnerGrammarCourseEditPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  return <GrammarCourseEditScreen courseId={courseId} />
}
