import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { redirect } from 'next/navigation'
import { markAllNotificationsRead } from '@/lib/actions/notification-actions'

const TYPE_CONFIG = {
  INFO: {
    icon: Info,
    iconColor: 'text-primary-700',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    dot: 'bg-primary-700',
  },
  SUCCESS: {
    icon: CheckCircle2,
    iconColor: 'text-accent-green',
    bg: 'bg-green-50',
    border: 'border-green-100',
    dot: 'bg-accent-green',
  },
  WARNING: {
    icon: AlertTriangle,
    iconColor: 'text-accent-gold',
    bg: 'bg-yellow-50',
    border: 'border-yellow-100',
    dot: 'bg-accent-gold',
  },
  ERROR: {
    icon: XCircle,
    iconColor: 'text-accent-red',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-accent-red',
  },
}

function formatDate(date: Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function StudentNotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const notifications = await prisma.notification.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">알림</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 읽었습니다'}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 h-9 bg-white border border-gray-200 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              <CheckCheck size={15} />
              모두 읽음
            </button>
          </form>
        )}
      </div>

      {/* 알림 목록 */}
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <Bell size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-base font-medium text-gray-500">알림이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">새 공지사항이나 알림이 오면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50 overflow-hidden">
          {notifications.map((n) => {
            const type = n.type as keyof typeof TYPE_CONFIG
            const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.INFO
            const Icon = config.icon

            return (
              <div
                key={n.id}
                className={`flex gap-4 px-5 py-4 transition-colors ${!n.isRead ? config.bg : 'hover:bg-gray-50'}`}
              >
                {/* 아이콘 */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    !n.isRead ? 'bg-white' : 'bg-gray-100'
                  }`}
                >
                  <Icon size={17} className={!n.isRead ? config.iconColor : 'text-gray-400'} />
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-snug ${
                        !n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dot}`}
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
