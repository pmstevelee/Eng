import { RotateCcw } from 'lucide-react'
import { GrammarComingSoon } from '../_components/coming-soon'

export default function StudentGrammarReviewPage() {
  return (
    <GrammarComingSoon
      icon={RotateCcw}
      title="복습 화면을 준비하고 있어요"
      description="통과한 단원을 3일·7일 뒤에 다시 풀어 보는 복습이 곧 열려요."
    />
  )
}
