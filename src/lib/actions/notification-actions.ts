'use server'

import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'

export type NotificationItem = {
  id: string
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
  title: string
  message: string
  link: string | null
  relatedId: string | null
  isRead: boolean
  createdAt: Date
}

export async function getNotifications(limit = 30): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
}> {
  // supabase.auth.getUser() 직접 호출(매번 Auth 서버 왕복 ~300ms) 대신
  // 토큰 인메모리 캐시가 적용된 getCurrentUser()를 사용한다.
  const user = await getCurrentUser()
  if (!user) return { notifications: [], unreadCount: 0 }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.authId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      link: true,
      relatedId: true,
      isRead: true,
      createdAt: true,
    },
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length
  return { notifications, unreadCount }
}

export async function markNotificationRead(notificationId: string) {
  const user = await getCurrentUser()
  if (!user) return

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.authId },
    data: { isRead: true },
  })
  revalidateTag(`notifications-${user.authId}`)
  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser()
  if (!user) return

  await prisma.notification.updateMany({
    where: { userId: user.authId, isRead: false },
    data: { isRead: true },
  })
  revalidateTag(`notifications-${user.authId}`)
  revalidatePath('/', 'layout')
}
