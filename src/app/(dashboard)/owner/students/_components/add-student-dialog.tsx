'use client'

import { useState, useTransition } from 'react'
import { X, Eye, EyeOff, RefreshCw, UserPlus } from 'lucide-react'
import { createStudent } from '../actions'
import { GRADE_OPTIONS } from './grade-options'

type ClassOption = { id: string; name: string }

type Props = {
  open: boolean
  onClose: () => void
  classes: ClassOption[]
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function AddStudentDialog({ open, onClose, classes }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    classId: '',
    grade: '',
    currentLevel: '1',
    joinedAt: today,
  })

  if (!open) return null

  const handleClose = () => {
    setError('')
    setForm({ name: '', email: '', password: '', classId: '', grade: '', currentLevel: '1', joinedAt: today })
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createStudent({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        classId: form.classId || undefined,
        grade: form.grade ? parseInt(form.grade) : undefined,
        currentLevel: parseInt(form.currentLevel),
        joinedAt: form.joinedAt || undefined,
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
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary-700" />
            <h2 className="text-lg font-semibold text-gray-900">학생 직접 추가</h2>
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="홍길동"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이메일 (로그인 아이디) <span className="text-accent-red">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="student@example.com"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호 <span className="text-accent-red">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="최소 6자 이상"
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
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, password: generatePassword() })
                  setShowPassword(true)
                }}
                className="h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw size={13} />
                자동생성
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">학생이 처음 로그인할 때 사용할 비밀번호입니다.</p>
          </div>

          {/* 반 + 학년 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">반</label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                <option value="">미배정</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">학년</label>
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                <option value="">–</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 레벨 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">시작 레벨</label>
            <select
              value={form.currentLevel}
              onChange={(e) => setForm({ ...form, currentLevel: e.target.value })}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((l) => (
                <option key={l} value={l}>Lv.{l}</option>
              ))}
            </select>
          </div>

          {/* 가입일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">가입일</label>
            <input
              type="date"
              value={form.joinedAt}
              onChange={(e) => setForm({ ...form, joinedAt: e.target.value })}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
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
              {isPending ? '추가 중...' : '학생 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
