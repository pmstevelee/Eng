'use client'

// 단원 학습 › 강의 단계 — YouTube 플레이어 + 출처 배지 + 시청률 막대(80% 표시선)
// 강의 시청은 통과 조건이 아니므로 "연습 문제로"는 언제든 누를 수 있다.

import { useState } from 'react'
import { CheckCircle2, FileText, SkipForward } from 'lucide-react'
import { YoutubeLecturePlayer } from '@/components/grammar/youtube-lecture-player'
import { LECTURE_COMPLETE_PERCENT, formatLectureDuration } from '@/lib/grammar/lecture-input'
import type { StudentLecture } from '@/lib/grammar/lectures'
import { cn } from '@/lib/utils'
import { saveGrammarLectureProgress } from '../actions'

interface Props {
  code: string
  studentId: string
  lecture: StudentLecture
  onNext: () => void
}

export function LectureStep({ code, studentId, lecture, onNext }: Props) {
  const [percent, setPercent] = useState(lecture.watchedPercent)
  const [completed, setCompleted] = useState(lecture.completed)

  const shown = Math.max(percent, lecture.watchedPercent)
  const done = completed || shown >= LECTURE_COMPLETE_PERCENT

  function handlePercent(p: number) {
    setPercent((prev) => Math.max(prev, p))
  }

  function handleSave(p: number) {
    saveGrammarLectureProgress(code, lecture.id, p)
      .then((res) => {
        if (res.ok && res.completed) setCompleted(true)
      })
      .catch(() => undefined)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {lecture.isAcademy ? (
          <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-xs font-semibold text-[#1865F2]">
            우리 학원 강의{lecture.teacherName ? ` · ${lecture.teacherName} 선생님` : ''}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">본사 기본</span>
        )}
        {lecture.durationSec ? <span className="text-xs text-gray-500">{formatLectureDuration(lecture.durationSec)}</span> : null}
      </div>
      <h3 className="text-lg font-bold text-gray-900">{lecture.title}</h3>

      <YoutubeLecturePlayer
        videoId={lecture.videoId}
        title={lecture.title}
        durationSec={lecture.durationSec}
        storageKey={`grammar-lecture:${studentId}:${lecture.id}`}
        onPercentChange={handlePercent}
        onSave={handleSave}
      />

      {/* 시청률 막대 — 80% 지점에 표시선 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">시청률</span>
          {done ? (
            <span className="flex items-center gap-1 font-semibold text-[#1FAF54]">
              <CheckCircle2 className="h-4 w-4" />
              강의 완료 · {shown}%
            </span>
          ) : (
            <span className="tabular-nums text-gray-600">{shown}%</span>
          )}
        </div>
        <div
          className="relative mt-2 h-2.5 rounded-full bg-gray-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={shown}
          aria-label="강의 시청률"
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', done ? 'bg-[#1FAF54]' : 'bg-[#1865F2]')}
            style={{ width: `${shown}%` }}
          />
          <div
            className="absolute -top-1 h-[18px] w-0.5 rounded bg-gray-400"
            style={{ left: `${LECTURE_COMPLETE_PERCENT}%` }}
            aria-hidden
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {done
            ? '잘했어요! 이제 연습 문제로 확인해 봐요.'
            : `실제로 본 부분만 계산해요. ${LECTURE_COMPLETE_PERCENT}% 이상 보면 강의 완료예요.`}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {!done && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <SkipForward className="h-4 w-4" />
            강의 건너뛰기
          </button>
        )}
        {lecture.notesUrl && (
          <a
            href={lecture.notesUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            강의 노트
          </a>
        )}
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1558d6] sm:ml-auto"
        >
          연습 문제로
        </button>
      </div>
    </div>
  )
}
