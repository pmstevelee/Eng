'use client'

// ③ 음성 — 목소리 선택·미리 듣기, 이번에 만들 장면·글자 수, 바뀐 장면만 차례로 생성(장면 1개 = 서버 호출 1번), 실패 장면만 재시도

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Pause, Play, RefreshCw, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseVideoScenes } from '@/types/grammar-video'
import type { AdminLectureScript } from '@/lib/grammar/lecture-scripts'
import type { ElevenLabsVoice } from '@/lib/grammar/elevenlabs'
import { cn } from '@/lib/utils'
import {
  estimateChars,
  generateSceneAudio,
  getAudioUrls,
  getVoiceOptions,
  type AudioEstimate,
  type SegmentAudioUrl,
} from '../../../../lecture-audio-actions'
import { setScriptVoices } from '../../../../lecture-script-actions'
import { Field, NoticeBox, SelectInput, type Notice } from './studio-ui'

type Progress = { done: number; total: number; current: string | null; failed: { sceneId: string; error: string }[] }

function voiceLabel(v: ElevenLabsVoice): string {
  const tags = [v.labels.language, v.labels.accent, v.labels.gender].filter(Boolean).join(' · ')
  return tags ? `${v.name} (${tags})` : v.name
}

export function AudioPanel({ script }: { script: AdminLectureScript }) {
  const router = useRouter()
  const scenes = useMemo(() => parseVideoScenes(script.scenesJson).scenes, [script.scenesJson])
  const sceneName = useCallback((id: string) => scenes.find((s) => s.id === id)?.name ?? id, [scenes])
  const approved = script.status !== 'DRAFT'

  const [voices, setVoices] = useState<ElevenLabsVoice[] | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [ko, setKo] = useState(script.koVoiceId ?? '')
  const [en, setEn] = useState(script.enVoiceId ?? '')
  const [estimate, setEstimate] = useState<AudioEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [savingVoices, startSaveVoices] = useTransition()
  const [urls, setUrls] = useState<Record<string, SegmentAudioUrl> | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let alive = true
    getVoiceOptions().then((res) => {
      if (!alive) return
      if (!res.ok) return setVoiceError(res.error)
      setVoices(res.voices)
      setKo((v) => v || res.defaults.ko || '')
      setEn((v) => v || res.defaults.en || '')
    })
    return () => {
      alive = false
    }
  }, [])

  const refreshEstimate = useCallback(async () => {
    const res = await estimateChars(script.id)
    if (res.ok) {
      setEstimate(res)
      setEstimateError(null)
    } else {
      setEstimate(null)
      setEstimateError(res.error)
    }
  }, [script.id])

  useEffect(() => {
    refreshEstimate()
  }, [refreshEstimate, script.updatedAt])

  useEffect(() => () => audioRef.current?.pause(), [])

  function playUrl(key: string, url: string | null) {
    audioRef.current?.pause()
    if (!url || previewing === key) {
      setPreviewing(null)
      return
    }
    const a = new Audio(url)
    audioRef.current = a
    setPreviewing(key)
    a.onended = () => setPreviewing(null)
    a.play().catch(() => setPreviewing(null))
  }

  const voicesChanged = (ko && ko !== (script.koVoiceId ?? '')) || (en && en !== (script.enVoiceId ?? ''))
  const hasAnyAudio = scenes.some((s) => s.segments.some((g) => g.audioPath))

  function saveVoices() {
    if (!ko || !en) {
      setNotice({ kind: 'error', text: '한국어·영어 목소리를 모두 골라 주세요.' })
      return
    }
    if (hasAnyAudio && !window.confirm('목소리를 바꾸면 이미 만든 음성도 모두 다시 만들어야 합니다. 바꿀까요?')) return
    setNotice(null)
    startSaveVoices(async () => {
      const res = await setScriptVoices(script.id, { ko, en })
      if (res.ok) {
        setNotice({ kind: 'ok', text: '목소리를 저장했어요.' })
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error })
    })
  }

  async function run(sceneIds: string[]) {
    if (sceneIds.length === 0) return
    setRunning(true)
    setNotice(null)
    setUrls(null)
    const failed: Progress['failed'] = []
    let chars = 0
    let calls = 0
    for (let i = 0; i < sceneIds.length; i++) {
      const id = sceneIds[i]
      setProgress({ done: i, total: sceneIds.length, current: sceneName(id), failed: [...failed] })
      const res = await generateSceneAudio(script.id, id)
      chars += res.chars
      calls += res.generated
      if (!res.ok) {
        failed.push({ sceneId: id, error: res.error })
        // 키·요금제·한도 문제는 다음 장면도 똑같이 실패하므로 멈춘다
        if (/키|요금제|한도|목소리/.test(res.error)) {
          for (const rest of sceneIds.slice(i + 1)) failed.push({ sceneId: rest, error: '앞 장면 오류로 멈춤' })
          break
        }
      }
    }
    setProgress({ done: sceneIds.length, total: sceneIds.length, current: null, failed })
    setRunning(false)
    setNotice(
      failed.length
        ? { kind: 'error', text: `${failed.length}개 장면을 만들지 못했어요. (이번에 ${calls}개 문장 · ${chars.toLocaleString()}자 생성)`, details: failed.map((f) => `${sceneName(f.sceneId)}: ${f.error}`) }
        : { kind: 'ok', text: `음성을 만들었어요. 문장 ${calls}개 · ${chars.toLocaleString()}자` },
    )
    router.refresh()
    await refreshEstimate()
  }

  async function loadUrls() {
    const res = await getAudioUrls(script.id)
    if (res.ok) setUrls(res.urls)
    else setNotice({ kind: 'error', text: res.error })
  }

  const koVoices = voices ?? []
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const failedIds = progress?.failed.map((f) => f.sceneId) ?? []

  return (
    <div className="space-y-5">
      {!approved && (
        <NoticeBox notice={{ kind: 'warn', text: '스크립트를 승인한 뒤에 음성을 만들 수 있어요. 장면 편집에서 "스크립트 승인"을 눌러 주세요.' }} />
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">목소리</h4>
        {voiceError && <NoticeBox notice={{ kind: 'error', text: voiceError }} />}
        {!voices && !voiceError && <p className="text-sm text-gray-500">목소리 목록을 불러오는 중…</p>}
        {voices && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { key: 'ko', label: '한국어 나레이션', value: ko, set: setKo },
                { key: 'en', label: '영어 예문 (조금 느리게 읽어요)', value: en, set: setEn },
              ] as const
            ).map((f) => {
              const current = koVoices.find((v) => v.voiceId === f.value)
              const known = Boolean(current) || !f.value
              return (
                <Field key={f.key} label={f.label}>
                  <div className="flex gap-2">
                    <SelectInput
                      ariaLabel={f.label}
                      value={f.value}
                      onChange={f.set}
                      className="flex-1"
                      options={[
                        { value: '', label: '목소리 선택' },
                        ...(known ? [] : [{ value: f.value, label: `${f.value} (계정 목록에 없음)` }]),
                        ...koVoices.map((v) => ({ value: v.voiceId, label: voiceLabel(v) })),
                      ]}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-11 p-0"
                      aria-label="미리 듣기"
                      disabled={!current?.previewUrl}
                      onClick={() => playUrl(`voice-${f.key}`, current?.previewUrl ?? null)}
                    >
                      {previewing === `voice-${f.key}` ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </Field>
              )
            })}
          </div>
        )}
        {voices && voicesChanged && (
          <Button type="button" variant="outline" className="h-11" onClick={saveVoices} disabled={savingVoices}>
            {savingVoices ? '저장 중…' : '목소리 저장'}
          </Button>
        )}
        <p className="text-xs text-gray-500">
          보이스 라이브러리 목소리는 ElevenLabs 무료 요금제에서 API로 쓸 수 없어요. 계정에 추가된 목소리만 목록에 나와요.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">음성 생성</h4>
        {estimateError ? (
          <NoticeBox notice={{ kind: 'warn', text: estimateError }} />
        ) : estimate ? (
          estimate.ready ? (
            <p className="text-sm text-[#15803D]">모든 문장({estimate.spokenSegments}개)에 최신 음성이 있어요.</p>
          ) : (
            <p className="text-sm text-gray-700">
              이번에 만들 음성: 장면 <strong>{estimate.scenes.length}개</strong> · 문장 {estimate.segments}개 ·{' '}
              <strong>{estimate.chars.toLocaleString()}자</strong>
              <span className="text-gray-500"> (전체 {estimate.spokenSegments}문장 중, 바뀐 문장만)</span>
            </p>
          )
        ) : (
          <p className="text-sm text-gray-500">계산 중…</p>
        )}

        {progress && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-[#1865F2] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500">
              {progress.done}/{progress.total} 장면{progress.current ? ` · 지금: ${progress.current}` : ''}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-11 bg-[#1865F2] hover:bg-[#1554C9]"
            disabled={!approved || running || !estimate || estimate.ready || Boolean(voicesChanged)}
            title={voicesChanged ? '목소리를 먼저 저장해 주세요' : undefined}
            onClick={() => estimate && run(estimate.scenes.map((s) => s.sceneId))}
          >
            <Mic className="mr-1 h-4 w-4" />
            {running ? '만드는 중…' : '음성 생성'}
          </Button>
          {!running && failedIds.length > 0 && (
            <Button type="button" variant="outline" className="h-11" onClick={() => run(failedIds)}>
              <RefreshCw className="mr-1 h-4 w-4" />
              실패한 장면만 다시
            </Button>
          )}
          {hasAnyAudio && !running && (
            <Button type="button" variant="outline" className="h-11" onClick={loadUrls}>
              <Volume2 className="mr-1 h-4 w-4" />
              만든 음성 들어 보기
            </Button>
          )}
        </div>
        <NoticeBox notice={notice} />
      </section>

      {urls && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">만든 음성</h4>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {scenes.flatMap((s) =>
              s.segments
                .filter((g) => urls[g.id])
                .map((g) => {
                  const u = urls[g.id]
                  return (
                    <li key={g.id} className="flex items-center gap-3 px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-11 shrink-0 p-0"
                        aria-label="재생"
                        disabled={!u.url}
                        onClick={() => playUrl(g.id, u.url)}
                      >
                        {previewing === g.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <span className="w-20 shrink-0 truncate text-xs text-gray-400">{s.name}</span>
                      <span className={cn('min-w-0 flex-1 truncate text-sm', g.lang === 'en' ? 'font-medium text-gray-900' : 'text-gray-700')}>
                        {g.text}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-400">{u.durationSec?.toFixed(1)}초</span>
                      {u.state === 'stale' && (
                        <span className="shrink-0 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#8A5A00]">수정됨</span>
                      )}
                    </li>
                  )
                }),
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
