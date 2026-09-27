'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { CheckCircle2, Copy, Loader2, Plus, Tablet, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createKeypadRegistration, revokeKeypadDevice } from '@/lib/attendance/keypad-actions'
import type { KeypadDeviceRow } from '@/lib/attendance/keypad-device'
import { cn } from '@/lib/utils'

type Props = {
  academyId: string
  devices: KeypadDeviceRow[]
}

type Registration = { url: string; qr: string; expiresAt: number; knownIds: string[]; name: string }

const LAST_SEEN_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatLastSeen(iso: string | null): string {
  if (!iso) return '접속 기록 없음'
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  return LAST_SEEN_FMT.format(new Date(iso))
}

function formatRemaining(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function KeypadDevicesSection({ academyId, devices }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('입구 태블릿')
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [registeredName, setRegisteredName] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [pending, startTransition] = useTransition()
  const devicesRef = useRef(devices)
  devicesRef.current = devices

  // QR 표시 중: 남은 시간 표시 + 3초마다 목록 새로고침으로 등록 완료 감지
  useEffect(() => {
    if (!registration) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => router.refresh(), 3000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [registration, router])

  useEffect(() => {
    if (!registration) return
    const added = devices.find((d) => !registration.knownIds.includes(d.id))
    if (added) {
      setRegistration(null)
      setRegisteredName(added.name)
    }
  }, [devices, registration])

  const expired = registration ? registration.expiresAt <= now : false

  const create = () => {
    setError(null)
    setRegisteredName(null)
    startTransition(async () => {
      const result = await createKeypadRegistration(academyId, name)
      if (result.error || !result.code || !result.expiresAt) {
        setError(result.error ?? '등록 코드를 만들지 못했습니다.')
        return
      }
      const url = `${window.location.origin}/kiosk/register?code=${encodeURIComponent(result.code)}`
      const qr = await QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M' }).catch(() => '')
      setRegistration({
        url,
        qr,
        expiresAt: new Date(result.expiresAt).getTime(),
        knownIds: devicesRef.current.map((d) => d.id),
        name: name.trim(),
      })
      setNow(Date.now())
      setAdding(false)
    })
  }

  const revoke = (id: string) => {
    setError(null)
    startTransition(async () => {
      const result = await revokeKeypadDevice(id)
      setConfirmId(null)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  const copy = async () => {
    if (!registration) return
    try {
      await navigator.clipboard.writeText(registration.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('아래 링크를 복사해주세요.', registration.url)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">키패드 출결 기기</h2>
          <p className="text-sm text-gray-500 mt-1">
            입구 태블릿에서 학생이 학부모님 휴대폰 뒷번호 4자리로 출석합니다.
          </p>
        </div>
        {!adding && !registration && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setRegisteredName(null)
              setError(null)
            }}
            className="h-11 px-4 shrink-0 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-primary-800"
          >
            <Plus size={16} />
            기기 추가
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <label htmlFor="device-name" className="text-sm font-semibold text-gray-900">
            기기 이름
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="device-name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 입구 태블릿"
              className="sm:flex-1"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="flex-1 sm:flex-none h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={create}
                disabled={pending || !name.trim()}
                className="flex-1 sm:flex-none h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {pending && <Loader2 size={16} className="animate-spin" />}
                등록 QR 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {registration && (
        <div className="mt-5 rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">&lsquo;{registration.name}&rsquo; 등록</p>
              <p className="text-xs text-gray-500 mt-1">
                등록할 태블릿·휴대폰의 카메라로 QR을 스캔하세요. 로그인할 필요가 없습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegistration(null)}
              aria-label="닫기"
              className="h-11 w-11 -mr-2 -mt-2 shrink-0 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            {registration.qr && !expired ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={registration.qr} alt="기기 등록 QR 코드" className="h-56 w-56 rounded-lg border border-gray-200" />
            ) : (
              <div className="h-56 w-56 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-center text-sm text-gray-500 px-6">
                {expired ? '등록 코드가 만료되었습니다.' : 'QR을 만들지 못했습니다. 링크를 복사해 사용하세요.'}
              </div>
            )}
            {expired ? (
              <button
                type="button"
                onClick={create}
                disabled={pending}
                className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                {pending && <Loader2 size={16} className="animate-spin" />}
                QR 다시 만들기
              </button>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  남은 시간 <span className="font-semibold tabular-nums">{formatRemaining(registration.expiresAt - now)}</span>
                  <span className="text-gray-500"> · 등록되면 목록에 바로 표시됩니다</span>
                </p>
                <button
                  type="button"
                  onClick={copy}
                  className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 inline-flex items-center gap-1.5 hover:bg-gray-50"
                >
                  <Copy size={16} />
                  {copied ? '복사되었습니다' : '등록 링크 복사'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {registeredName && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-accent-green">
          <CheckCircle2 size={16} />
          &lsquo;{registeredName}&rsquo; 기기가 등록되었습니다.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-accent-red">
          {error}
        </p>
      )}

      <div className="mt-5">
        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 flex flex-col items-center text-center">
            <Tablet size={28} className="text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">등록된 기기가 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Tablet size={20} className="shrink-0 text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-500">마지막 접속 {formatLastSeen(d.lastSeenAt)}</p>
                  </div>
                </div>
                {confirmId === d.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="h-11 px-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(d.id)}
                      disabled={pending}
                      className="h-11 px-3 rounded-xl bg-accent-red text-white text-sm font-semibold disabled:opacity-60"
                    >
                      해제
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(d.id)}
                    className={cn(
                      'h-11 px-4 shrink-0 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    해제
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-500">
          해제한 기기에서는 더 이상 출석할 수 없습니다. 다시 사용하려면 기기를 새로 추가하세요.
        </p>
      </div>
    </section>
  )
}
