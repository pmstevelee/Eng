'use client'

// ① 스크립트 만들기 — AI 생성(길이·대상·시리즈 번호) 또는 대본 붙여넣기

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PASTED_SCRIPT_MAX,
  SCRIPT_AUDIENCE_LABELS,
  SCRIPT_MINUTES,
  narrationTargetChars,
  type ScriptAudience,
} from '@/lib/grammar/video/script-prompt'
import { cn } from '@/lib/utils'
import { createScriptFromText, createScriptWithAi } from '../../../../lecture-script-actions'
import { Field, NoticeBox, SelectInput, TextArea, inputClass, type Notice } from './studio-ui'

type Mode = 'ai' | 'paste'

export function CreateScriptPanel({
  pointId,
  scriptCount,
  onCreated,
}: {
  pointId: string
  scriptCount: number
  onCreated: (scriptId: string, notice: Notice) => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('ai')
  const [minutes, setMinutes] = useState<string>('3')
  const [audience, setAudience] = useState<ScriptAudience>('middle')
  const [seriesNo, setSeriesNo] = useState('')
  const [text, setText] = useState('')
  const [textError, setTextError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [pending, start] = useTransition()

  const series = seriesNo.trim() ? Math.round(Number(seriesNo)) : null
  const seriesValid = series === null || (Number.isInteger(series) && series > 0 && series < 10000)

  function submit() {
    setNotice(null)
    if (!seriesValid) {
      setNotice({ kind: 'error', text: '시리즈 번호는 1 이상의 숫자로 넣어 주세요.' })
      return
    }
    if (mode === 'paste' && !text.trim()) {
      setTextError('대본을 붙여넣어 주세요.')
      return
    }
    start(async () => {
      const res =
        mode === 'ai'
          ? await createScriptWithAi(pointId, { minutes: Number(minutes), audience, seriesNo: series })
          : await createScriptFromText(pointId, { text, seriesNo: series })
      if (!res.ok) {
        setNotice({ kind: 'error', text: res.error })
        return
      }
      const details = [
        ...res.warnings,
        ...(res.diff?.missing.length ? res.diff.missing.map((s) => `대본에서 빠지거나 바뀐 문장: ${s}`) : []),
        ...(res.diff?.added.length ? res.diff.added.map((s) => `대본에 없는 나레이션: ${s}`) : []),
      ]
      const text2 =
        mode === 'ai'
          ? `스크립트를 만들었어요.${res.gapCount ? ` 원고 보완 요청 ${res.gapCount}개가 개념 정리 탭에 남았어요.` : ''} 장면을 확인하고 고쳐 주세요.`
          : res.diff && (res.diff.missing.length || res.diff.added.length)
            ? '대본을 장면으로 나눴어요. 아래 문장이 원문과 달라요 — 장면 편집에서 원문대로 고쳐 주세요.'
            : '대본을 장면으로 나눴어요. 나레이션이 원문과 글자 그대로 같아요.'
      onCreated(res.scriptId, { kind: details.length ? 'warn' : 'ok', text: text2, details })
      setText('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-lg border border-gray-200" role="tablist" aria-label="만드는 방법">
        {(
          [
            { value: 'ai', label: 'AI로 만들기', icon: Sparkles },
            { value: 'paste', label: '대본 붙여넣기', icon: ClipboardPaste },
          ] as const
        ).map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              'inline-flex h-11 items-center gap-1.5 px-4 text-sm font-medium',
              mode === m.value ? 'bg-[#1865F2] text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            <m.icon className="h-4 w-4" />
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'ai' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            관리자 원고와 개념 정리로 장면 6~10개짜리 스크립트를 만듭니다. 원고에 없는 설명이 필요하면 보완 요청을 남겨요.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="길이" hint={`나레이션 약 ${narrationTargetChars(Number(minutes)).toLocaleString()}자`}>
              <SelectInput
                value={minutes}
                onChange={setMinutes}
                options={SCRIPT_MINUTES.map((m) => ({ value: String(m), label: `${m}분` }))}
              />
            </Field>
            <Field label="대상">
              <SelectInput
                value={audience}
                onChange={setAudience}
                options={(Object.keys(SCRIPT_AUDIENCE_LABELS) as ScriptAudience[]).map((a) => ({ value: a, label: SCRIPT_AUDIENCE_LABELS[a] }))}
              />
            </Field>
            <Field label="시리즈 번호 (선택)" hint="오프닝에 '영문법 핵심 정리 #번호'">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={seriesNo}
                onChange={(e) => setSeriesNo(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            직접 쓴 대본을 붙여넣으면 AI가 장면 틀·화면·언어 구분만 정하고, 나레이션 문장은 글자 그대로 둡니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label={`대본 (${text.length.toLocaleString()} / ${PASTED_SCRIPT_MAX.toLocaleString()}자)`}>
              <TextArea
                value={text}
                rows={10}
                onChange={(v) => {
                  setText(v.slice(0, PASTED_SCRIPT_MAX))
                  if (textError) setTextError(null)
                }}
                placeholder="강의 대본을 붙여넣어 주세요. 영어 예문은 문장 그대로 넣어 주세요."
                className={textError ? 'border-[#D92916]' : undefined}
              />
              {textError && <span className="block text-sm text-[#D92916]">{textError}</span>}
            </Field>
            <Field label="시리즈 번호 (선택)">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={seriesNo}
                onChange={(e) => setSeriesNo(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}

      <NoticeBox notice={notice} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="h-11 bg-[#7854F7] hover:bg-[#6844E0]" onClick={submit} disabled={pending}>
          <Sparkles className="mr-1 h-4 w-4" />
          {pending ? (mode === 'ai' ? 'AI가 쓰는 중… (1~2분)' : '장면으로 나누는 중…') : mode === 'ai' ? '스크립트 생성' : '장면으로 변환'}
        </Button>
        {scriptCount > 0 && <span className="text-xs text-gray-500">새 스크립트로 추가돼요. 기존 스크립트는 그대로 남아요.</span>}
      </div>
    </div>
  )
}
