// 문법 문항 미리보기 — 본문·보기(정답 표시)·해설. 관리자 태깅·문항 검수 화면 공용
import { Check } from 'lucide-react'
import { getQuestionPreview } from '@/lib/grammar/question-tagging'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸',
  fill_in_blank: '빈칸',
  short_answer: '단답',
  sentence_order: '순서',
  word_bank: '단어박스',
  question_set: '복합',
  essay: '서술',
}

export function questionTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type
}

export function QuestionPreview({ contentJson, showExplanation = false }: { contentJson: unknown; showExplanation?: boolean }) {
  const p = getQuestionPreview(contentJson)
  return (
    <div className="min-w-0 space-y-2">
      {p.textKo && <p className="text-xs text-gray-500">{p.textKo}</p>}
      <p className="whitespace-pre-line break-words text-sm text-gray-900">{p.text || '(본문 없음)'}</p>
      {p.options.length > 0 ? (
        <ol className="grid gap-1 sm:grid-cols-2">
          {p.options.map((o, i) => (
            <li
              key={i}
              className={cn(
                'flex items-start gap-1.5 rounded-lg px-2 py-1 text-sm',
                i === p.answerIndex ? 'bg-[#E8F7EE] font-medium text-[#15803D]' : 'text-gray-700',
              )}
            >
              <span className="shrink-0 font-mono text-xs leading-5 text-gray-400">{String.fromCharCode(65 + i)}</span>
              <span className="min-w-0 break-words">{o}</span>
              {i === p.answerIndex && <Check className="ml-auto h-4 w-4 shrink-0" aria-label="정답" />}
            </li>
          ))}
        </ol>
      ) : (
        p.answer && (
          <p className="text-sm">
            <span className="text-gray-500">정답 </span>
            <span className="rounded bg-[#E8F7EE] px-1.5 py-0.5 font-medium text-[#15803D]">{p.answer}</span>
          </p>
        )
      )}
      {showExplanation && p.explanation && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">{p.explanation}</p>
      )}
    </div>
  )
}
