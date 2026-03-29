'use client'

import { useState, useTransition, useEffect } from 'react'
import { X, Pencil, Eye, EyeOff } from 'lucide-react'
import { updateStudentProfile } from '../actions'
import { GRADE_OPTIONS } from './grade-options'

type StudentToEdit = {
  id: string
  name: string
  email: string
  grade?: number | null
}

type Props = {
  student: StudentToEdit | null
  onClose: () => void
}

export default function EditStudentDialog({ student, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [grade, setGrade] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // student가 바뀔 때 폼 초기화
  useEffect(() => {
    if (student) {
      setName(student.name)
      setEmail(student.email)
      setGrade(student.grade ? String(student.grade) : '')
      setPassword('')
      setShowPassword(false)
      setError('')
    }
  }, [student])

  if (!student) return null

  const handleClose = () => {
    setError('')
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await updateStudentProfile(student.id, {
        name: name.trim(),
        email: email.trim(),
        grade: grade ? parseInt(grade) : undefined,
        password: password || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-primary-700" />
            <h2 className="text-lg font-semibold text-gray-900">학생 정보 수정</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이름 <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일 (로그인 아이디) <span className="text-accent-red">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">변경 시 로그인 아이디도 변경됩니다.</p>
          </div>

          {/* 학년 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">학년</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              <option value="">미입력</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* 새 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="변경하지 않으면 비워두세요"
                minLength={password.length > 0 ? 6 : undefined}
                className="w-full h-11 px-3 pr-10 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">변경할 경우 최소 6자 이상 입력하세요.</p>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-sm text-accent-red bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-11 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
            >
              {isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
