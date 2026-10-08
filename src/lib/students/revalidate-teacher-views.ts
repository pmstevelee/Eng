import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'

/**
 * 반 배정·담당 교사 변경 후 관련 교사 화면 캐시를 무효화한다.
 * 교사 대시보드·학생 목록·일정·소통 화면은 교사별 태그로 캐시되므로
 * 학원장 화면에서 반을 바꿔도 태그를 지우지 않으면 최대 60초간 이전 명단이 보인다.
 *
 * @param classIds 변경 전/후 반 ID (null은 무시)
 * @param extraTeacherIds 담당 교사가 바뀐 경우 이전 교사 ID 등
 */
export async function revalidateTeacherClassViews(
  classIds: (string | null | undefined)[],
  extraTeacherIds: (string | null | undefined)[] = [],
): Promise<void> {
  const ids = Array.from(new Set(classIds.filter((id): id is string => !!id)))
  const classes =
    ids.length > 0
      ? await prisma.class.findMany({ where: { id: { in: ids } }, select: { teacherId: true } })
      : []

  const teacherIds = new Set<string>()
  for (const c of classes) if (c.teacherId) teacherIds.add(c.teacherId)
  for (const id of extraTeacherIds) if (id) teacherIds.add(id)

  for (const teacherId of Array.from(teacherIds)) {
    revalidateTag(`teacher-${teacherId}-students`)
    revalidateTag(`teacher-${teacherId}-dashboard`)
    revalidateTag(`teacher-${teacherId}-schedule`)
    revalidateTag(`teacher-${teacherId}-communication`)
  }
}
