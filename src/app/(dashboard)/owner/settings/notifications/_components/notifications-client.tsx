'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { updateNotificationSettings } from '../../actions'

type NotificationSettings = {
  newTeacherJoin: boolean
  newStudentJoin: boolean
  testCompleted: boolean
  subscriptionExpiring: boolean
  levelTestPeriod: string
}

const LEVEL_TEST_PERIOD_OPTIONS = [
  { value: 'monthly', label: '매월' },
  { value: 'bimonthly', label: '격월' },
  { value: 'quarterly', label: '분기 (3개월)' },
  { value: 'none', label: '사용 안 함' },
]

const items: {
  key: keyof NotificationSettings
  label: string
  description: string
  alwaysOn?: boolean
}[] = [
  {
    key: 'newTeacherJoin',
    label: '신규 교사 가입 알림',
    description: '새로운 교사가 초대 코드로 가입했을 때 알림을 받습니다.',
  },
  {
    key: 'newStudentJoin',
    label: '신규 학생 가입 알림',
    description: '새로운 학생이 초대 코드로 가입했을 때 알림을 받습니다.',
  },
  {
    key: 'testCompleted',
    label: '테스트 완료 알림',
    description: '학생이 테스트를 완료했을 때 알림을 받습니다.',
  },
  {
    key: 'subscriptionExpiring',
    label: '구독 만료 임박 알림',
    description: '구독이 만료되기 7일 전에 알림을 받습니다.',
    alwaysOn: true,
  },
]

type Props = {
  initialSettings: NotificationSettings
}

export function NotificationsClient({ initialSettings }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleChange = (key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateNotificationSettings(settings)
      if (res?.error) {
        setError(res.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between px-6 py-5">
            <div className="flex-1 pr-8">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                {item.alwaysOn && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    필수
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            </div>
            <Switch
              checked={settings[item.key]}
              onCheckedChange={(v) => handleChange(item.key, v)}
              disabled={item.alwaysOn}
            />
          </div>
        ))}
      </div>

      {/* 정기 레벨 테스트 주기 설정 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">정기 레벨 테스트 주기</h3>
          <p className="text-xs text-gray-500 mt-1">
            설정된 주기에 따라 교사와 학생에게 레벨 테스트 알림을 자동 발송합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEVEL_TEST_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSettings((prev) => ({ ...prev, levelTestPeriod: opt.value }))
                setSaved(false)
              }}
              className={`min-h-[44px] rounded-xl border text-sm font-medium transition-colors ${
                settings.levelTestPeriod === opt.value
                  ? 'border-[#1865F2] bg-[#EEF4FF] text-[#1865F2]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {settings.levelTestPeriod !== 'none' && (
          <div className="mt-4 rounded-xl bg-[#EEF4FF] px-4 py-3">
            <p className="text-xs text-[#1865F2]">
              💡 <span className="font-medium">
                {LEVEL_TEST_PERIOD_OPTIONS.find((o) => o.value === settings.levelTestPeriod)?.label}
              </span> 주기로 교사에게 "레벨 테스트 배포" 알림과 학생에게 "레벨 테스트 예정" 알림이 발송됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="h-11 px-6 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1865F2' }}
        >
          {isPending ? '저장 중…' : '저장'}
        </button>
        {saved && (
          <p className="text-sm text-green-700">알림 설정이 저장되었습니다.</p>
        )}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}
