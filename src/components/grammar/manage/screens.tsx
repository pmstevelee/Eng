// 문법학습 관리 화면(서버 컴포넌트) — 교사·학원장 page가 역할만 넘겨 같이 쓴다
// 반 범위는 getGrammarManageScope()가 정한다 (교사: 담당 반, 학원장: 본원+소유 지점).

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { getGrammarTree } from '@/lib/grammar/curriculum'
import { findManagedClass, getGrammarManageScope, templateAcademyIdOf, type GrammarManageScope } from '@/lib/grammar/manage-access'
import {
  getClassAssignmentData,
  getCourseTemplateDetail,
  getCourseTemplateOptions,
  getGrammarClassCards,
  getPendingAcademyQuestions,
} from '@/lib/grammar/manage-queries'
import { getClassAchievementData } from '@/lib/grammar/achievement-queries'
import { cn } from '@/lib/utils'
import { ClassAssignmentBoard } from './class-assignment-board'
import { ClassCardList } from './class-card-list'
import { ClassHeatmap } from './class-heatmap'
import { CourseEditor } from './course-editor'
import { CourseTemplateList } from './course-template-list'
import { GrammarManageHeader, GrammarManageNav, grammarManageBase, type GrammarManageRole } from './manage-nav'
import { PendingQuestionList } from './pending-question-list'

const TITLE = '문법학습 관리'

async function requireScope(role: GrammarManageRole): Promise<GrammarManageScope> {
  const scope = await getGrammarManageScope()
  if (!scope || scope.role !== role) redirect('/login')
  return scope
}

function countPending(scope: GrammarManageScope): Promise<number> {
  return prisma.question.count({
    where: {
      academyId: { in: scope.academyIds },
      domain: 'GRAMMAR',
      source: 'AI_GENERATED',
      isVerified: false,
      isActive: true,
      grammarPointId: { not: null },
    },
  })
}

/** 첫 화면 — 반 카드 목록 */
export async function GrammarManageHomeScreen({ role }: { role: GrammarManageRole }) {
  const scope = await requireScope(role)
  const [classes, pending] = await Promise.all([getGrammarClassCards(scope), countPending(scope)])
  return (
    <div className="space-y-5">
      <GrammarManageHeader
        title={TITLE}
        description={
          role === 'TEACHER'
            ? '담당 반에 문법 단원을 배정하고 진도를 확인합니다.'
            : '본원과 지점의 모든 반에 문법 단원을 배정하고 진도를 확인합니다.'
        }
      />
      <GrammarManageNav role={role} active="classes" pendingCount={pending} />
      <ClassCardList classes={classes} basePath={grammarManageBase(role)} />
    </div>
  )
}

export type GrammarClassView = 'assign' | 'achievement'

export function parseGrammarClassView(value: string | string[] | undefined): GrammarClassView {
  return value === 'achievement' ? 'achievement' : 'assign'
}

function ClassViewTabs({ href, active }: { href: string; active: GrammarClassView }) {
  const tabs: { key: GrammarClassView; label: string; href: string }[] = [
    { key: 'assign', label: '배정', href },
    { key: 'achievement', label: '성취도', href: `${href}?view=achievement` },
  ]
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1" role="tablist" aria-label="반 문법 화면">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={cn(
            'flex min-h-[40px] items-center rounded-md px-4 text-sm font-medium transition-colors',
            active === t.key ? 'bg-[#1865F2] text-white' : 'text-gray-600 hover:bg-gray-50',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

/** 반 배정 화면 — '배정' / '성취도'(히트맵) 탭. 탭마다 필요한 데이터만 불러온다 */
export async function GrammarClassScreen({
  role,
  classId,
  view = 'assign',
}: {
  role: GrammarManageRole
  classId: string
  view?: GrammarClassView
}) {
  const scope = await requireScope(role)
  const cls = await findManagedClass(scope, classId)
  if (!cls) notFound()
  const base = grammarManageBase(role)
  const [assignData, achievementData, pending] = await Promise.all([
    view === 'assign' ? getClassAssignmentData(cls) : Promise.resolve(null),
    view === 'achievement' ? getClassAchievementData(cls) : Promise.resolve(null),
    countPending(scope),
  ])
  const studentHref = role === 'TEACHER' ? '/teacher/students' : '/owner/students'
  return (
    <div className="space-y-5">
      <div>
        <Link href={base} className="inline-flex min-h-[44px] items-center text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="mr-0.5 h-4 w-4" />
          반 목록
        </Link>
        <GrammarManageHeader
          title={`${cls.name} 문법 진도`}
          description={
            view === 'assign'
              ? "배정 순서대로 학생 문법 홈의 '이어서 학습'에 나옵니다. 마감일이 빠른 단원이 먼저예요."
              : '학생별로 배정 단원의 통과·숙달·취약 상태를 한눈에 봅니다.'
          }
        />
      </div>
      <GrammarManageNav role={role} active="classes" pendingCount={pending} />
      <ClassViewTabs href={`${base}/classes/${cls.id}`} active={view} />
      {assignData && <ClassAssignmentBoard role={role} basePath={base} data={assignData} />}
      {achievementData && (
        <ClassHeatmap
          data={achievementData}
          studentHrefBase={studentHref}
          studentHrefQuery={role === 'TEACHER' ? '?tab=grammar' : ''}
        />
      )}
    </div>
  )
}

/** 검수 대기 — 우리 학원 AI 생성 문항 */
export async function GrammarQuestionsScreen({ role }: { role: GrammarManageRole }) {
  const scope = await requireScope(role)
  const { rows, total } = await getPendingAcademyQuestions(scope)
  return (
    <div className="space-y-5">
      <GrammarManageHeader title={TITLE} description="우리 학원 전용으로 AI가 만든 문제입니다. 검수 완료한 문제만 학생에게 출제돼요." />
      <GrammarManageNav role={role} active="questions" pendingCount={total} />
      <PendingQuestionList rows={rows} total={total} />
    </div>
  )
}

/** 코스 템플릿 목록 (학원장) */
export async function GrammarCoursesScreen() {
  const scope = await requireScope('ACADEMY_OWNER')
  const [templates, pending] = await Promise.all([getCourseTemplateOptions(scope.academyIds[0]), countPending(scope)])
  return (
    <div className="space-y-5">
      <GrammarManageHeader title={TITLE} description="자주 쓰는 단원 순서를 코스로 저장해 두고 여러 반에 불러옵니다." />
      <GrammarManageNav role="ACADEMY_OWNER" active="courses" pendingCount={pending} />
      <CourseTemplateList templates={templates} basePath={grammarManageBase('ACADEMY_OWNER')} />
    </div>
  )
}

/** 코스 템플릿 편집 (학원장) — courseId 'new'면 새로 만들기 */
export async function GrammarCourseEditScreen({ courseId }: { courseId: string }) {
  const scope = await requireScope('ACADEMY_OWNER')
  const templateAcademyId = await templateAcademyIdOf(scope.academyIds[0])
  const [course, tree] = await Promise.all([
    courseId === 'new' ? Promise.resolve(null) : getCourseTemplateDetail(courseId, templateAcademyId),
    getGrammarTree(templateAcademyId),
  ])
  if (courseId !== 'new' && !course) notFound()
  const base = grammarManageBase('ACADEMY_OWNER')
  return (
    <div className="space-y-5">
      <div>
        <Link href={`${base}/courses`} className="inline-flex min-h-[44px] items-center text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="mr-0.5 h-4 w-4" />
          코스 템플릿
        </Link>
        <GrammarManageHeader
          title={course ? course.name : '새 코스 만들기'}
          description={course?.scope === 'HQ' ? '본사 기본 코스입니다. 고치려면 복제하세요.' : '고친 내용은 앞으로 불러오는 반부터 적용돼요.'}
        />
      </div>
      <CourseEditor key={course?.id ?? 'new'} basePath={base} course={course} tree={tree} />
    </div>
  )
}
