'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { updateNotificationSettings } from '../../actions'

type NotificationSettings = {
  newTeacherJoin: boolean
  newStudentJoin: boolean
  testCompleted: boolean
  subscriptionExpiring: boolean
}

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

      <div className="px-6 py-5 flex items-center gap-4">
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
