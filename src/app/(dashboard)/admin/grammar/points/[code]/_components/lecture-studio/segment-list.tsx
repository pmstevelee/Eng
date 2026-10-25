'use client'

// 장면의 나레이션 세그먼트 목록 — 언어·문장·등장 단계(reveal)·정답 공개(answer)·퀴즈 대기, 글자 수·예상 초, 음성 상태

import { ArrowDown, ArrowUp, Hourglass, Plus, Trash2 } from 'lucide-react'
import type { Segment, VideoScene } from '@/types/grammar-video'
import { estimateSpeechMs } from '@/lib/grammar/video/timeline'
import { isSpokenSegment, segmentAudioState, speechChars, type AudioVoices, type SegmentAudioState } from '@/lib/grammar/video/audio-plan'
import { uniqueId } from '@/lib/grammar/video/script-prompt'
import { cn } from '@/lib/utils'
import { IconButton, StepInput, TextArea } from './studio-ui'

const AUDIO_LABEL: Record<SegmentAudioState, { label: string; className: string }> = {
  none: { label: '음성 없음', className: 'bg-gray-100 text-gray-500' },
  ready: { label: '음성 있음', className: 'bg-[#E8F7EE] text-[#15803D]' },
  stale: { label: '수정됨', className: 'bg-[#FFF4D6] text-[#8A5A00]' },
}

export function SegmentList({
  scene,
  allScenes,
  voices,
  onChange,
}: {
  scene: VideoScene
  allScenes: VideoScene[]
  voices: AudioVoices | null
  onChange: (segments: Segment[]) => void
}) {
  const segs = scene.segments
  const isQuiz = scene.template === 'quiz'
  const up = (i: number, patch: Partial<Segment>) => onChange(segs.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const without = (s: Segment, key: keyof Segment): Segment => {
    const copy = { ...s }
    delete copy[key]
    return copy
  }
  const newId = () =>
    uniqueId(
      `${scene.id}-${segs.length + 1}`,
      allScenes.flatMap((sc) => sc.segments.map((g) => g.id)),
    )

  function moveSeg(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= segs.length) return
    const next = [...segs]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {segs.map((s, i) => {
        const wait = Boolean(s.waitMs)
        const state = voices && isSpokenSegment(s) ? segmentAudioState(s, voices) : null
        const chars = speechChars(s.text)
        return (
          <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-center text-xs font-semibold tabular-nums text-gray-400">{i + 1}</span>
              {wait ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F1EDFF] px-2.5 py-1 text-xs font-semibold text-[#7854F7]">
                  <Hourglass className="h-3.5 w-3.5" />
                  퀴즈 대기
                </span>
              ) : (
                <div className="inline-flex overflow-hidden rounded-lg border border-gray-200" role="group" aria-label="언어">
                  {(['ko', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={s.lang === lang}
                      onClick={() => up(i, { lang })}
                      className={cn(
                        'h-11 px-3 text-xs font-semibold',
                        s.lang === lang ? 'bg-[#1865F2] text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
                      )}
                    >
                      {lang === 'ko' ? '한국어' : '영어'}
                    </button>
                  ))}
                </div>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-500">
                보여 줄 단계
                <StepInput
                  allowEmpty
                  value={s.reveal}
                  onChange={(v) => onChange(segs.map((x, k) => (k === i ? (v === undefined ? without(x, 'reveal') : { ...x, reveal: v }) : x)))}
                  title="이 문장을 읽기 전에 이 단계까지 화면에 보여 줘요 (비우면 그대로)"
                />
              </span>
              {isQuiz && !wait && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  정답 공개
                  <StepInput
                    allowEmpty
                    min={1}
                    max={4}
                    value={s.answer}
                    onChange={(v) => onChange(segs.map((x, k) => (k === i ? (v === undefined ? without(x, 'answer') : { ...x, answer: v }) : x)))}
                    title="이 문장을 읽기 전에 이 번호까지 정답을 보여 줘요"
                  />
                </span>
              )}
              {!wait && (
                <span className="text-xs tabular-nums text-gray-400">
                  {chars}자 · 약 {(estimateSpeechMs(s.text, s.lang) / 1000).toFixed(1)}초
                </span>
              )}
              {state && (
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', AUDIO_LABEL[state].className)}>
                  {AUDIO_LABEL[state].label}
                  {state === 'ready' && s.durationSec ? ` ${s.durationSec.toFixed(1)}초` : ''}
                </span>
              )}
              <span className="ml-auto flex gap-1">
                <IconButton label="위로" onClick={() => moveSeg(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton label="아래로" onClick={() => moveSeg(i, 1)} disabled={i === segs.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label="문장 삭제" tone="danger" onClick={() => onChange(segs.filter((_, k) => k !== i))} disabled={segs.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </span>
            </div>
            <div className="mt-2">
              {wait ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <label className="flex items-center gap-1">
                    대기
                    <StepInput
                      min={1}
                      max={30}
                      value={Math.round((s.waitMs ?? 5000) / 1000)}
                      onChange={(v) => up(i, { waitMs: (v ?? 5) * 1000 })}
                    />
                    초
                  </label>
                  <label className="flex min-h-[44px] items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(s.timer)}
                      onChange={(e) => onChange(segs.map((x, k) => (k === i ? (e.target.checked ? { ...x, timer: true } : without(x, 'timer')) : x)))}
                      className="h-5 w-5 accent-[#1865F2]"
                    />
                    타이머 막대 표시
                  </label>
                </div>
              ) : (
                <TextArea
                  value={s.text}
                  onChange={(v) => up(i, { text: v })}
                  placeholder={s.lang === 'en' ? 'English sentence' : '나레이션 문장'}
                  className={s.lang === 'en' ? 'font-medium' : undefined}
                />
              )}
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...segs, { id: newId(), lang: 'ko', text: '' }])}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-600 hover:border-[#1865F2] hover:text-[#1865F2]"
        >
          <Plus className="h-4 w-4" />
          문장 추가
        </button>
        {isQuiz && (
          <button
            type="button"
            onClick={() => onChange([...segs, { id: newId(), lang: 'ko', text: '', waitMs: 5000, timer: true }])}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-600 hover:border-[#7854F7] hover:text-[#7854F7]"
          >
            <Hourglass className="h-4 w-4" />
            대기 추가
          </button>
        )}
      </div>
    </div>
  )
}
