'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, RefreshCw, Share2, MessageCircle, Mail, Smartphone } from 'lucide-react'
import { regenerateInviteCode } from '../actions'

type Props = {
  inviteCode: string
}

export function InviteCodeSection({ inviteCode: initialCode }: Props) {
  const [code, setCode] = useState(initialCode)
  const [copied, setCopied] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API 실패 시 폴백
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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

  const shareMessage = `영어학원 초대코드: ${code}\n앱에서 이 코드를 입력하여 가입하세요.`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: '학원 초대코드', text: shareMessage })
      } catch {
        // 공유 취소 시 무시
      }
    } else {
      handleCopy()
    }
  }

  const handleSMSShare = () => {
    const encoded = encodeURIComponent(shareMessage)
    window.location.href = `sms:?body=${encoded}`
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent('학원 초대코드 안내')
    const body = encodeURIComponent(shareMessage)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">초대 코드</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          학생이 이 코드로 가입하면 자동으로 학원에 등록됩니다.
        </p>
      </div>

      {error && (
        <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* 코드 표시 영역 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-50 rounded-xl px-5 py-4 border border-gray-200">
          <p className="text-3xl font-bold font-mono tracking-[0.2em] text-gray-900 text-center">
            {code}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors flex-shrink-0 ${
            copied
              ? 'bg-accent-green-light border-accent-green text-accent-green'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
          title="코드 복사"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>

      {/* 공유 버튼들 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSMSShare}
          className="flex items-center gap-2 px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Smartphone size={15} className="text-accent-green" />
          문자 공유
        </button>
        <button
          onClick={handleEmailShare}
          className="flex items-center gap-2 px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Mail size={15} className="text-primary-700" />
          이메일 공유
        </button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Share2 size={15} className="text-accent-purple" />
            공유하기
          </button>
        )}
      </div>

      {/* 코드 재생성 */}
      <div className="pt-3 border-t border-gray-100">
        {!showRegenConfirm ? (
          <button
            onClick={() => setShowRegenConfirm(true)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw size={14} />
            초대 코드 재생성
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              코드를 재생성하면 기존 코드가 즉시 <span className="font-medium text-accent-red">무효화</span>됩니다.
              기존 코드로는 더 이상 가입할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={14} className={isPending ? 'animate-spin' : ''} />
                {isPending ? '생성 중…' : '재생성 확인'}
              </button>
              <button
                onClick={() => setShowRegenConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
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
