'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, GraduationCap, RefreshCw } from 'lucide-react'
import { convertLeadToStudent } from '@/lib/consultation/actions'
import { GRADE_OPTIONS } from '@/lib/consultation/constants'
import { Field, FormActions, FormError, ModalShell, inputClass } from './modal-shell'

type Props = {
  leadId: string
  studentName: string
  defaultGrade: string | null
  classOptions: { id: string; name: string }[]
  onClose: () => void
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  const buf = new Uint32Array(10)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => chars[n % chars.length]).join('')
}

export function ConvertToStudentDialog(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    name: props.studentName,
    email: '',
    password: '',
    classId: '',
    grade: props.defaultGrade ?? '',
    currentLevel: '1',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await convertLeadToStudent(props.leadId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        classId: form.classId || undefined,
        grade: form.grade || undefined,
        currentLevel: parseInt(form.currentLevel, 10),
      })
      if (result.error) {
        setError(result.error)
        return
      }
      props.onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell title="학생으로 등록" icon={GraduationCap} onClose={props.onClose}>
      <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
        <div className="rounded-xl bg-primary-100 px-4 py-3 text-sm text-gray-900">
          학생 로그인 계정을 만들고 상태를 &lsquo;등록&rsquo;으로 변경합니다. 상담 기록은 학생과 연결되어
          유지됩니다.
        </div>

        <Field label="학생 이름" required>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={50}
            required
          />
        </Field>

        <Field label="이메일 (로그인 아이디)" required>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="student@example.com"
            required
          />
        </Field>

        <Field label="비밀번호" required hint="학생이 처음 로그인할 때 사용할 비밀번호입니다.">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`${inputClass} pr-11`}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                minLength={6}
                placeholder="최소 6자 이상"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                set('password', generatePassword())
                setShowPassword(true)
              }}
              className="h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw size={13} />
              자동생성
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="반 배정">
            <select className={inputClass} value={form.classId} onChange={(e) => set('classId', e.target.value)}>
              <option value="">미배정</option>
              {props.classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="학년">
            <select className={inputClass} value={form.grade} onChange={(e) => set('grade', e.target.value)}>
              <option value="">미선택</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="시작 레벨" hint="등록 후 레벨 테스트 결과에 따라 조정할 수 있습니다.">
          <select className={inputClass} value={form.currentLevel} onChange={(e) => set('currentLevel', e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>
                Lv.{l}
              </option>
            ))}
          </select>
        </Field>

        <FormError message={error} />
        <FormActions onCancel={props.onClose} pending={isPending} submitLabel="계정 생성 및 등록" pendingLabel="생성 중..." />
      </form>
    </ModalShell>
  )
}
