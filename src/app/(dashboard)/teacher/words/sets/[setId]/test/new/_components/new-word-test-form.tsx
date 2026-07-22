'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { createWordTestAssignment } from '@/app/(dashboard)/teacher/words/actions'

interface Props {
  setId: string
  setTitle: string
  wordCount: number
  classes: { id: string; name: string; students: { id: string; name: string }[] }[]
}

const MODE_LABELS: Record<string, string> = {
  EN_TO_KO: '영어 → 한국어 (객관식)',
  KO_TO_EN: '한국어 → 영어 (객관식)',
  SPELL: '영어 스펠링 받아쓰기',
  MIXED: '혼합 (영↔한 랜덤)',
}

const TIME_OPTIONS = [
  { value: '20', label: '20초 (쉬움)' },
  { value: '12', label: '12초 (보통)' },
  { value: '8', label: '8초 (어려움)' },
  { value: '5', label: '5초 (도전)' },
]

export function NewWordTestForm({ setId, setTitle, wordCount, classes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle2] = useState(`${setTitle} 단어 시험`)
  const [mode, setMode] = useState('EN_TO_KO')
  const [timePerQuestion, setTimePerQuestion] = useState('20')
  const [numQuestions, setNumQuestions] = useState(Math.min(20, wordCount).toString())
  const [passingScore, setPassingScore] = useState('80')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function toggleClass(studentIds: string[]) {
    const allSelected = studentIds.length > 0 && studentIds.every((id) => selectedStudentIds.includes(id))
    setSelectedStudentIds((prev) =>
      allSelected
        ? prev.filter((id) => !studentIds.includes(id))
        : Array.from(new Set([...prev, ...studentIds])),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (selectedStudentIds.length === 0) {
      setError('배정할 학생을 한 명 이상 선택해주세요.')
      return
    }

    startTransition(async () => {
      const result = await createWordTestAssignment({
        setId,
        title: title.trim(),
        mode: mode as 'EN_TO_KO' | 'KO_TO_EN' | 'SPELL' | 'MIXED',
        timePerQuestion: Number(timePerQuestion),
        numQuestions: Number(numQuestions),
        passingScore: Number(passingScore),
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        studentIds: selectedStudentIds,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      router.push(`/teacher/words/sets/${setId}/test/${result.id}/results`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 시험 제목 */}
      <div className="space-y-1.5">
        <Label htmlFor="title">시험 제목</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle2(e.target.value)}
          required
          maxLength={100}
          className="h-11"
        />
      </div>

      {/* 문제 유형 */}
      <div className="space-y-1.5">
        <Label>문제 유형</Label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="w-full h-11 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1865F2]"
        >
          {Object.entries(MODE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 문항당 시간 */}
        <div className="space-y-1.5">
          <Label>문항당 제한시간</Label>
          <select
            value={timePerQuestion}
            onChange={(e) => setTimePerQuestion(e.target.value)}
            className="w-full h-11 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1865F2]"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 문항 수 */}
        <div className="space-y-1.5">
          <Label htmlFor="numQuestions">문항 수 (최대 {wordCount})</Label>
          <Input
            id="numQuestions"
            type="number"
            min={1}
            max={wordCount}
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
            required
            className="h-11"
          />
        </div>
      </div>

      {/* 합격 기준 */}
      <div className="space-y-1.5">
        <Label htmlFor="passingScore">합격 기준 점수 (%)</Label>
        <Input
          id="passingScore"
          type="number"
          min={1}
          max={100}
          value={passingScore}
          onChange={(e) => setPassingScore(e.target.value)}
          required
          className="h-11"
        />
      </div>

      {/* 응시 기간 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt">시작일시 (선택)</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt">마감일시 (선택)</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* 배정 대상 */}
      <div className="space-y-2">
        <Label>배정 대상 (반 또는 학생 선택)</Label>
        {classes.length === 0 ? (
          <p className="text-sm text-gray-500">담당 반이 없습니다.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 divide-y max-h-96 overflow-y-auto">
            {classes.map((cls) => {
              const classStudentIds = cls.students.map((s) => s.id)
              const allSelected =
                classStudentIds.length > 0 && classStudentIds.every((id) => selectedStudentIds.includes(id))
              return (
                <div key={cls.id} className="p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={allSelected} onCheckedChange={() => toggleClass(classStudentIds)} />
                    <span className="flex-1 text-sm font-semibold text-gray-900">{cls.name}</span>
                    <span className="text-xs text-gray-400">{cls.students.length}명</span>
                  </label>
                  {cls.students.length > 0 ? (
                    <div className="mt-2 ml-7 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {cls.students.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <Checkbox
                            checked={selectedStudentIds.includes(s.id)}
                            onCheckedChange={() => toggleStudent(s.id)}
                          />
                          <span className="text-sm text-gray-600">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 ml-7 text-xs text-gray-400">학생이 없습니다.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="text-sm text-gray-500">
          선택된 학생: <span className="font-semibold text-gray-900">{selectedStudentIds.length}명</span>
        </p>
      </div>

      {error && (
        <p className="text-sm text-[#D92916] bg-[#D92916]/5 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-12"
          onClick={() => router.back()}
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={isPending || selectedStudentIds.length === 0}
          className="flex-1 h-12 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white font-semibold"
        >
          {isPending ? '생성 중...' : `${selectedStudentIds.length}명에게 시험 출제하기`}
        </Button>
      </div>
    </form>
  )
}
