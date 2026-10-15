'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { verifyInviteCode, getDefaultInviteCode } from '../actions'
import { registerStudent } from './actions'
import type { RegisterStudentData } from './actions'
import { LearningLevelPicker } from '@/components/shared/learning-level-picker'
import { STUDENT_GRADE_OPTIONS, getRecommendedLevel } from '@/lib/constants/student-profile'

type Step = 1 | 2 | 3 | 4

const STEP_LABELS = ['초대 코드', '기본 정보', '학습 설문', '약관 동의']

function StepIndicator({ current }: { current: number }) {
  const total = STEP_LABELS.length
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Step {current}/{total}</span>
        <span>{STEP_LABELS[current - 1]}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default function RegisterStudentPage() {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Step 1
  const [inviteCode, setInviteCode] = useState('')
  const [academyId, setAcademyId] = useState('')
  const [academyName, setAcademyName] = useState('')
  const [noInviteCode, setNoInviteCode] = useState(false)
  const [defaultCode, setDefaultCode] = useState<string | null>(null)
  const [defaultCodeError, setDefaultCodeError] = useState<string | null>(null)
  const [isDefaultCodePending, startDefaultCodeTransition] = useTransition()

  // Step 2
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  // Step 3 (학습 설문)
  const [grade, setGrade] = useState('')
  const [learningLevel, setLearningLevel] = useState<number | null>(null)
  // 학생이 직접 레벨을 고르기 전까지는 학년 추천 레벨을 따라간다
  const [levelTouched, setLevelTouched] = useState(false)

  // Step 4
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedMarketing, setAgreedMarketing] = useState(false)

  const goNext = (next: Step) => { setError(null); setStep(next) }
  const goPrev = (prev: Step) => { setError(null); setStep(prev) }

  const handleStep1 = () => {
    if (!inviteCode.trim()) return setError('초대 코드를 입력해 주세요.')
    startTransition(async () => {
      const result = await verifyInviteCode(inviteCode)
      if ('error' in result) {
        setError(result.error)
      } else {
        setAcademyId(result.academyId)
        setAcademyName(result.businessName)
        goNext(2)
      }
    })
  }

  const handleNoInviteCodeChange = (checked: boolean) => {
    setNoInviteCode(checked)
    setError(null)
    if (!checked || defaultCode) return
    setDefaultCodeError(null)
    startDefaultCodeTransition(async () => {
      const result = await getDefaultInviteCode()
      if ('error' in result) setDefaultCodeError(result.error)
      else setDefaultCode(result.code)
    })
  }

  const handleStep2 = () => {
    if (!name.trim()) return setError('이름을 입력해 주세요.')
    if (!email.trim()) return setError('이메일을 입력해 주세요.')
    if (!password) return setError('비밀번호를 입력해 주세요.')
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.')
    if (password !== passwordConfirm) return setError('비밀번호가 일치하지 않습니다.')
    goNext(3)
  }

  const handleGradeChange = (value: string) => {
    setGrade(value)
    if (!levelTouched && value) setLearningLevel(getRecommendedLevel(value))
  }

  const handleLevelChange = (level: number) => {
    setLevelTouched(true)
    setLearningLevel(level)
  }

  const handleStep3 = () => {
    if (!grade) return setError('학년을 선택해 주세요.')
    if (!learningLevel) return setError('원하는 학습레벨을 선택해 주세요.')
    goNext(4)
  }

  const handleSubmit = () => {
    if (!agreedTerms) return setError('이용약관에 동의해 주세요.')
    if (!agreedPrivacy) return setError('개인정보 처리방침에 동의해 주세요.')
    if (!learningLevel) return setError('원하는 학습레벨을 선택해 주세요.')
    setError(null)

    const data: RegisterStudentData = {
      name, email, password, grade, learningLevel, academyId,
      agreedTerms, agreedPrivacy, agreedMarketing,
    }
    startTransition(async () => {
      const result = await registerStudent(data)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">학생 가입</h1>
          <p className="mt-1 text-sm text-muted-foreground">초대 코드로 학원에 합류하세요</p>
        </div>

        <StepIndicator current={step} />

        <Card>
          {/* ── Step 1: 초대 코드 ── */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>초대 코드 입력</CardTitle>
                <CardDescription>학원에서 받은 초대 코드를 입력하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">초대 코드</Label>
                  <Input
                    id="inviteCode"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    disabled={isPending}
                    maxLength={9}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noInviteCode}
                    onChange={(e) => handleNoInviteCodeChange(e.target.checked)}
                    disabled={isPending}
                    className="h-4 w-4 cursor-pointer accent-primary shrink-0"
                  />
                  <span className="text-sm text-gray-700">초대 코드가 없어요</span>
                </label>
                {noInviteCode && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <p className="text-sm text-gray-600">
                      아래 <span className="font-medium text-gray-900">위고업잉글리시</span> 초대
                      코드로 가입할 수 있습니다.
                    </p>
                    {isDefaultCodePending ? (
                      <p className="text-sm text-gray-500">초대 코드를 불러오는 중...</p>
                    ) : defaultCodeError ? (
                      <p className="text-sm text-accent-red">{defaultCodeError}</p>
                    ) : (
                      defaultCode && (
                        <div className="flex items-center gap-2">
                          <span className="flex h-11 flex-1 items-center justify-center rounded-md border border-gray-200 bg-white font-mono text-lg tracking-widest text-gray-900">
                            {defaultCode}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => { setInviteCode(defaultCode); setError(null) }}
                            disabled={isPending}
                          >
                            이 코드 사용
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button className="w-full" onClick={handleStep1} disabled={isPending}>
                  {isPending ? '확인 중...' : '코드 확인'}
                </Button>
              </CardContent>
            </>
          )}

          {/* ── Step 2: 기본 정보 ── */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>기본 정보</CardTitle>
                <CardDescription>
                  <span className="font-medium text-foreground">{academyName}</span>에 학생으로 가입합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름 *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">이메일 *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    disabled={isPending}
                    autoComplete="email"
                  />
                  <p className="text-xs text-muted-foreground">
                    다른 학원에 이미 가입했다면 같은 이메일과 기존 비밀번호를 입력하세요. 이
                    학원이 계정에 추가되며, 학습 기록은 학원별로 따로 관리됩니다.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호 * (8자 이상)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm">비밀번호 확인 *</Label>
                  <Input
                    id="passwordConfirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    disabled={isPending}
                  />
                </div>
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => goPrev(1)}>
                    이전
                  </Button>
                  <Button className="flex-1" onClick={handleStep2} disabled={isPending}>
                    다음
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 3: 학습 설문 ── */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>학습 설문</CardTitle>
                <CardDescription>
                  학년과 시작하고 싶은 학습레벨을 알려주세요. 단어·학습 문제가 이 레벨에 맞춰
                  준비됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="grade">학년 *</Label>
                  <select
                    id="grade"
                    value={grade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    disabled={isPending}
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">학년을 선택하세요</option>
                    {STUDENT_GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>원하는 학습레벨 *</Label>
                  <p className="text-xs text-muted-foreground">
                    잘 모르겠다면 학년 추천 레벨을 선택하세요. 레벨 테스트를 보기 전까지는
                    설정에서 언제든 바꿀 수 있고, 레벨 테스트 후에는 테스트 결과로 정해집니다.
                  </p>
                  <LearningLevelPicker
                    value={learningLevel}
                    onChange={handleLevelChange}
                    recommendedLevel={grade ? getRecommendedLevel(grade) : null}
                    disabled={isPending}
                  />
                </div>
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => goPrev(2)}>
                    이전
                  </Button>
                  <Button className="flex-1" onClick={handleStep3} disabled={isPending}>
                    다음
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 4: 약관 동의 ── */}
          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>약관 동의</CardTitle>
                <CardDescription>서비스 이용을 위해 동의해 주세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-primary shrink-0"
                    />
                    <span className="text-sm leading-snug">
                      <span className="font-medium text-primary">[필수]</span>{' '}
                      <Link
                        href="/terms"
                        className="underline underline-offset-2 hover:text-primary"
                        target="_blank"
                      >
                        이용약관
                      </Link>
                      에 동의합니다
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedPrivacy}
                      onChange={(e) => setAgreedPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-primary shrink-0"
                    />
                    <span className="text-sm leading-snug">
                      <span className="font-medium text-primary">[필수]</span>{' '}
                      <Link
                        href="/privacy"
                        className="underline underline-offset-2 hover:text-primary"
                        target="_blank"
                      >
                        개인정보 처리방침
                      </Link>
                      에 동의합니다
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedMarketing}
                      onChange={(e) => setAgreedMarketing(e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-primary shrink-0"
                    />
                    <span className="text-sm leading-snug text-muted-foreground">
                      [선택] 마케팅 정보 수신에 동의합니다
                    </span>
                  </label>
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => goPrev(3)}
                    disabled={isPending}
                  >
                    이전
                  </Button>
                  <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
                    {isPending ? '가입 처리 중...' : '가입 완료'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
