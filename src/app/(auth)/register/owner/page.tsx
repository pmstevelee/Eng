'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { registerOwner } from './actions'
import type { RegisterOwnerData } from './actions'

type Step = 1 | 2 | 3 | 4 | 5

const STEP_LABELS = ['기본 정보', '학원 정보', '약관 동의', '요금제 선택']

const PLANS = [
  {
    id: 'BASIC' as const,
    name: 'Basic',
    price: '29,000',
    students: 30,
    teachers: 3,
    features: ['기본 레벨 테스트', '학생 관리', '출석 관리'],
  },
  {
    id: 'STANDARD' as const,
    name: 'Standard',
    price: '69,000',
    students: 100,
    teachers: 10,
    features: ['Basic 기능 전체', '단원 테스트', '학습 리포트', 'AI 추천'],
    recommended: true,
  },
  {
    id: 'PREMIUM' as const,
    name: 'Premium',
    price: '129,000',
    students: 300,
    teachers: 30,
    features: ['Standard 기능 전체', '무제한 테스트', 'AI 심층 분석', '맞춤 학습 경로'],
  },
]

function StepIndicator({ current }: { current: number }) {
  const total = 4
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

export default function RegisterOwnerPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [completedCode, setCompletedCode] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2
  const [businessName, setBusinessName] = useState('')
  const [academyAddress, setAcademyAddress] = useState('')
  const [academyPhone, setAcademyPhone] = useState('')

  // Step 3
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedMarketing, setAgreedMarketing] = useState(false)

  // Step 4
  const [planType, setPlanType] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('STANDARD')

  const goNext = (nextStep: Step) => {
    setError(null)
    setStep(nextStep)
  }

  const goPrev = (prevStep: Step) => {
    setError(null)
    setStep(prevStep)
  }

  const handleStep1 = () => {
    if (!name.trim()) return setError('이름을 입력해 주세요.')
    if (!email.trim()) return setError('이메일을 입력해 주세요.')
    if (!password) return setError('비밀번호를 입력해 주세요.')
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.')
    if (password !== passwordConfirm) return setError('비밀번호가 일치하지 않습니다.')
    goNext(2)
  }

  const handleStep2 = () => {
    if (!businessName.trim()) return setError('상호명을 입력해 주세요.')
    goNext(3)
  }

  const handleStep3 = () => {
    if (!agreedTerms) return setError('이용약관에 동의해 주세요.')
    if (!agreedPrivacy) return setError('개인정보 처리방침에 동의해 주세요.')
    goNext(4)
  }

  const handleStep4 = () => {
    const data: RegisterOwnerData = {
      name,
      email,
      password,
      phone,
      businessName,
      academyAddress,
      academyPhone,
      agreedTerms,
      agreedPrivacy,
      agreedMarketing,
      planType,
    }
    startTransition(async () => {
      const result = await registerOwner(data)
      if ('error' in result) {
        setError(result.error)
      } else {
        setCompletedCode(result.inviteCode)
        setStep(5)
      }
    })
  }

  const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`

  // 완료 화면
  if (step === 5) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="text-6xl">🎉</div>
            <h1 className="text-2xl font-bold">가입이 완료되었습니다!</h1>
            <p className="text-sm text-muted-foreground">
              14일 무료 체험이 시작되었습니다
            </p>
          </div>

          <Card>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-base">학원 초대 코드</CardTitle>
              <CardDescription className="text-xs">
                교사와 학생에게 이 코드를 알려주세요
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="text-4xl font-bold tracking-widest text-primary py-3 bg-muted/50 rounded-lg">
                {formatCode(completedCode)}
              </div>
              <p className="text-xs text-muted-foreground">
                대시보드의 학원 설정에서 언제든지 확인할 수 있습니다
              </p>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={() => router.push('/owner')}>
            대시보드로 이동
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">학원장 가입</h1>
          <p className="mt-1 text-sm text-muted-foreground">학원을 등록하고 관리를 시작하세요</p>
        </div>

        <StepIndicator current={step} />

        <Card>
          {/* ── Step 1: 기본 정보 ── */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>기본 정보</CardTitle>
                <CardDescription>학원장의 기본 정보를 입력하세요</CardDescription>
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
                <div className="space-y-2">
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    disabled={isPending}
                  />
                </div>
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button className="w-full" onClick={handleStep1} disabled={isPending}>
                  다음
                </Button>
              </CardContent>
            </>
          )}

          {/* ── Step 2: 학원 정보 ── */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>학원 정보</CardTitle>
                <CardDescription>학원 기본 정보를 입력하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">상호명 *</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="해피잉글리시"
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    모든 페이지 상단에 학원 이름으로 표시됩니다
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academyAddress">학원 주소 (선택)</Label>
                  <Input
                    id="academyAddress"
                    value={academyAddress}
                    onChange={(e) => setAcademyAddress(e.target.value)}
                    placeholder="서울시 강남구 ..."
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academyPhone">학원 전화번호 (선택)</Label>
                  <Input
                    id="academyPhone"
                    type="tel"
                    value={academyPhone}
                    onChange={(e) => setAcademyPhone(e.target.value)}
                    placeholder="02-0000-0000"
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

          {/* ── Step 3: 약관 동의 ── */}
          {step === 3 && (
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

          {/* ── Step 4: 요금제 선택 ── */}
          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>요금제 선택</CardTitle>
                <CardDescription>모든 요금제는 14일 무료 체험으로 시작합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {PLANS.map((plan) => (
                    <label
                      key={plan.id}
                      className={`flex gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        planType === plan.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={planType === plan.id}
                        onChange={() => setPlanType(plan.id)}
                        className="mt-1 accent-primary shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{plan.name}</span>
                          {plan.recommended && (
                            <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                              추천
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          월 {plan.price}원 · 학생 {plan.students}명 · 교사 {plan.teachers}명
                        </p>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {plan.features.map((f) => (
                            <li key={f}>✓ {f}</li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-center text-muted-foreground">
                  🎁 무료 체험 기간 동안 Premium 기능을 모두 이용하실 수 있습니다
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
                  <Button
                    className="flex-1"
                    onClick={handleStep4}
                    disabled={isPending}
                  >
                    {isPending ? '처리 중...' : '14일 무료 체험 시작'}
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
