'use client'

import { useState, useTransition } from 'react'
import { Building2, Plus, Pencil, Trash2, Users, UserCheck, MapPin, Phone, Crown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBranch, updateBranch, deleteBranch } from '../actions'

type BranchData = {
  id: string
  name: string
  branchName: string | null
  address: string | null
  phone: string | null
  _count: { users: number; classes: number }
  studentCount: number
  teacherCount: number
}

type HqData = {
  id: string
  name: string
  address: string | null
  phone: string | null
  _count: { users: number; classes: number }
  studentCount: number
  teacherCount: number
}

interface BranchesClientProps {
  hq: HqData
  branches: BranchData[]
  canManage: boolean
  totalStudents: number
  maxStudents: number
  totalTeachers: number
  maxTeachers: number
}

type FormState = { name: string; branchName: string; address: string; phone: string }
const EMPTY_FORM: FormState = { name: '', branchName: '', address: '', phone: '' }

export function BranchesClient({
  hq,
  branches,
  canManage,
  totalStudents,
  maxStudents,
  totalTeachers,
  maxTeachers,
}: BranchesClientProps) {
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BranchData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BranchData | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setForm(EMPTY_FORM)
    setError(null)
    setCreateOpen(true)
  }

  function openEdit(branch: BranchData) {
    setForm({
      name: branch.name,
      branchName: branch.branchName ?? '',
      address: branch.address ?? '',
      phone: branch.phone ?? '',
    })
    setError(null)
    setEditTarget(branch)
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const res = await createBranch(form)
      if (res.error) { setError(res.error); return }
      setCreateOpen(false)
    })
  }

  function handleEdit() {
    if (!editTarget) return
    setError(null)
    startTransition(async () => {
      const res = await updateBranch(editTarget.id, form)
      if (res.error) { setError(res.error); return }
      setEditTarget(null)
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await deleteBranch(deleteTarget.id)
      if (res.error) { alert(res.error); return }
      setDeleteTarget(null)
    })
  }

  const studentPct = maxStudents === -1 ? 0 : Math.min(100, Math.round((totalStudents / maxStudents) * 100))
  const teacherPct = maxTeachers === -1 ? 0 : Math.min(100, Math.round((totalTeachers / maxTeachers) * 100))

  return (
    <div className="space-y-6">
      {/* 통합 사용량 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">전체 학생 (본원+지점 합산)</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalStudents}
            <span className="text-sm font-normal text-gray-500 ml-1">
              / {maxStudents === -1 ? '무제한' : `${maxStudents}명`}
            </span>
          </p>
          {maxStudents !== -1 && (
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-700 rounded-full transition-all"
                style={{ width: `${studentPct}%` }}
              />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">전체 교사 (본원+지점 합산)</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalTeachers}
            <span className="text-sm font-normal text-gray-500 ml-1">
              / {maxTeachers === -1 ? '무제한' : `${maxTeachers}명`}
            </span>
          </p>
          {maxTeachers !== -1 && (
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-700 rounded-full transition-all"
                style={{ width: `${teacherPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 지점 목록 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          지점 목록 <span className="text-gray-400 font-normal">({branches.length + 1}개)</span>
        </h2>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={15} className="mr-1.5" />
            지점 추가
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          다지점 관리는 <strong>스탠다드 이상</strong> 플랜에서 사용 가능합니다.
          현재 지점 데이터는 통합 뷰로 표시됩니다.
        </div>
      )}

      {/* 본원 카드 */}
      <AcademyCard
        id={hq.id}
        name={hq.name}
        branchName={null}
        address={hq.address}
        phone={hq.phone}
        studentCount={hq.studentCount}
        teacherCount={hq.teacherCount}
        classCount={hq._count.classes}
        isHq
        canManage={false}
      />

      {/* 지점 카드들 */}
      {branches.map((b) => (
        <AcademyCard
          key={b.id}
          id={b.id}
          name={b.name}
          branchName={b.branchName}
          address={b.address}
          phone={b.phone}
          studentCount={b.studentCount}
          teacherCount={b.teacherCount}
          classCount={b._count.classes}
          isHq={false}
          canManage={canManage}
          onEdit={() => openEdit(b)}
          onDelete={() => setDeleteTarget(b)}
        />
      ))}

      {canManage && branches.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-4">아직 추가된 지점이 없습니다</p>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" />
            첫 지점 추가하기
          </Button>
        </div>
      )}

      {/* 지점 생성 모달 */}
      <BranchFormModal
        open={createOpen}
        title="새 지점 추가"
        form={form}
        error={error}
        isPending={isPending}
        onChange={setForm}
        onConfirm={handleCreate}
        onClose={() => setCreateOpen(false)}
      />

      {/* 지점 수정 모달 */}
      <BranchFormModal
        open={!!editTarget}
        title="지점 정보 수정"
        form={form}
        error={error}
        isPending={isPending}
        onChange={setForm}
        onConfirm={handleEdit}
        onClose={() => setEditTarget(null)}
      />

      {/* 지점 삭제 확인 모달 */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">지점 삭제</h2>
          <p className="text-sm text-gray-600">
            <strong>{deleteTarget?.branchName ?? deleteTarget?.name}</strong> 지점을 삭제하시겠습니까?
            <br />소속 구성원이 없는 경우에만 삭제할 수 있습니다.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isPending}
              onClick={handleDelete}
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AcademyCard({
  name,
  branchName,
  address,
  phone,
  studentCount,
  teacherCount,
  classCount,
  isHq,
  canManage,
  onEdit,
  onDelete,
}: {
  id: string
  name: string
  branchName: string | null
  address: string | null
  phone: string | null
  studentCount: number
  teacherCount: number
  classCount: number
  isHq: boolean
  canManage: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const displayName = branchName ?? name
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            {isHq
              ? <Crown size={18} className="text-primary-700" />
              : <Building2 size={18} className="text-primary-700" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{displayName}</span>
              {isHq && (
                <Badge className="text-xs bg-primary-50 text-primary-700 border-primary-200">
                  본원
                </Badge>
              )}
              {!isHq && branchName && (
                <span className="text-xs text-gray-400 truncate">{name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {address && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin size={11} />{address}
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} />{phone}
                </span>
              )}
            </div>
          </div>
        </div>
        {canManage && !isHq && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600"
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Users size={14} className="text-gray-400" />
          학생 {studentCount}명
        </span>
        <span className="flex items-center gap-1.5">
          <UserCheck size={14} className="text-gray-400" />
          교사 {teacherCount}명
        </span>
        <span className="text-gray-400">반 {classCount}개</span>
      </div>
    </div>
  )
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-lg p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}

function BranchFormModal({
  open,
  title,
  form,
  error,
  isPending,
  onChange,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  form: FormState
  error: string | null
  isPending: boolean
  onChange: (f: FormState) => void
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>지점 표시명 <span className="text-red-500">*</span></Label>
            <Input
              placeholder="예: 강남점, 서초점"
              value={form.branchName}
              onChange={(e) => onChange({ ...form, branchName: e.target.value })}
            />
            <p className="text-xs text-gray-400">사이드바와 지점 목록에 표시됩니다</p>
          </div>
          <div className="space-y-1.5">
            <Label>학원 공식 이름 <span className="text-red-500">*</span></Label>
            <Input
              placeholder="예: 위고업잉글리시 강남점"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>주소</Label>
            <Input
              placeholder="주소 입력"
              value={form.address}
              onChange={(e) => onChange({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>전화번호</Label>
            <Input
              placeholder="02-0000-0000"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? '처리 중...' : '저장'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
