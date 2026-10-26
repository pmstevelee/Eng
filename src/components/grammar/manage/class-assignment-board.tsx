'use client'

// 반 배정 화면 본문 — ① 코스 불러오기 ② 포인트 추가 ③ 순서·날짜·삭제 + 강의 열 + 우리 학원 문제 AI 생성

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ListPlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatLectureDuration } from '@/lib/grammar/lecture-input'
import { deleteAcademyLecture, moveClassAssignment, removeClassAssignments } from '@/lib/grammar/manage-actions'
import type { ClassAssignmentData, ClassAssignmentRow } from '@/lib/grammar/manage-queries'
import { cn } from '@/lib/utils'
import { AddPointsDialog } from './add-points-dialog'
import { AiQuestionDialog, type AiTarget } from './ai-question-dialog'
import { AssignmentDateDialog, type DateTarget } from './assignment-date-dialog'
import { CourseImportDialog } from './course-import-dialog'
import { formatDateKey } from './format'
import { LectureDialog, type LectureTarget } from './lecture-dialog'
import type { GrammarManageRole } from './manage-nav'

interface Props {
  role: GrammarManageRole
  basePath: string
  data: ClassAssignmentData
}

type Notice = { type: 'success' | 'error'; text: string } | null

export function ClassAssignmentBoard({ role, basePath, data }: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [dateTarget, setDateTarget] = useState<DateTarget | null>(null)
  const [lectureTarget, setLectureTarget] = useState<LectureTarget | null>(null)
  const [aiTarget, setAiTarget] = useState<AiTarget | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const assignedPointIds = useMemo(() => new Set(data.rows.map((r) => r.grammarPointId)), [data.rows])
  const done = (text: string) => setNotice({ type: 'success', text })
  const fail = (text: string) => setNotice({ type: 'error', text })

  const run = (id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success?: string) => {
    setBusyId(id)
    setNotice(null)
    startTransition(async () => {
      const res = await fn()
      setBusyId(null)
      if (!res.ok) fail(res.error)
      else if (success) done(success)
    })
  }

  const onRemove = (row: ClassAssignmentRow) => {
    if (!window.confirm(`'${row.title}' 배정을 삭제할까요? 학생의 학습 기록은 그대로 남아요.`)) return
    run(row.id, () => removeClassAssignments([row.id]), `'${row.title}' 배정을 삭제했어요.`)
  }
  const onRemoveAll = () => {
    if (data.rows.length === 0) return
    if (!window.confirm(`이 반의 배정 ${data.rows.length}개를 모두 삭제할까요? 학생의 학습 기록은 그대로 남아요.`)) return
    run('all', () => removeClassAssignments(data.rows.map((r) => r.id)), '배정을 모두 삭제했어요.')
  }
  const onDeleteLecture = (row: ClassAssignmentRow) => {
    if (!row.academyLecture) return
    if (!window.confirm(`'${row.title}'의 우리 학원 강의를 삭제할까요? 학생 시청 기록도 함께 지워지고, 본사 기본 강의가 있으면 그것이 보입니다.`)) return
    const lectureId = row.academyLecture.id
    run(`lecture-${row.id}`, () => deleteAcademyLecture(data.classId, lectureId), '우리 학원 강의를 삭제했어요.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          학생 {data.studentCount}명 · 배정 {data.rows.length}개 단원
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setImportOpen(true)}>
            <ListPlus className="mr-1.5 h-4 w-4" />
            코스 불러오기
          </Button>
          <Button type="button" className="min-h-[44px]" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            포인트 추가
          </Button>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            'rounded-lg px-3 py-2.5 text-sm',
            notice.type === 'success' ? 'bg-[#E8F7EE] text-[#15803D]' : 'bg-[#FDECEA] text-[#D92916]',
          )}
        >
          {notice.text}
        </p>
      )}

      {data.rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
          <BookOpen className="h-10 w-10 text-gray-300" aria-hidden />
          <p className="mt-3 font-medium text-gray-900">아직 배정한 단원이 없습니다</p>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            코스를 불러오면 단원 순서와 마감일이 한 번에 정해져요. 배정이 없으면 학생은 자기 레벨에 맞는 본사 코스로 학습합니다.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" className="min-h-[44px]" onClick={() => setImportOpen(true)}>
              <ListPlus className="mr-1.5 h-4 w-4" />
              코스 불러오기
            </Button>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setAddOpen(true)}>
              포인트 직접 고르기
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="hidden grid-cols-[72px_minmax(0,1fr)_150px_80px_190px_150px] gap-3 bg-gray-50 px-4 py-2.5 text-sm font-medium uppercase text-gray-500 xl:grid">
            <span>순서</span>
            <span>포인트</span>
            <span>기간</span>
            <span>통과</span>
            <span>강의</span>
            <span className="text-right">관리</span>
          </div>
          <ol className="divide-y divide-gray-100">
            {data.rows.map((row, i) => (
              <AssignmentRowView
                key={row.id}
                row={row}
                index={i}
                total={data.rows.length}
                studentCount={data.studentCount}
                todayKey={data.todayKey}
                busy={busyId === row.id || busyId === `lecture-${row.id}` || busyId === 'all'}
                onMove={(dir) => run(row.id, () => moveClassAssignment(row.id, dir))}
                onEditDate={() =>
                  setDateTarget({ assignmentId: row.id, title: row.title, startKey: row.startKey, dueKey: row.dueKey })
                }
                onRemove={() => onRemove(row)}
                onLecture={() =>
                  setLectureTarget({ pointId: row.grammarPointId, pointTitle: row.title, existing: row.academyLecture })
                }
                onDeleteLecture={() => onDeleteLecture(row)}
                onAi={() => setAiTarget({ pointId: row.grammarPointId, pointTitle: row.title })}
                questionsHref={`${basePath}/questions`}
              />
            ))}
          </ol>
          <div className="flex justify-end border-t border-gray-100 px-4 py-2">
            <button
              type="button"
              onClick={onRemoveAll}
              disabled={busyId !== null}
              className="min-h-[44px] rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-[#D92916] disabled:opacity-50"
            >
              배정 모두 삭제
            </button>
          </div>
        </div>
      )}

      <CourseImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        classId={data.classId}
        templates={data.templates}
        todayKey={data.todayKey}
        onDone={done}
      />
      <AddPointsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        classId={data.classId}
        tree={data.tree}
        assignedPointIds={assignedPointIds}
        onDone={done}
      />
      <AssignmentDateDialog target={dateTarget} onClose={() => setDateTarget(null)} onDone={done} />
      <LectureDialog classId={data.classId} target={lectureTarget} onClose={() => setLectureTarget(null)} onDone={done} />
      <AiQuestionDialog
        role={role}
        classId={data.classId}
        target={aiTarget}
        credit={data.credit}
        questionsHref={`${basePath}/questions`}
        onClose={() => setAiTarget(null)}
        onDone={done}
      />
    </div>
  )
}

const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30'

function AssignmentRowView({
  row,
  index,
  total,
  studentCount,
  todayKey,
  busy,
  onMove,
  onEditDate,
  onRemove,
  onLecture,
  onDeleteLecture,
  onAi,
  questionsHref,
}: {
  row: ClassAssignmentRow
  index: number
  total: number
  studentCount: number
  todayKey: string
  busy: boolean
  onMove: (dir: 'up' | 'down') => void
  onEditDate: () => void
  onRemove: () => void
  onLecture: () => void
  onDeleteLecture: () => void
  onAi: () => void
  questionsHref: string
}) {
  const overdue = row.dueKey !== null && row.dueKey < todayKey && row.passedCount < studentCount
  const notStarted = row.startKey !== null && row.startKey > todayKey

  return (
    <li
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 px-3 py-3 sm:px-4 xl:grid-cols-[72px_minmax(0,1fr)_150px_80px_190px_150px] xl:items-center xl:gap-3',
        busy && 'opacity-60',
      )}
    >
      {/* 순서 */}
      <div className="col-start-1 row-span-4 row-start-1 flex flex-col items-center xl:col-start-auto xl:row-span-1 xl:row-start-auto xl:flex-row">
        <span className="w-6 text-center text-sm font-semibold text-gray-400">{index + 1}</span>
        <div className="flex flex-col">
          <button type="button" className={cn(iconButton, 'h-9 xl:h-8')} disabled={busy || index === 0} onClick={() => onMove('up')} aria-label="위로">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(iconButton, 'h-9 xl:h-8')}
            disabled={busy || index === total - 1}
            onClick={() => onMove('down')}
            aria-label="아래로"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 포인트 */}
      <div className="col-start-2 row-start-1 min-w-0 xl:col-start-auto xl:row-start-auto">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-gray-900">{row.title}</span>
          <span className="font-mono text-xs text-gray-400">{row.code}</span>
          {!row.published && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">공개 전 · 학생에게 안 보임</span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">{row.categoryLabel}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onAi}
            disabled={busy || !row.published}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-[#D9CFFD] px-2.5 font-medium text-[#7854F7] hover:bg-[#F3EFFE] disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            문제 AI 생성
          </button>
          {row.pendingQuestions > 0 && (
            <Link href={questionsHref} className="rounded-full bg-[#FFF4D6] px-2.5 py-1 font-medium text-[#B37A00] hover:underline">
              검수 대기 {row.pendingQuestions}
            </Link>
          )}
        </div>
      </div>

      {/* 기간 */}
      <div className="col-span-2 col-start-2 text-sm xl:col-span-1 xl:col-start-auto">
        <span className="mr-1 text-xs text-gray-400 xl:hidden">기간</span>
        {row.dueKey ? (
          <span className={overdue ? 'font-medium text-[#D92916]' : 'text-gray-700'}>~ {formatDateKey(row.dueKey)}</span>
        ) : (
          <span className="text-gray-400">마감일 없음</span>
        )}
        {row.startKey && (
          <span className={cn('block text-xs', notStarted ? 'text-[#B37A00]' : 'text-gray-400')}>
            {notStarted ? `${formatDateKey(row.startKey)}부터 공개` : `${formatDateKey(row.startKey)} 시작`}
          </span>
        )}
      </div>

      {/* 통과 */}
      <div className="col-span-2 col-start-2 text-sm text-gray-700 xl:col-span-1 xl:col-start-auto">
        <span className="mr-1 text-xs text-gray-400 xl:hidden">통과</span>
        <span className={row.passedCount > 0 && row.passedCount === studentCount ? 'font-medium text-[#1FAF54]' : ''}>
          {row.passedCount}/{studentCount}명
        </span>
      </div>

      {/* 강의 */}
      <div className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 text-sm xl:col-span-1 xl:col-start-auto">
        {row.lecture ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                row.lecture.scope === 'ACADEMY' ? 'bg-[#EFF4FF] text-[#1865F2]' : 'bg-gray-100 text-gray-600',
              )}
              title={row.lecture.title}
            >
              <Video className="h-3 w-3" aria-hidden />
              {row.lecture.scope === 'ACADEMY' ? '우리 학원' : '본사 기본'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs text-gray-500" title="시청 완료(80% 이상) 학생">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {row.lecture.completedCount}/{studentCount}명
            </span>
            {row.lecture.durationSec !== null && (
              <span className="text-xs text-gray-400">{formatLectureDuration(row.lecture.durationSec)}</span>
            )}
            {row.academyLecture ? (
              <span className="flex">
                <button type="button" className={cn(iconButton, 'h-8 w-8')} onClick={onLecture} disabled={busy} aria-label="우리 학원 강의 수정">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={cn(iconButton, 'h-8 w-8 hover:text-[#D92916]')} onClick={onDeleteLecture} disabled={busy} aria-label="우리 학원 강의 삭제">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={onLecture}
                disabled={busy || !row.published}
                className="min-h-[32px] rounded px-1.5 text-xs font-medium text-[#1865F2] hover:bg-[#EFF4FF] disabled:opacity-40"
              >
                우리 학원 강의로 바꾸기
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onLecture}
            disabled={busy || !row.published}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 text-sm font-medium text-[#1865F2] hover:border-[#1865F2] disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden />
            강의 등록
          </button>
        )}
      </div>

      {/* 관리 */}
      <div className="col-start-3 row-start-1 flex justify-end gap-0.5 xl:col-start-auto xl:row-start-auto xl:gap-1">
        <button type="button" className={iconButton} onClick={onEditDate} disabled={busy} aria-label="날짜 수정" title="날짜 수정">
          <CalendarDays className="h-4 w-4" />
        </button>
        <button type="button" className={cn(iconButton, 'hover:text-[#D92916]')} onClick={onRemove} disabled={busy} aria-label="배정 삭제" title="배정 삭제">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}
