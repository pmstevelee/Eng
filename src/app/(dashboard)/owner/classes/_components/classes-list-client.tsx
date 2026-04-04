'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  MoreVertical,
  Users,
  BarChart2,
  Clock,
  BookOpen,
  AlertCircle,
  Pencil,
  Trash2,
  Power,
} from 'lucide-react'
import {
  createClass,
  updateClass,
  toggleClassActive,
  deleteClass,
  type ClassInput,
  type ScheduleData,
} from '../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassItem = {
  id: string
  name: string
  levelRange: string | null
  isActive: boolean
  teacherName: string | null
  teacherId: string | null
  studentCount: number
  avgScore: number | null
  schedule: ScheduleData | null
}

type Teacher = { id: string; name: string }

type Props = {
  initialClasses: ClassItem[]
  teachers: Teacher[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['월', '화', '수', '목', '금', '토']
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1)

function formatSchedule(s: ScheduleData | null): string {
  if (!s || !s.days?.length) return '시간표 미정'
  return `${s.days.join('/')} ${s.startTime}-${s.endTime}`
}

function parseLevelRange(lr: string | null): { start: number; end: number } {
  if (!lr) return { start: 1, end: 3 }
  const m = lr.match(/Level\s+(\d+)(?:-(\d+))?/)
  if (!m) return { start: 1, end: 3 }
  const start = parseInt(m[1])
  const end = m[2] ? parseInt(m[2]) : start
  return { start, end }
}

type FormState = {
  name: string
  levelStart: number
  levelEnd: number
  teacherId: string
  days: string[]
  startTime: string
  endTime: string
  room: string
}

const defaultForm: FormState = {
  name: '',
  levelStart: 1,
  levelEnd: 3,
  teacherId: '',
  days: [],
  startTime: '16:00',
  endTime: '17:30',
  room: '',
}

function classToForm(cls: ClassItem): FormState {
  const { start, end } = parseLevelRange(cls.levelRange)
  return {
    name: cls.name,
    levelStart: start,
    levelEnd: end,
    teacherId: cls.teacherId ?? '',
    days: cls.schedule?.days ?? [],
    startTime: cls.schedule?.startTime ?? '16:00',
    endTime: cls.schedule?.endTime ?? '17:30',
    room: cls.schedule?.room ?? '',
  }
}

// ─── Card ⋮ Menu ──────────────────────────────────────────────────────────────

function CardMenu({
  cls,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  cls: ClassItem
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-20 w-40 bg-white rounded-xl border border-gray-200 shadow-sm py-1">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              onEdit()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} />
            수정
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              onToggleActive()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Power size={14} />
            {cls.isActive ? '비활성화' : '활성화'}
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              onDelete()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-red hover:bg-accent-red-light transition-colors"
          >
            <Trash2 size={14} />
            삭제
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Class Card ───────────────────────────────────────────────────────────────

function ClassCard({
  cls,
  teachers,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  cls: ClassItem
  teachers: Teacher[]
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  return (
    <Link
      href={`/owner/classes/${cls.id}`}
      prefetch={false}
      className={`relative block bg-white rounded-xl border p-5 hover:border-primary-700 transition-colors cursor-pointer group ${
        cls.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
      }`}
    >
      {/* 상단: 이름 + 메뉴 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 truncate">{cls.name}</h3>
            {!cls.isActive && (
              <span className="inline-flex items-center text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                비활성
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{cls.teacherName ?? '담당 교사 미정'}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <CardMenu
            cls={cls}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* 레벨 배지 */}
      {cls.levelRange && (
        <span className="inline-flex items-center text-xs font-semibold text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full mb-4">
          {cls.levelRange}
        </span>
      )}

      {/* 통계 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Users size={14} className="text-gray-400 flex-shrink-0" />
          <span>
            <span className="font-medium">{cls.studentCount}</span>
            <span className="text-gray-500">명</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <BarChart2 size={14} className="text-gray-400 flex-shrink-0" />
          {cls.avgScore !== null ? (
            <span>
              <span className="font-medium">{cls.avgScore}</span>
              <span className="text-gray-500">점 평균</span>
            </span>
          ) : (
            <span className="text-gray-400">점수 데이터 없음</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Clock size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-gray-500">{formatSchedule(cls.schedule)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Class Dialog (Create / Edit) ─────────────────────────────────────────────

function ClassDialog({
  open,
  editing,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: ClassItem | null
  teachers: Teacher[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setForm(editing ? classToForm(editing) : defaultForm)
      setError('')
    }
  }, [open, editing])

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }))
  }, [])

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }))
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('반 이름을 입력해주세요.')
      return
    }
    if (form.levelStart > form.levelEnd) {
      setError('시작 레벨이 끝 레벨보다 클 수 없습니다.')
      return
    }

    const input: ClassInput = {
      name: form.name.trim(),
      levelStart: form.levelStart,
      levelEnd: form.levelEnd,
      teacherId: form.teacherId || null,
      schedule: {
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room,
      },
    }

    startTransition(async () => {
      const result = editing
        ? await updateClass(editing.id, input)
        : await createClass(input)

      if (result.error) {
        setError(result.error)
      } else {
        onSaved()
        onClose()
      }
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-sm w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{editing ? '반 수정' : '반 추가'}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 폼 */}
        <div className="px-6 py-5 space-y-5">
          {/* 반 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              반 이름 <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="예: 수요일 중급반"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
          </div>

          {/* 레벨 범위 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">레벨 범위</label>
            <div className="flex items-center gap-3">
              <select
                value={form.levelStart}
                onChange={(e) => set('levelStart', parseInt(e.target.value))}
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    Level {l}
                  </option>
                ))}
              </select>
              <span className="text-gray-400 text-sm">~</span>
              <select
                value={form.levelEnd}
                onChange={(e) => set('levelEnd', parseInt(e.target.value))}
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    Level {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 담당 교사 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">담당 교사</label>
            <select
              value={form.teacherId}
              onChange={(e) => set('teacherId', e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              <option value="">미배정</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 수업 시간표 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">수업 시간표</label>

            {/* 요일 */}
            <div className="flex gap-2 mb-3">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                    form.days.includes(day)
                      ? 'bg-primary-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* 시작/종료 시간 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">시작 시간</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">종료 시간</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
                />
              </div>
            </div>

            {/* 교실명 */}
            <input
              type="text"
              value={form.room}
              onChange={(e) => set('room', e.target.value)}
              placeholder="교실명 (선택)"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
            />
          </div>

          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        {/* 버튼 */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  cls,
  onClose,
  onDeleted,
}: {
  cls: ClassItem
  onClose: () => void
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      await deleteClass(cls.id)
      onDeleted()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-sm w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">반 삭제</h2>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-semibold">{cls.name}</span>을(를) 삭제하시겠습니까?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          소속 학생들은 미배정 상태로 전환됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 h-11 rounded-xl bg-accent-red text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClassesListClient({ initialClasses, teachers }: Props) {
  const [classes, setClasses] = useState(initialClasses)
  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null)
  const [, startTransition] = useTransition()

  const visible = showInactive ? classes : classes.filter((c) => c.isActive)

  const handleEdit = (cls: ClassItem) => {
    setEditingClass(cls)
    setDialogOpen(true)
  }

  const handleToggleActive = (cls: ClassItem) => {
    startTransition(async () => {
      await toggleClassActive(cls.id)
      setClasses((prev) =>
        prev.map((c) => (c.id === cls.id ? { ...c, isActive: !c.isActive } : c)),
      )
    })
  }

  const handleSaved = () => {
    // revalidatePath is called in the server action
  }

  const handleDeleted = () => {
    setClasses((prev) => prev.filter((c) => c.id !== deletingClass?.id))
  }

  return (
    <>
      {/* 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            총 <span className="font-medium text-gray-900">{visible.length}</span>개 반
          </span>
          <label className="flex items-center gap-1.5 ml-4 cursor-pointer select-none">
            <div
              onClick={() => setShowInactive((v) => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                showInactive ? 'bg-primary-700' : 'bg-gray-200'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  showInactive ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm text-gray-600">비활성 반 표시</span>
          </label>
        </div>

        <button
          onClick={() => {
            setEditingClass(null)
            setDialogOpen(true)
          }}
          className="flex items-center gap-2 h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
        >
          <Plus size={16} />
          반 추가
        </button>
      </div>

      {/* 카드 그리드 */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
            <BookOpen size={28} className="text-primary-700" />
          </div>
          <p className="text-sm font-medium text-gray-700">아직 생성된 반이 없습니다.</p>
          <p className="text-xs text-gray-400">반을 추가하고 학생을 배정해보세요.</p>
          <button
            onClick={() => {
              setEditingClass(null)
              setDialogOpen(true)
            }}
            className="mt-2 flex items-center gap-2 h-10 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
          >
            <Plus size={15} />
            반 추가
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              teachers={teachers}
              onEdit={() => handleEdit(cls)}
              onToggleActive={() => handleToggleActive(cls)}
              onDelete={() => setDeletingClass(cls)}
            />
          ))}
        </div>
      )}

      {/* 상태 없음 알림 */}
      {classes.filter((c) => !c.isActive).length > 0 && !showInactive && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <AlertCircle size={13} />
          <span>
            비활성 반 {classes.filter((c) => !c.isActive).length}개가 숨겨져 있습니다. 토글을
            켜면 볼 수 있습니다.
          </span>
        </div>
      )}

      {/* Dialog */}
      <ClassDialog
        open={dialogOpen}
        editing={editingClass}
        teachers={teachers}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete Confirm */}
      {deletingClass && (
        <DeleteConfirm
          cls={deletingClass}
          onClose={() => setDeletingClass(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  )
}
