'use client'

import { useTransition, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { deleteStudent } from '../actions'

type StudentToDelete = { id: string; name: string }

type Props = {
  student: StudentToDelete | null
  onClose: () => void
}

export default function DeleteStudentDialog({ student, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (!student) return null

  const handleDelete = () => {
    setError('')
    startTransition(async () => {
      const result = await deleteStudent(student.id)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">학생 탈퇴 처리</h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle size={20} className="text-accent-red flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-accent-red">이 작업은 되돌릴 수 없습니다.</p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{student.name}</span> 학생의 모든 데이터가 영구 삭제됩니다.
              </p>
              <ul className="text-xs text-gray-500 mt-2 space-y-0.5 list-disc list-inside">
                <li>테스트 응시 기록 및 점수</li>
                <li>출석 기록</li>
                <li>교사 코멘트</li>
                <li>학습 경로 및 배지</li>
                <li>로그인 계정</li>
              </ul>
            </div>
          </div>

          {error && (
            <p className="text-sm text-accent-red bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 h-11 rounded-xl bg-accent-red text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '삭제 중...' : '탈퇴 처리'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
