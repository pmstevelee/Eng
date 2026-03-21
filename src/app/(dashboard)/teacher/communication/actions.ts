'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type AnnouncementWithAuthor = {
  id: string
  title: string
  content: string
  target: 'ALL_STUDENTS' | 'CLASS'
  classId: string | null
  className: string | null
  authorName: string
  createdAt: Date
}

export async function getAnnouncements(): Promise<AnnouncementWithAuthor[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { academyId: true },
  })
  if (!dbUser?.academyId) return []

  const announcements = await prisma.announcement.findMany({
    where: { academyId: dbUser.academyId },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { name: true } },
      class: { select: { name: true } },
    },
  })

  return announcements.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    target: a.target,
    classId: a.classId,
    className: a.class?.name ?? null,
    authorName: a.author.name,
    createdAt: a.createdAt,
  }))
}

export async function getMyClasses() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const classes = await prisma.class.findMany({
    where: { teacherId: user.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return classes
}

export async function createAnnouncement(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '인증이 필요합니다.' }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { academyId: true, name: true },
  })
  if (!dbUser?.academyId) return { error: '학원 정보를 찾을 수 없습니다.' }

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const target = formData.get('target') as 'ALL_STUDENTS' | 'CLASS'
  const classId = formData.get('classId') as string | null

  if (!title?.trim() || !content?.trim()) {
    return { error: '제목과 내용을 모두 입력해주세요.' }
  }

  // 1. 공지사항 저장
  const announcement = await prisma.announcement.create({
    data: {
      academyId: dbUser.academyId,
      authorId: user.id,
      classId: target === 'CLASS' && classId ? classId : null,
      title: title.trim(),
      content: content.trim(),
      target,
    },
  })

  // 2. 대상 학생 조회
  let targetStudentUserIds: string[] = []

  if (target === 'CLASS' && classId) {
    const students = await prisma.student.findMany({
      where: { classId },
      select: { userId: true },
    })
    targetStudentUserIds = students.map((s) => s.userId)
  } else {
    // 학원 전체 학생
    const students = await prisma.student.findMany({
      where: { user: { academyId: dbUser.academyId } },
      select: { userId: true },
    })
    targetStudentUserIds = students.map((s) => s.userId)
  }

  // 3. 알림 일괄 생성
  if (targetStudentUserIds.length > 0) {
    await prisma.notification.createMany({
      data: targetStudentUserIds.map((userId) => ({
        userId,
        academyId: dbUser.academyId!,
        type: 'INFO' as const,
        title: `📢 공지사항: ${title.trim()}`,
        message: content.trim().slice(0, 100) + (content.trim().length > 100 ? '...' : ''),
        link: '/student/notifications',
        relatedId: announcement.id,
      })),
    })
  }

  revalidatePath('/teacher/communication')
  return { success: true, announcementId: announcement.id }
}

export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '인증이 필요합니다.' }

  await prisma.announcement.delete({
    where: { id: announcementId, authorId: user.id },
  })

  revalidatePath('/teacher/communication')
  return { success: true }
}
