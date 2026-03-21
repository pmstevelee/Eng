'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Users, FileText, BarChart2, X, Plus } from 'lucide-react'
import {
  assignClassToTeacher,
  unassignClassFromTeacher,
  updateTeacherPermissions,
  removeTeacherFromAcademy,
} from '../../actions'
import type { TeacherPermissions } from '../../actions'

type TeacherClass = {
  id: string
  name: string
  studentCount: number
}

type AllClass = {
  id: string
  name: string
  currentTeacherId: string | null
}

type TeacherData = {
  id: string
  name: string
  email: string
  createdAt: string
  classes: TeacherClass[]
  totalStudents: number
  testCount: number
  avgScore: number | null
}

type Props = {
  teacher: TeacherData
  allClasses: AllClass[]
  permissions: TeacherPermissions
}

export default function TeacherDetailClient({ teacher, allClasses, permissions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [showClassAssign, setShowClassAssign] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')

  const [perms, setPerms] = useState<TeacherPermissions>(permissions)

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 2500)
  }

  // 현재 교사에게 배정된 반 ID 목록
  const assignedClassIds = new Set(teacher.classes.map((c) => c.id))

  // 배정 가능한 반 (다른 교사에게 배정됐거나 미배정 반)
  const assignableClasses = allClasses.filter(
    (c) => !assignedClassIds.has(c.id) && c.currentTeacherId !== teacher.id,
  )

  const handleAssignClass = () => {
    if (!selectedClassId) return
    setError(null)
    startTransition(async () => {
      const res = await assignClassToTeacher(teacher.id, selectedClassId)
      if (res.error) {
        setError(res.error)
      } else {
        showSuccess('반이 배정되었습니다.')
        setShowClassAssign(false)
        setSelectedClassId('')
      }
    })
  }

  const handleUnassignClass = (classId: string) => {
    setError(null)
    startTransition(async () => {
      const res = await unassignClassFromTeacher(teacher.id, classId)
      if (res.error) setError(res.error)
      else showSuccess('반 배정이 해제되었습니다.')
    })
  }

  const handlePermissionToggle = (key: keyof TeacherPermissions) => {
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next)
    setError(null)
    startTransition(async () => {
      const res = await updateTeacherPermissions(teacher.id, next)
      if (res.error) {
        setError(res.error)
        setPerms(perms) // 롤백
      } else {
        showSuccess('권한이 업데이트되었습니다.')
      }
    })
  }

  const handleRemove = () => {
    setError(null)
    startTransition(async () => {
      const res = await removeTeacherFromAcademy(teacher.id)
      if (res.error) {
        setError(res.error)
        setShowRemoveConfirm(false)
      } else {
        router.push('/owner/teachers')
      }
    })
  }

  const statItems = [
    {
      label: '담당 반',
      value: teacher.classes.length,
      unit: '개',
      icon: GraduationCap,
      color: 'text-primary-700',
      bg: 'bg-primary-100',
    },
    {
      label: '담당 학생',
      value: teacher.totalStudents,
      unit: '명',
      icon: Users,
      color: 'text-accent-teal',
      bg: 'bg-accent-teal-light',
    },
    {
      label: '출제한 테스트',
      value: teacher.testCount,
      unit: '개',
      icon: FileText,
      color: 'text-accent-purple',
      bg: 'bg-accent-purple-light',
    },
    {
      label: '학생 평균 점수',
      value: teacher.avgScore != null ? Math.round(teacher.avgScore) : '—',
      unit: teacher.avgScore != null ? '점' : '',
      icon: BarChart2,
      color: 'text-accent-green',
      bg: 'bg-accent-green-light',
    },
  ]

  return (
    <div className="space-y-6">
      {/* 에러 / 성공 메시지 */}
      {error && (
        <div className="bg-accent-red-light border border-accent-red rounded-xl px-4 py-3 text-sm text-accent-red">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-accent-green-light border border-accent-green rounded-xl px-4 py-3 text-sm text-accent-green font-medium">
          {successMsg}
        </div>
      )}

      {/* 프로필 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent-purple-light flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-accent-purple">{teacher.name.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{teacher.name}</h2>
            <p className="text-sm text-gray-500">{teacher.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              가입일:{' '}
              {new Date(teacher.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* 성과 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={item.color} />
              </div>
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {item.value}
                <span className="text-sm font-normal text-gray-500 ml-0.5">{item.unit}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* 담당 반 관리 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">담당 반 배정</h3>
          {assignableClasses.length > 0 && (
            <button
              onClick={() => setShowClassAssign((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors"
            >
              <Plus size={14} />
              반 추가
            </button>
          )}
        </div>

        {/* 반 추가 폼 */}
        {showClassAssign && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              <option value="">반 선택</option>
              {assignableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.currentTeacherId ? ' (다른 교사 배정 중)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignClass}
              disabled={!selectedClassId || isPending}
              className="px-4 h-10 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              배정
            </button>
            <button
              onClick={() => {
                setShowClassAssign(false)
                setSelectedClassId('')
              }}
              className="px-3 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        )}

        {teacher.classes.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">담당 반이 없습니다.</p>
            <p className="text-xs text-gray-300 mt-1">위 버튼으로 반을 배정하세요.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  반 이름
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  학생 수
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teacher.classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={14} className="text-primary-700 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900">{cls.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{cls.studentCount}명</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleUnassignClass(cls.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-accent-red transition-colors disabled:opacity-40"
                      title="배정 해제"
                    >
                      <X size={14} />
                      해제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 권한 설정 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">권한 설정</h3>
        <div className="space-y-3">
          <PermissionToggle
            label="문제 생성"
            description="테스트 문제를 직접 생성할 수 있습니다."
            enabled={perms.canCreateQuestions}
            disabled={isPending}
            onToggle={() => handlePermissionToggle('canCreateQuestions')}
          />
          <PermissionToggle
            label="성적 수정"
            description="학생의 테스트 점수를 수정할 수 있습니다."
            enabled={perms.canEditGrades}
            disabled={isPending}
            onToggle={() => handlePermissionToggle('canEditGrades')}
          />
        </div>
      </div>

      {/* 위험 구역: 교사 제거 */}
      <div className="bg-accent-red-light border border-accent-red rounded-xl p-5">
        <h3 className="text-sm font-semibold text-accent-red mb-2">교사 제거</h3>
        <p className="text-sm text-gray-700 mb-4">
          학원에서 이 교사를 제거합니다. 교사의 계정은 유지되지만 담당 반이 모두 해제되고 학원
          데이터에 접근할 수 없게 됩니다.
        </p>

        {!showRemoveConfirm ? (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="px-4 py-2.5 rounded-xl border border-accent-red text-accent-red text-sm font-medium hover:bg-white transition-colors"
          >
            이 교사 제거
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">
              정말로 <span className="text-accent-red">{teacher.name}</span> 교사를 학원에서
              제거하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl bg-accent-red text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? '처리 중…' : '제거 확인'}
              </button>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PermissionToggle({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-700 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
          enabled ? 'bg-primary-700' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
