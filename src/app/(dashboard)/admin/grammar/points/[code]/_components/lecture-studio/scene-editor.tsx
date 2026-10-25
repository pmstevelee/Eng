'use client'

// ② 장면 편집 — 왼쪽 장면 목록(그 장면 끝 화면 미리보기), 오른쪽 화면 데이터 폼 + 나레이션 세그먼트.
// 저장 전에는 브라우저에만 있고, 저장하면 서버에서 다시 검증한다.

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoCanvas } from '@/components/grammar/video/video-canvas'
import {
  formatVideoSceneErrors,
  parseVideoScenes,
  VIDEO_TEMPLATE_LABELS,
  VIDEO_TEMPLATES,
  type VideoScene,
  type VideoTemplate,
} from '@/types/grammar-video'
import { buildTimeline, sceneSettledTime } from '@/lib/grammar/video/timeline'
import { checkScriptStructure, createBlankScene, narrationChars } from '@/lib/grammar/video/script-prompt'
import type { AudioVoices } from '@/lib/grammar/video/audio-plan'
import type { AdminLectureScript } from '@/lib/grammar/lecture-scripts'
import { cn } from '@/lib/utils'
import { approveScript, updateScenes } from '../../../../lecture-script-actions'
import { Field, IconButton, NoticeBox, SelectInput, TextInput, type Notice } from './studio-ui'
import { SceneDataForm } from './scene-data-form'
import { SegmentList } from './segment-list'

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`
}

/** 입력이 멈춘 뒤에만 미리보기를 다시 그린다 */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export function SceneEditor({ script, voices }: { script: AdminLectureScript; voices: AudioVoices | null }) {
  const router = useRouter()
  const initial = useMemo(() => parseVideoScenes(script.scenesJson), [script.scenesJson])
  const [title, setTitle] = useState(script.title)
  const [scenes, setScenes] = useState<VideoScene[]>(initial.scenes)
  const [selectedId, setSelectedId] = useState<string | null>(initial.scenes[0]?.id ?? null)
  const [addTemplate, setAddTemplate] = useState<VideoTemplate>('compare')
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, startSave] = useTransition()
  const [approving, startApprove] = useTransition()

  // 서버에서 새로 받으면(저장·음성 생성 후) 편집 상태를 맞춘다
  const savedKey = `${script.id}:${script.updatedAt}`
  const [baseKey, setBaseKey] = useState(savedKey)
  const [baseJson, setBaseJson] = useState(() => JSON.stringify({ title: script.title, scenes: initial.scenes }))
  const currentJson = JSON.stringify({ title, scenes })
  const dirty = currentJson !== baseJson
  useEffect(() => {
    if (savedKey === baseKey) return
    setBaseKey(savedKey)
    if (dirty) return // 고치는 중이면 덮어쓰지 않는다 (저장 시 충돌 안내)
    setTitle(script.title)
    setScenes(initial.scenes)
    setBaseJson(JSON.stringify({ title: script.title, scenes: initial.scenes }))
  }, [savedKey, baseKey, dirty, script.title, initial.scenes])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const check = useMemo(() => parseVideoScenes(scenes), [scenes])
  const errorsByScene = useMemo(() => {
    const m = new Map<number, string[]>()
    check.errors.forEach((e) => {
      const list = m.get(e.sceneIndex) ?? []
      list.push(formatVideoSceneErrors([e])[0])
      m.set(e.sceneIndex, list)
    })
    return m
  }, [check])
  const structure = useMemo(() => checkScriptStructure(scenes), [scenes])

  const previewScenes = useDebounced(check.scenes, 400)
  const previewTimeline = useMemo(() => buildTimeline(previewScenes), [previewScenes])
  const previewIndex = useMemo(() => new Map(previewScenes.map((s, i) => [s.id, i])), [previewScenes])
  const fullTimeline = useMemo(() => buildTimeline(check.scenes), [check.scenes])

  const selectedIndex = scenes.findIndex((s) => s.id === selectedId)
  const selected = selectedIndex >= 0 ? scenes[selectedIndex] : null

  function replaceScene(next: VideoScene) {
    setScenes((list) => list.map((s) => (s.id === next.id ? next : s)))
  }

  function moveScene(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= scenes.length) return
    const next = [...scenes]
    ;[next[i], next[j]] = [next[j], next[i]]
    setScenes(next)
  }

  function addScene() {
    const blank = createBlankScene(addTemplate, scenes)
    const at = selectedIndex >= 0 ? selectedIndex + 1 : scenes.length
    setScenes([...scenes.slice(0, at), blank, ...scenes.slice(at)])
    setSelectedId(blank.id)
  }

  function removeScene(i: number) {
    const s = scenes[i]
    if (!window.confirm(`"${s.name || s.id}" 장면을 지울까요? 저장해야 반영됩니다.`)) return
    const next = scenes.filter((_, k) => k !== i)
    setScenes(next)
    setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? null)
  }

  function save() {
    setNotice(null)
    startSave(async () => {
      const res = await updateScenes(script.id, { scenes, title, expectedUpdatedAt: script.updatedAt })
      if (res.ok) {
        setBaseJson(currentJson)
        setNotice({ kind: 'ok', text: '장면을 저장했어요.' })
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error, details: 'errors' in res ? res.errors : undefined })
    })
  }

  function approve() {
    setNotice(null)
    startApprove(async () => {
      const res = await approveScript(script.id)
      if (res.ok) {
        setNotice({
          kind: res.warnings.length ? 'warn' : 'ok',
          text: '스크립트를 승인했어요. 이제 음성을 만들 수 있어요.',
          details: res.warnings,
        })
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-4">
      {!initial.ok && (
        <NoticeBox
          notice={{
            kind: 'warn',
            text: '저장된 장면 중 형식이 맞지 않는 장면이 있어 목록에서 빠졌습니다. 이대로 저장하면 그 장면은 사라집니다.',
            details: formatVideoSceneErrors(initial.errors),
          }}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="영상 제목" className="min-w-[240px] flex-1">
          <TextInput value={title} onChange={setTitle} />
        </Field>
        <div className="text-sm text-gray-500">
          {scenes.length}장면 · 나레이션 {narrationChars(scenes).toLocaleString()}자 · 약 {formatDuration(fullTimeline.duration)}
        </div>
      </div>

      {structure.length > 0 && <NoticeBox notice={{ kind: 'warn', text: '장면 구성 권장 규칙과 다릅니다.', details: structure }} />}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* 장면 목록 */}
        <div className="space-y-2">
          <ol className="space-y-2">
            {scenes.map((s, i) => {
              const errs = errorsByScene.get(i)
              const pi = previewIndex.get(s.id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={s.id === selectedId}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border bg-white p-2 text-left',
                      s.id === selectedId ? 'border-[#1865F2] ring-1 ring-[#1865F2]' : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="w-28 shrink-0">
                      {pi !== undefined && !errs ? (
                        <VideoCanvas
                          scenes={previewScenes}
                          timeline={previewTimeline}
                          t={sceneSettledTime(previewTimeline, pi)}
                          subtitles={false}
                          className="rounded-md"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-md border border-[#D92916]/30 bg-[#D92916]/5">
                          <AlertTriangle className="h-4 w-4 text-[#D92916]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-400">
                        {i + 1}. {VIDEO_TEMPLATE_LABELS[s.template]}
                      </p>
                      <p className="truncate text-sm font-medium text-gray-900">{s.name || s.id}</p>
                      {errs && <p className="text-xs text-[#D92916]">고칠 곳 {errs.length}개</p>}
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="flex gap-2">
            <SelectInput
              ariaLabel="추가할 장면 틀"
              value={addTemplate}
              onChange={setAddTemplate}
              options={VIDEO_TEMPLATES.map((t) => ({ value: t, label: VIDEO_TEMPLATE_LABELS[t] }))}
              className="flex-1"
            />
            <Button type="button" variant="outline" className="h-11" onClick={addScene}>
              <Plus className="mr-1 h-4 w-4" />
              장면 추가
            </Button>
          </div>
        </div>

        {/* 선택한 장면 */}
        {selected ? (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={`장면 ${selectedIndex + 1} · ${VIDEO_TEMPLATE_LABELS[selected.template]} — 챕터 이름`} className="min-w-[200px] flex-1">
                <TextInput value={selected.name} onChange={(v) => replaceScene({ ...selected, name: v })} />
              </Field>
              <IconButton label="장면 위로" onClick={() => moveScene(selectedIndex, -1)} disabled={selectedIndex === 0}>
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton label="장면 아래로" onClick={() => moveScene(selectedIndex, 1)} disabled={selectedIndex === scenes.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </IconButton>
              <IconButton label="장면 삭제" tone="danger" onClick={() => removeScene(selectedIndex)} disabled={scenes.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>

            {errorsByScene.get(selectedIndex) && (
              <NoticeBox notice={{ kind: 'error', text: '이 장면에 고칠 곳이 있어요.', details: errorsByScene.get(selectedIndex) }} />
            )}

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900">화면</h4>
              <SceneDataForm scene={selected} onChange={replaceScene} />
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900">나레이션</h4>
              <p className="text-xs text-gray-500">
                한 줄 = 자막 한 줄 = 음성 한 개. 영어 예문은 영어로 따로 두세요. &quot;보여 줄 단계&quot;는 그 문장을 읽기 전에 화면에 띄울 단계예요.
              </p>
              <SegmentList
                scene={selected}
                allScenes={scenes}
                voices={voices}
                onChange={(segments) => replaceScene({ ...selected, segments } as VideoScene)}
              />
            </section>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 p-10 text-sm text-gray-500">
            장면을 추가해 주세요.
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 space-y-2 border-t border-gray-200 bg-white/95 px-1 py-3 backdrop-blur">
        <NoticeBox notice={notice} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="h-11 bg-[#1865F2] hover:bg-[#1554C9]" onClick={save} disabled={!dirty || saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? '저장 중…' : '장면 저장'}
          </Button>
          {script.status === 'DRAFT' && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={approve}
              disabled={dirty || approving || !check.ok}
              title={dirty ? '먼저 저장해 주세요' : !check.ok ? '고칠 곳을 먼저 고쳐 주세요' : undefined}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {approving ? '승인 중…' : '스크립트 승인'}
            </Button>
          )}
          <span className="text-sm text-gray-500">
            {dirty ? '저장하지 않은 변경이 있어요.' : '저장됨'}
            {!check.ok && ` · 고칠 곳 ${check.errors.length}개`}
          </span>
        </div>
      </div>
    </div>
  )
}
