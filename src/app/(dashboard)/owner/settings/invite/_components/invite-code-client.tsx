'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { regenerateInviteCode } from '../../actions'

type Props = {
  inviteCode: string
  teacherCount: number
  studentCount: number
}

export function InviteCodeClient({ inviteCode: initialCode, teacherCount, studentCount }: Props) {
  const [code, setCode] = useState(initialCode)
  const [copied, setCopied] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    setError(null)
    startTransition(async () => {
      const res = await regenerateInviteCode()
      if (res.error) {
        setError(res.error)
      } else if (res.code) {
        setCode(res.code)
      }
      setShowRegenConfirm(false)
    })
  }

  return (
    <div className="space-y-6">
      {/* 코드 표시 */}
      <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200 space-y-4">
        <p className="text-sm text-gray-500">초대 코드</p>
        <p
          className="text-4xl font-bold tracking-[0.3em]"
          style={{ color: '#1865F2' }}
        >
          {code}
        </p>
        <button
          onClick={handleCopy}
          className={`
            inline-flex items-center gap-2 h-11 px-5 rounded-xl border text-sm font-medium transition-colors
            ${copied
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          {copied ? (
            <>
              <Check size={15} />
              복사되었습니다!
            </>
          ) : (
            <>
              <Copy size={15} />
              복사
            </>
          )}
        </button>
      </div>

      {/* 가입 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">교사 {teacherCount}명</span>
          {', '}
          <span className="font-semibold text-gray-900">학생 {studentCount}명</span>
          이 이 코드로 가입했습니다
        </p>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 rounded-xl px-5 py-4 border border-blue-100">
        <p className="text-sm text-gray-700" style={{ color: '#2C4A7C' }}>
          이 코드를 교사와 학생에게 알려주세요. 이 코드로 우리 학원에 가입할 수 있습니다.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* 코드 재생성 */}
      <div className="border-t border-gray-100 pt-5">
        {!showRegenConfirm ? (
          <button
            onClick={() => setShowRegenConfirm(true)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw size={14} />
            코드 재생성
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-800">
                <span className="font-medium">주의:</span> 기존 코드는 즉시 무효화됩니다.
                기존 코드를 알고 있던 사람은 더 이상 이 코드로 가입할 수 없습니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex items-center gap-2 h-11 px-5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#1865F2' }}
              >
                <RefreshCw size={14} className={isPending ? 'animate-spin' : ''} />
                {isPending ? '생성 중…' : '재생성 확인'}
              </button>
              <button
                onClick={() => setShowRegenConfirm(false)}
                className="h-11 px-5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
