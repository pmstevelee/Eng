'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CloudOff, Delete, Info, Loader2, Maximize, ShieldOff, XCircle } from 'lucide-react'
import type {
  KioskCheckRequest,
  KioskCheckResponse,
  KioskCheckResult,
  KioskSessionChoice,
  KioskStudentChoice,
} from '@/lib/attendance/kiosk-types'
import { KIOSK_EARLY_CHECK_MIN } from '@/lib/attendance/kiosk-types'
import { cn } from '@/lib/utils'
import { countQueuedChecks, enqueueCheck, listQueuedChecks, removeQueuedCheck } from './offline-queue'

const CODE_LENGTH = 4
const REQUEST_TIMEOUT_MS = 8000
const CHOICE_TIMEOUT_MS = 20_000
const PARTIAL_INPUT_TIMEOUT_MS = 15_000
const FLUSH_INTERVAL_MS = 20_000

type MessageTone = 'success' | 'info' | 'error' | 'saved'

type Screen =
  | { kind: 'input' }
  | { kind: 'loading' }
  | { kind: 'chooseStudent'; code: string; students: KioskStudentChoice[] }
  | { kind: 'chooseSession'; code: string; studentId: string; name: string; sessions: KioskSessionChoice[] }
  | { kind: 'message'; tone: MessageTone; title: string; subtitle?: string; durationMs: number }
  | { kind: 'revoked' }

/** 전송 결과 — 네트워크 실패·서버 오류는 'offline'(대기열 저장 대상) */
type SendOutcome =
  | { kind: 'ok'; result: KioskCheckResult }
  | { kind: 'offline' }
  | { kind: 'revoked' }
  | { kind: 'rateLimited' }
  | { kind: 'invalid' }

const TIME_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const CLOCK_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})
const DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

function formatTime(iso: string): string {
  return TIME_FMT.format(new Date(iso))
}

function resultToMessage(result: KioskCheckResult): Extract<Screen, { kind: 'message' }> | null {
  switch (result.kind) {
    case 'NOT_FOUND':
      return { kind: 'message', tone: 'error', title: '등록되지 않은 번호입니다', subtitle: '번호를 다시 확인해주세요', durationMs: 2000 }
    case 'CHECKED_IN':
      return {
        kind: 'message',
        tone: 'success',
        title: `${result.name} 학생, 반가워요!`,
        subtitle: `등원 ${formatTime(result.at)}${result.className ? ` · ${result.className}` : ''}`,
        durationMs: 3000,
      }
    case 'CHECKED_OUT':
      return {
        kind: 'message',
        tone: 'success',
        title: `${result.name} 학생, 수고했어요!`,
        subtitle: `하원 ${formatTime(result.at)}`,
        durationMs: 3000,
      }
    case 'ALREADY':
      return {
        kind: 'message',
        tone: 'info',
        title: result.what === 'CHECKED_OUT' ? '이미 하원했어요' : '이미 출석했어요',
        subtitle: `${result.name} 학생`,
        durationMs: 2500,
      }
    case 'IGNORED':
      return { kind: 'message', tone: 'info', title: '이미 등원했어요', subtitle: `${result.name} 학생`, durationMs: 2000 }
    case 'NO_SESSION':
      return {
        kind: 'message',
        tone: 'info',
        title: '지금 출석할 수 있는 수업이 없어요',
        subtitle: `${result.name} 학생 · 수업 시작 ${KIOSK_EARLY_CHECK_MIN}분 전부터 출석할 수 있어요`,
        durationMs: 3000,
      }
    default:
      return null
  }
}

export function KioskKeypad({ academyName }: { academyName: string }) {
  const [digits, setDigits] = useState('')
  const [screen, setScreen] = useState<Screen>({ kind: 'input' })
  const [pendingCount, setPendingCount] = useState(0)
  const [online, setOnline] = useState(true)
  const [nowMs, setNowMs] = useState<number | null>(null)
  const [canFullscreen, setCanFullscreen] = useState(false)

  /** 서버 시각 − 기기 시각 (오프라인 입력 시각 보정용) */
  const clockOffsetRef = useRef(0)
  const flushingRef = useRef<Promise<boolean> | null>(null)

  // 연속 입력이 같은 렌더 안에서 들어와도 자릿수가 빠지지 않도록 ref로 누적
  const digitsRef = useRef('')
  const updateDigits = useCallback((value: string) => {
    digitsRef.current = value
    setDigits(value)
  }, [])

  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, [])

  // ── 시계 ──
  useEffect(() => {
    setNowMs(serverNow())
    const t = setInterval(() => setNowMs(serverNow()), 1000)
    return () => clearInterval(t)
  }, [serverNow])

  // ── 전송 ──
  const send = useCallback(async (body: KioskCheckRequest): Promise<SendOutcome> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const sentAt = Date.now()
    try {
      const res = await fetch('/api/kiosk/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = (await res.json().catch(() => null)) as KioskCheckResponse | null
      if (data?.serverNow) {
        const receivedAt = Date.now()
        clockOffsetRef.current = new Date(data.serverNow).getTime() - (sentAt + receivedAt) / 2
      }
      setOnline(true)
      if (res.status === 401) return { kind: 'revoked' }
      if (res.status === 429) return { kind: 'rateLimited' }
      if (res.status >= 500 || !data) return { kind: 'offline' }
      if (!data.ok) return { kind: 'invalid' }
      return { kind: 'ok', result: data.result }
    } catch {
      setOnline(false)
      return { kind: 'offline' }
    } finally {
      clearTimeout(timer)
    }
  }, [])

  const refreshPending = useCallback(async () => {
    setPendingCount(await countQueuedChecks())
  }, [])

  /** 저장된 입력을 순서대로 재전송 — 모두 보냈으면 true */
  const flushQueue = useCallback((): Promise<boolean> => {
    if (flushingRef.current) return flushingRef.current
    const run = (async () => {
      const items = await listQueuedChecks()
      for (const item of items) {
        const outcome = await send({ code: item.code, studentId: item.studentId, sessionId: item.sessionId, at: item.at })
        if (outcome.kind === 'revoked') {
          setScreen({ kind: 'revoked' })
          return false
        }
        if (outcome.kind === 'offline' || outcome.kind === 'rateLimited') return false
        // 처리됨·잘못된 입력·선택이 필요한 입력(형제 번호)은 대기열에서 제거
        if (item.id !== undefined) await removeQueuedCheck(item.id)
      }
      return true
    })()
    flushingRef.current = run
    return run.finally(() => {
      flushingRef.current = null
      void refreshPending()
    })
  }, [send, refreshPending])

  // 시작 시·연결 복구 시·주기적으로 재전송
  useEffect(() => {
    void refreshPending().then(() => flushQueue())
    const onOnline = () => {
      setOnline(true)
      void flushQueue()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushQueue, refreshPending])

  useEffect(() => {
    if (pendingCount === 0) return
    const t = setInterval(() => void flushQueue(), FLUSH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [pendingCount, flushQueue])

  const reset = useCallback(() => {
    updateDigits('')
    setScreen({ kind: 'input' })
  }, [updateDigits])

  const saveOffline = useCallback(
    async (req: KioskCheckRequest) => {
      await enqueueCheck({
        code: req.code,
        studentId: req.studentId,
        sessionId: req.sessionId,
        at: new Date(serverNow()).toISOString(),
      })
      await refreshPending()
      setScreen({ kind: 'message', tone: 'saved', title: '저장됨, 연결되면 전송돼요', durationMs: 3000 })
    },
    [serverNow, refreshPending],
  )

  const submit = useCallback(
    async (req: KioskCheckRequest) => {
      setScreen({ kind: 'loading' })

      // 앞선 저장분이 남아 있으면 먼저 보낸다 (같은 학생의 등원·하원 순서 보장)
      if ((await countQueuedChecks()) > 0) {
        const drained = await flushQueue()
        if (!drained) {
          await saveOffline(req)
          return
        }
      }

      const outcome = await send(req)
      switch (outcome.kind) {
        case 'offline':
          await saveOffline(req)
          return
        case 'revoked':
          setScreen({ kind: 'revoked' })
          return
        case 'rateLimited':
          setScreen({ kind: 'message', tone: 'error', title: '잠시 후 다시 입력해주세요', durationMs: 2500 })
          return
        case 'invalid':
          setScreen({ kind: 'message', tone: 'error', title: '다시 입력해주세요', durationMs: 2000 })
          return
      }

      const { result } = outcome
      if (result.kind === 'CHOOSE_STUDENT') {
        setScreen({ kind: 'chooseStudent', code: req.code, students: result.students })
        return
      }
      if (result.kind === 'CHOOSE_SESSION') {
        setScreen({
          kind: 'chooseSession',
          code: req.code,
          studentId: result.studentId,
          name: result.name,
          sessions: result.sessions,
        })
        return
      }
      const message = resultToMessage(result)
      if (message) setScreen(message)
      else reset()
    },
    [flushQueue, saveOffline, send, reset],
  )

  // 안내·선택 화면 자동 초기화
  useEffect(() => {
    if (screen.kind === 'message') {
      const t = setTimeout(reset, screen.durationMs)
      return () => clearTimeout(t)
    }
    if (screen.kind === 'chooseStudent' || screen.kind === 'chooseSession') {
      const t = setTimeout(reset, CHOICE_TIMEOUT_MS)
      return () => clearTimeout(t)
    }
  }, [screen, reset])

  // 입력하다 만 번호는 잠시 후 지움
  useEffect(() => {
    if (screen.kind !== 'input' || digits.length === 0) return
    const t = setTimeout(() => updateDigits(''), PARTIAL_INPUT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [digits, screen.kind, updateDigits])

  const press = useCallback(
    (key: string) => {
      if (screen.kind !== 'input') return
      const current = digitsRef.current
      if (key === 'back') {
        updateDigits(current.slice(0, -1))
        return
      }
      if (key === 'ok') {
        if (current.length === CODE_LENGTH) void submit({ code: current })
        return
      }
      if (current.length >= CODE_LENGTH) return
      const next = current + key
      updateDigits(next)
      // 4자리가 되면 자동 조회
      if (next.length === CODE_LENGTH) void submit({ code: next })
    },
    [screen.kind, submit, updateDigits],
  )

  // 외부 키보드 입력 (테스트·블루투스 키보드)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') press('ok')
      else if (e.key === 'Escape' && screen.kind !== 'revoked' && screen.kind !== 'loading') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, reset, screen.kind])

  useEffect(() => {
    setCanFullscreen(typeof document !== 'undefined' && !!document.documentElement.requestFullscreen)
  }, [])

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  if (screen.kind === 'revoked') {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent-red/10 flex items-center justify-center">
            <ShieldOff size={32} className="text-accent-red" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-gray-900">기기 등록이 해제되었습니다</h1>
          <p className="mt-2 text-base text-gray-700">학원장님께 문의해주세요.</p>
        </div>
      </main>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col">
      <header className="shrink-0 bg-primary-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <p className="text-lg sm:text-xl font-bold truncate">{academyName}</p>
        <div className="flex items-center gap-3 shrink-0">
          {(!online || pendingCount > 0) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gold px-3 py-1 text-xs sm:text-sm font-semibold text-gray-900">
              <CloudOff size={14} />
              {online ? '' : '오프라인'}
              {pendingCount > 0 && `${online ? '' : ' · '}전송 대기 ${pendingCount}건`}
            </span>
          )}
          <div className="text-right leading-tight">
            <p className="text-lg sm:text-2xl font-bold tabular-nums" suppressHydrationWarning>
              {nowMs !== null ? CLOCK_FMT.format(new Date(nowMs)) : ''}
            </p>
            <p className="text-xs sm:text-sm text-white/70" suppressHydrationWarning>
              {nowMs !== null ? DATE_FMT.format(new Date(nowMs)) : ''}
            </p>
          </div>
          {canFullscreen && (
            <button
              type="button"
              onClick={enterFullscreen}
              aria-label="전체화면"
              className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            >
              <Maximize size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
          {screen.kind === 'message' && <MessagePanel screen={screen} />}

          {screen.kind === 'chooseStudent' && (
            <ChoicePanel title="학생을 선택하세요" subtitle="같은 번호로 등록된 학생이 여러 명이에요" onCancel={reset}>
              {screen.students.map((s) => (
                <ChoiceButton
                  key={s.studentId}
                  title={s.name}
                  subtitle={s.className ?? '반 미배정'}
                  onClick={() => void submit({ code: screen.code, studentId: s.studentId })}
                />
              ))}
            </ChoicePanel>
          )}

          {screen.kind === 'chooseSession' && (
            <ChoicePanel title={`${screen.name} 학생, 수업을 선택하세요`} subtitle="지금 출석할 수 있는 수업이 여러 개예요" onCancel={reset}>
              {screen.sessions.map((s) => (
                <ChoiceButton
                  key={s.sessionId}
                  title={s.className}
                  subtitle={`${formatTime(s.startAt)} ~ ${formatTime(s.endAt)}`}
                  onClick={() =>
                    void submit({ code: screen.code, studentId: screen.studentId, sessionId: s.sessionId })
                  }
                />
              ))}
            </ChoicePanel>
          )}

          {(screen.kind === 'input' || screen.kind === 'loading') && (
            <div className="flex flex-col landscape:md:flex-row items-center gap-6 sm:gap-8 landscape:md:gap-16">
              <div className="flex flex-col items-center text-center">
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-keep">
                  학부모님 휴대폰 뒷번호 4자리를 입력하세요
                </p>
                <div className="mt-5 sm:mt-8 flex gap-3 sm:gap-4" aria-live="polite" aria-label={`${digits.length}자리 입력됨`}>
                  {Array.from({ length: CODE_LENGTH }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-14 h-[72px] sm:w-20 sm:h-24 rounded-xl border-2 bg-white flex items-center justify-center text-4xl sm:text-5xl font-bold tabular-nums text-gray-900',
                        i === digits.length && screen.kind === 'input' ? 'border-primary-700' : 'border-gray-200',
                      )}
                    >
                      {digits[i] ?? ''}
                    </div>
                  ))}
                </div>
                <p className="mt-4 h-7 text-base text-gray-500 inline-flex items-center gap-2">
                  {screen.kind === 'loading' && (
                    <>
                      <Loader2 size={20} className="animate-spin text-primary-700" />
                      확인 중…
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-4" role="group" aria-label="숫자 키패드">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                  <KeyButton key={n} onClick={() => press(n)} disabled={screen.kind !== 'input'}>
                    {n}
                  </KeyButton>
                ))}
                <KeyButton
                  onClick={() => press('back')}
                  disabled={screen.kind !== 'input'}
                  ariaLabel="지우기"
                  variant="muted"
                >
                  <Delete size={36} />
                </KeyButton>
                <KeyButton onClick={() => press('0')} disabled={screen.kind !== 'input'}>
                  0
                </KeyButton>
                <KeyButton
                  onClick={() => press('ok')}
                  disabled={screen.kind !== 'input' || digits.length !== CODE_LENGTH}
                  variant="primary"
                >
                  <span className="text-2xl sm:text-3xl">확인</span>
                </KeyButton>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── 하위 컴포넌트 ─────────────────────────────────────────────────────────────

function KeyButton({
  children,
  onClick,
  disabled,
  ariaLabel,
  variant = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  ariaLabel?: string
  variant?: 'default' | 'muted' | 'primary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        // 최소 80×80px, 숫자 36px 이상
        'h-20 w-20 min-[400px]:h-24 min-[400px]:w-24 [@media(min-width:768px)_and_(min-height:640px)]:h-28 [@media(min-width:768px)_and_(min-height:640px)]:w-28 rounded-2xl text-4xl sm:text-5xl font-semibold tabular-nums',
        'inline-flex items-center justify-center transition-colors touch-manipulation',
        'disabled:opacity-40',
        variant === 'default' && 'border border-gray-200 bg-white text-gray-900 active:bg-gray-100',
        variant === 'muted' && 'bg-gray-100 text-gray-700 active:bg-gray-200',
        variant === 'primary' && 'bg-primary-700 text-white active:bg-primary-800',
      )}
    >
      {children}
    </button>
  )
}

const TONE_STYLE: Record<MessageTone, { icon: typeof Info; circle: string; iconColor: string }> = {
  success: { icon: CheckCircle2, circle: 'bg-accent-green/10', iconColor: 'text-accent-green' },
  info: { icon: Info, circle: 'bg-primary-100', iconColor: 'text-primary-700' },
  error: { icon: XCircle, circle: 'bg-accent-red/10', iconColor: 'text-accent-red' },
  saved: { icon: CloudOff, circle: 'bg-accent-gold/15', iconColor: 'text-accent-gold' },
}

function MessagePanel({ screen }: { screen: Extract<Screen, { kind: 'message' }> }) {
  const style = TONE_STYLE[screen.tone]
  const Icon = style.icon
  return (
    <div role="status" aria-live="assertive" className="flex flex-col items-center text-center px-4">
      <div className={cn('w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center', style.circle)}>
        <Icon size={56} className={style.iconColor} />
      </div>
      <p className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 break-keep">{screen.title}</p>
      {screen.subtitle && <p className="mt-3 text-xl sm:text-2xl text-gray-700 break-keep">{screen.subtitle}</p>}
    </div>
  )
}

function ChoicePanel({
  title,
  subtitle,
  onCancel,
  children,
}: {
  title: string
  subtitle: string
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-xl">
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 text-center break-keep">{title}</p>
      <p className="mt-2 text-base sm:text-lg text-gray-500 text-center">{subtitle}</p>
      <div className="mt-6 grid gap-3">{children}</div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 w-full h-16 rounded-2xl bg-gray-100 text-xl font-semibold text-gray-700 active:bg-gray-200"
      >
        취소
      </button>
    </div>
  )
}

function ChoiceButton({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[80px] rounded-2xl border border-gray-200 bg-white px-6 py-4 text-left active:bg-gray-100 flex items-center justify-between gap-4"
    >
      <span className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</span>
      <span className="text-lg sm:text-xl text-gray-500 shrink-0">{subtitle}</span>
    </button>
  )
}
