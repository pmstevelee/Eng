'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TodoItem {
  id: string
  label: string
  badge?: string
  badgeColor?: string
}

interface TeacherTodoProps {
  pendingGradingCount: number
  publishedTestCount: number
  lowScoreStudentCount: number
}

export function TeacherTodo({
  pendingGradingCount,
  publishedTestCount,
  lowScoreStudentCount,
}: TeacherTodoProps) {
  const initialItems: TodoItem[] = [
    {
      id: 'grading',
      label: '채점 대기 답안 확인',
      badge: pendingGradingCount > 0 ? `${pendingGradingCount}개` : undefined,
      badgeColor: 'bg-accent-red-light text-accent-red',
    },
    {
      id: 'tests',
      label: '출제된 테스트 결과 분석',
      badge: publishedTestCount > 0 ? `${publishedTestCount}개` : undefined,
      badgeColor: 'bg-primary-100 text-primary-700',
    },
    {
      id: 'feedback',
      label: '부진 학생 피드백 작성',
      badge: lowScoreStudentCount > 0 ? `${lowScoreStudentCount}명` : undefined,
      badgeColor: 'bg-accent-gold-light text-[#B37D00]',
    },
    { id: 'plan', label: '다음 수업 계획 준비' },
    { id: 'comm', label: '학부모 알림 발송 확인' },
  ]

  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const doneCount = checked.size
  const totalCount = initialItems.length
  const progress = Math.round((doneCount / totalCount) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList size={16} className="text-primary-700" />
            오늘의 할일
          </CardTitle>
          <span className="text-xs text-gray-500">
            {doneCount}/{totalCount} 완료
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary-700 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {initialItems.map((item) => {
          const isDone = checked.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
            >
              {isDone ? (
                <CheckCircle2 size={18} className="shrink-0 text-accent-green" />
              ) : (
                <Circle size={18} className="shrink-0 text-gray-300" />
              )}
              <span
                className={`flex-1 text-sm ${
                  isDone ? 'text-gray-400 line-through' : 'text-gray-900'
                }`}
              >
                {item.label}
              </span>
              {item.badge && !isDone && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
