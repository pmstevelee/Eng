'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, BellRing, Check, CheckCheck, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/actions/notification-actions'

const TYPE_STYLES: Record<string, { dot: string; bg: string }> = {
  INFO: { dot: 'bg-primary-700', bg: 'bg-blue-50' },
  SUCCESS: { dot: 'bg-accent-green', bg: 'bg-green-50' },
  WARNING: { dot: 'bg-accent-gold', bg: 'bg-yellow-50' },
  ERROR: { dot: 'bg-accent-red', bg: 'bg-red-50' },
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

interface Props {
  userId: string
}

export function NotificationBell({ userId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // 초기 로드
  useEffect(() => {
    loadNotifications()
  }, [])

  // Supabase Realtime 구독
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as {
            id: string
            type: string
            title: string
            message: string
            link: string | null
            related_id: string | null
            is_read: boolean
            created_at: string
          }
          const item: NotificationItem = {
            id: newNotif.id,
            type: newNotif.type as NotificationItem['type'],
            title: newNotif.title,
            message: newNotif.message,
            link: newNotif.link,
            relatedId: newNotif.related_id,
            isRead: newNotif.is_read,
            createdAt: new Date(newNotif.created_at),
          }
          setNotifications((prev) => [item, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  async function loadNotifications() {
    setIsLoading(true)
    try {
      const { notifications: items, unreadCount: count } = await getNotifications()
      setNotifications(items)
      setUnreadCount(count)
    } catch {
      // 네트워크 오류 등 — 빈 상태 유지
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* 종 아이콘 버튼 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 relative transition-colors"
        aria-label="알림"
      >
        {unreadCount > 0 ? <BellRing size={19} className="text-primary-700" /> : <Bell size={19} />}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-accent-red text-white text-[10px] font-bold rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 패널 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-80 md:w-96 rounded-xl border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">알림</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-primary-700 text-white text-[11px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-primary-700 hover:text-primary-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <CheckCheck size={13} />
                  모두 읽음
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">알림이 없습니다</p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.INFO
                const inner = (
                  <div
                    className={`flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
                      !n.isRead ? style.bg : ''
                    }`}
                  >
                    {/* 읽음 상태 점 */}
                    <div className="pt-1.5 shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${!n.isRead ? style.dot : 'bg-gray-200'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          !n.isRead ? 'font-medium text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex items-start gap-1 shrink-0 pt-0.5">
                      {!n.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            handleMarkRead(n.id)
                          }}
                          className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          title="읽음 처리"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      {n.link && <ChevronRight size={14} className="text-gray-300 mt-0.5" />}
                    </div>
                  </div>
                )

                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => {
                      if (!n.isRead) handleMarkRead(n.id)
                      setIsOpen(false)
                    }}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                )
              })
            )}
          </div>

          {/* 푸터 */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2">
              <p className="text-xs text-gray-400 text-center">최근 30개 알림을 표시합니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
