'use client'

import { useState, useEffect, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    const supabase = createClient()

    if (tokenHash && type === 'recovery') {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error: verifyError }) => {
          if (verifyError) {
            setError('링크가 만료되었거나 유효하지 않습니다. 비밀번호 변경 이메일을 다시 요청해주세요.')
          } else {
            setSessionReady(true)
          }
          setVerifying(false)
        })
    } else {
      // 이미 세션이 있는 경우(Supabase가 자동 리다이렉트한 경우)
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSessionReady(true)
        } else {
          setError('유효하지 않은 접근입니다. 비밀번호 변경 이메일을 다시 요청해주세요.')
        }
        setVerifying(false)
      })
    }
  }, [searchParams])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.')
    if (password !== passwordConfirm) return setError('비밀번호가 일치하지 않습니다.')
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.')
      } else {
        await supabase.auth.signOut()
        router.push('/login?passwordChanged=1')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">EduLevel</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">새 비밀번호 설정</h2>
            <p className="text-sm text-gray-500 mt-1">새로운 비밀번호를 입력해주세요</p>
          </div>

          {verifying ? (
            <div className="text-center py-6">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
              <p className="text-sm text-gray-500 mt-3">인증 확인 중…</p>
            </div>
          ) : error && !sessionReady ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <a
                href="/login"
                className="block w-full h-11 rounded-xl text-sm font-medium text-white text-center leading-[44px] transition-colors"
                style={{ backgroundColor: '#1865F2' }}
              >
                로그인으로 돌아가기
              </a>
            </div>
          ) : sessionReady ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  새 비밀번호 <span className="text-xs text-gray-400">(8자 이상)</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#1865F2' } as React.CSSProperties}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700">
                  비밀번호 확인
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#1865F2' } as React.CSSProperties}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full h-11 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#1865F2' }}
              >
                {isPending ? '변경 중…' : '비밀번호 변경'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
