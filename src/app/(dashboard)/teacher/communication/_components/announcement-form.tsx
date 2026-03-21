'use client'

import { useRef, useState, useTransition } from 'react'
import { Send, Users, GraduationCap, ChevronDown } from 'lucide-react'
import { createAnnouncement } from '../actions'

type ClassOption = { id: string; name: string }

interface Props {
  classes: ClassOption[]
}

export function AnnouncementForm({ classes }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<'ALL_STUDENTS' | 'CLASS'>('ALL_STUDENTS')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    formData.set('target', target)

    startTransition(async () => {
      const result = await createAnnouncement(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        formRef.current?.reset()
        setTarget('ALL_STUDENTS')
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* 제목 */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1.5">
          제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="공지사항 제목을 입력하세요"
          className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-colors"
        />
      </div>

      {/* 내용 */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1.5">
          내용
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={5}
          placeholder="공지사항 내용을 입력하세요"
          className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-colors resize-none"
        />
      </div>

      {/* 발송 대상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setTarget('ALL_STUDENTS')}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium border transition-colors ${
              target === 'ALL_STUDENTS'
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users size={15} />
            전체 학생
          </button>
          <button
            type="button"
            onClick={() => setTarget('CLASS')}
            disabled={classes.length === 0}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              target === 'CLASS'
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <GraduationCap size={15} />
            특정 반
          </button>
        </div>

        {target === 'CLASS' && classes.length > 0 && (
          <div className="relative">
            <select
              name="classId"
              required
              defaultValue=""
              className="w-full h-11 pl-3 pr-10 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 appearance-none bg-white transition-colors"
            >
              <option value="" disabled>
                반을 선택하세요
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* 에러/성공 메시지 */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-accent-red">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-sm text-accent-green font-medium">
          공지사항이 성공적으로 발송되었습니다.
        </div>
      )}

      {/* 발송 버튼 */}
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 w-full h-11 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <Send size={15} />
        {isPending ? '발송 중...' : '공지사항 발송'}
      </button>
    </form>
  )
}
