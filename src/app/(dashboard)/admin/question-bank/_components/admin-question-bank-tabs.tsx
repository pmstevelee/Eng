'use client'

import { useState } from 'react'
import { Flag, Share2 } from 'lucide-react'
import type { QuestionReportRow } from '@/lib/questions/report-actions'
import type { AdminQuestionRow, AdminMemberQuestionRow } from '../actions'
import AdminQuestionTable from './admin-question-table'
import QuestionReportsTab from './question-reports-tab'
import MemberQuestionsTab from './member-questions-tab'

type Props = {
  questions: AdminQuestionRow[]
  reports: QuestionReportRow[]
  memberQuestions: AdminMemberQuestionRow[]
}

export default function AdminQuestionBankTabs({ questions, reports, memberQuestions }: Props) {
  const [activeTab, setActiveTab] = useState<'questions' | 'reports' | 'member'>('questions')
  const [editTargetId, setEditTargetId] = useState<string | null>(null)

  const pendingCount = reports.filter((r) => r.status === 'PENDING').length
  const unsharedCount = memberQuestions.filter((q) => !q.isShared).length

  function handleEditQuestion(questionId: string) {
    setEditTargetId(questionId)
    setActiveTab('questions')
    // AdminQuestionTable이 마운트된 후 해당 행을 열도록 이벤트 전달
    // (실제 편집은 AdminQuestionTable 내부 edit 버튼으로 처리)
    setTimeout(() => {
      const row = document.querySelector(`[data-question-id="${questionId}"]`)
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function handleDeleteQuestion(questionId: string) {
    setEditTargetId(questionId)
    setActiveTab('questions')
    setTimeout(() => {
      const row = document.querySelector(`[data-question-id="${questionId}"]`)
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  return (
    <div className="space-y-4">
      {/* 탭 헤더 */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'questions'
              ? 'border-[#1865F2] text-[#1865F2]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          공용 문제 목록
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'reports'
              ? 'border-[#1865F2] text-[#1865F2]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Flag className="h-3.5 w-3.5" />
          오류 신고
          {pendingCount > 0 && (
            <span className="rounded-full bg-[#D92916] px-1.5 py-0.5 text-xs font-bold text-white leading-none">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('member')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'member'
              ? 'border-[#1865F2] text-[#1865F2]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Share2 className="h-3.5 w-3.5" />
          회원 문제 공유
          {unsharedCount > 0 && (
            <span className="rounded-full bg-[#1865F2] px-1.5 py-0.5 text-xs font-bold text-white leading-none">
              {unsharedCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'questions' && (
        <AdminQuestionTable initialQuestions={questions} highlightId={editTargetId} />
      )}
      {activeTab === 'reports' && (
        <QuestionReportsTab
          reports={reports}
          onEditQuestion={handleEditQuestion}
          onDeleteQuestion={handleDeleteQuestion}
        />
      )}
      {activeTab === 'member' && <MemberQuestionsTab questions={memberQuestions} />}
    </div>
  )
}
