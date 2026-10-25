import { NotebookPen } from 'lucide-react'
import { GrammarComingSoon } from '../_components/coming-soon'

export default function StudentGrammarWrongNotesPage() {
  return (
    <GrammarComingSoon
      icon={NotebookPen}
      title="오답노트를 준비하고 있어요"
      description="틀린 문제를 단원별로 모아 다시 풀어 보는 오답노트가 곧 열려요."
    />
  )
}
