'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { notifications: [], unreadCount: 0 }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  })
  revalidateTag(`notifications-${user.id}`)
  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  })
  revalidateTag(`notifications-${user.id}`)
  revalidatePath('/', 'layout')
}
