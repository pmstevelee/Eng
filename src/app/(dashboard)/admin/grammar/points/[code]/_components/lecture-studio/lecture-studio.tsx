'use client'

// 포인트 "강의" 탭의 AI 강의 제작 — 스크립트 → 장면 편집 → 음성 → 미리보기·내보내기(2-5-5) → YouTube 연결(2-5-6)
// 관리자 전용. 만든 영상은 관리자가 YouTube에 올리고 링크를 본사 기본 강의로 연결한다.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clapperboard, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LectureScriptBadge } from '@/components/grammar/lecture-script-badge'
import type { AdminLectureScript } from '@/lib/grammar/lecture-scripts'
import type { AudioVoices } from '@/lib/grammar/video/audio-plan'
import { cn } from '@/lib/utils'
import { deleteScript } from '../../../../lecture-script-actions'
import { CreateScriptPanel } from './create-script-panel'
import { SceneEditor } from './scene-editor'
import { AudioPanel } from './audio-panel'
import { NoticeBox, SelectInput, type Notice } from './studio-ui'

type Step = 'script' | 'scenes' | 'audio' | 'export' | 'youtube'

const STEPS: { value: Step; label: string }[] = [
  { value: 'script', label: '스크립트' },
  { value: 'scenes', label: '장면 편집' },
  { value: 'audio', label: '음성' },
  { value: 'export', label: '미리보기·내보내기' },
  { value: 'youtube', label: 'YouTube 연결' },
]

/** 상태별로 끝난 단계 */
function doneSteps(status: string): Set<Step> {
  if (status === 'LINKED') return new Set<Step>(['script', 'scenes', 'audio', 'export', 'youtube'])
  if (status === 'AUDIO_READY') return new Set<Step>(['script', 'scenes', 'audio'])
  if (status === 'APPROVED') return new Set<Step>(['script', 'scenes'])
  return new Set<Step>(['script'])
}

function defaultStep(status: string): Step {
  if (status === 'APPROVED') return 'audio'
  if (status === 'AUDIO_READY' || status === 'LINKED') return 'export'
  return 'scenes'
}

export function LectureStudio({
  pointId,
  scripts,
  voicesByScript,
}: {
  pointId: string
  scripts: AdminLectureScript[]
  voicesByScript: Record<string, AudioVoices | null>
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(scripts[0]?.id ?? null)
  const [creating, setCreating] = useState(scripts.length === 0)
  const selected = scripts.find((s) => s.id === selectedId) ?? null
  const [step, setStep] = useState<Step>(selected ? defaultStep(selected.status) : 'script')
  const [notice, setNotice] = useState<Notice>(null)
  const [deleting, startDelete] = useTransition()

  // 방금 만든 스크립트는 새로고침이 끝나야 목록에 들어온다 — 그동안은 불러오는 중으로 둔다
  const waitingForNew = !creating && selectedId !== null && !selected

  function selectScript(id: string) {
    const s = scripts.find((x) => x.id === id)
    setSelectedId(id)
    setCreating(false)
    setNotice(null)
    if (s) setStep(defaultStep(s.status))
  }

  function startCreating() {
    setCreating(true)
    setNotice(null)
  }

  function handleDelete() {
    if (!selected) return
    const linked = selected.lecture ? '\n연결된 YouTube 강의는 그대로 남아요.' : ''
    if (!window.confirm(`"${selected.title}" 스크립트와 만든 음성을 모두 지울까요?${linked}`)) return
    startDelete(async () => {
      const res = await deleteScript(selected.id)
      if (res.ok) {
        setNotice({ kind: 'ok', text: '스크립트를 지웠어요.' })
        const rest = scripts.filter((s) => s.id !== selected.id)
        setSelectedId(rest[0]?.id ?? null)
        if (rest.length === 0) setCreating(true)
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error })
    })
  }

  const done = selected ? doneSteps(selected.status) : new Set<Step>()

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EDFF]">
            <Clapperboard className="h-5 w-5 text-[#7854F7]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">AI 강의 제작</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              관리자 원고로 강의 영상 스크립트를 만들고 음성을 입힙니다. 완성한 영상은 YouTube에 올려 위 본사 기본 강의로 연결해요.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scripts.length > 0 && (
            <SelectInput
              ariaLabel="스크립트 선택"
              value={creating ? '' : selectedId ?? ''}
              onChange={(v) => (v ? selectScript(v) : startCreating())}
              className="w-64"
              options={[
                ...scripts.map((s) => ({
                  value: s.id,
                  label: `${s.title}${s.seriesNo ? ` #${s.seriesNo}` : ''} · ${new Date(s.createdAt).toLocaleDateString('ko-KR')}`,
                })),
                ...(creating ? [{ value: '', label: '새 스크립트' }] : []),
              ]}
            />
          )}
          {!creating && (
            <Button type="button" variant="outline" className="h-11" onClick={startCreating}>
              <Plus className="mr-1 h-4 w-4" />새 스크립트
            </Button>
          )}
        </div>
      </div>

      <NoticeBox notice={notice} />

      {waitingForNew ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">스크립트를 불러오는 중…</p>
      ) : creating || !selected ? (
        <div className="space-y-3">
          <CreateScriptPanel
            pointId={pointId}
            scriptCount={scripts.length}
            onCreated={(id, n) => {
              setSelectedId(id)
              setCreating(false)
              setStep('scenes')
              setNotice(n)
            }}
          />
          {scripts.length > 0 && (
            <Button type="button" variant="ghost" className="h-11" onClick={() => setCreating(false)}>
              취소
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <LectureScriptBadge status={selected.status} />
            <span className="text-xs text-gray-500">
              {selected.source === 'MANUAL' ? '붙여넣은 대본' : 'AI 생성'}
              {selected.createdByName ? ` · ${selected.createdByName}` : ''} · 음성 누적 {selected.totalChars.toLocaleString()}자
            </span>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto h-11 text-gray-500 hover:text-[#D92916]"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              스크립트 삭제
            </Button>
          </div>

          <ol className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="제작 단계">
            {STEPS.map((s, i) => {
              const disabled = s.value === 'script' || s.value === 'export' || s.value === 'youtube'
              return (
                <li key={s.value} className="shrink-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setStep(s.value)}
                    aria-current={step === s.value ? 'step' : undefined}
                    className={cn(
                      '-mb-px inline-flex min-h-[44px] items-center gap-1.5 border-b-2 px-3 text-sm font-medium',
                      step === s.value ? 'border-[#1865F2] text-[#1865F2]' : 'border-transparent text-gray-500 hover:text-gray-900',
                      disabled && 'cursor-default hover:text-gray-500',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                        done.has(s.value) ? 'bg-[#1FAF54] text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {done.has(s.value) ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ol>

          {step === 'scenes' && <SceneEditor key={selected.id} script={selected} voices={voicesByScript[selected.id] ?? null} />}
          {step === 'audio' && <AudioPanel key={selected.id} script={selected} />}
          {(step === 'export' || step === 'youtube') && (
            <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              미리보기·MP4 내보내기와 YouTube 연결은 다음 작업에서 열립니다.
            </p>
          )}
        </>
      )}
    </section>
  )
}
