'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signIn } from './actions'
import { createClient } from '@/lib/supabase/client'

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  const englishInitials = words
    .map((w) => w.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? '')
    .filter(Boolean)

  if (englishInitials.length > 0) {
    return englishInitials.slice(0, 2).join('')
  }

  return name.slice(0, 2).toUpperCase()
}

interface LoginFormProps {
  academyName: string
}

export default function LoginForm({ academyName }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)
  const [isForgotPending, startForgotTransition] = useTransition()

  const initials = getInitials(academyName)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  const handleForgotPassword = () => {
    if (!forgotEmail.trim()) {
      setForgotMessage('이메일을 입력해 주세요.')
      return
    }
    startForgotTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setForgotMessage('오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      } else {
        setForgotMessage('비밀번호 재설정 링크를 이메일로 전송했습니다.')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* 로고 */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-700 mb-4">
            <span className="text-white font-bold text-xl">{initials}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{academyName}</h1>
          <p className="mt-1.5 text-sm text-gray-500">영어학원 학습관리 시스템</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">로그인</h2>
            <p className="text-sm text-gray-500 mt-1">학원 계정으로 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="이메일을 입력하세요"
                required
                disabled={isPending}
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  비밀번호
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(!showForgot)
                    setForgotMessage(null)
                  }}
                  className="text-xs text-gray-500 hover:text-primary-700 transition-colors"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                required
                disabled={isPending}
                autoComplete="current-password"
              />
            </div>

            {/* 비밀번호 찾기 */}
            {showForgot && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  가입한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="이메일 입력"
                    disabled={isForgotPending}
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleForgotPassword}
                    disabled={isForgotPending}
                    className="shrink-0"
                  >
                    {isForgotPending ? '전송 중...' : '전송'}
                  </Button>
                </div>
                {forgotMessage && (
                  <p
                    className={`text-xs ${forgotMessage.includes('전송했습니다') ? 'text-accent-green' : 'text-accent-red'}`}
                  >
                    {forgotMessage}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-accent-red-light border border-accent-red/20 px-4 py-3 text-sm text-accent-red">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500">
          계정이 없으신가요?{' '}
          <Link
            href="/register"
            className="font-medium text-primary-700 hover:text-primary-600 transition-colors"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  )
}
