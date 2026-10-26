'use client'

// ⑤ YouTube 연결 — 관리자가 직접 올린 YouTube 영상 링크를 이 포인트의 본사 기본 강의로 건다.
// 링크 확인(숨긴 플레이어로 재생 가능·길이) → 연결(기존 본사 강의가 있으면 교체 확인) → 미리보기·연결 해제

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Loader2, Unlink, Youtube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { probeVideo } from '@/components/grammar/lecture-form'
import { YOUTUBE_NOCOOKIE_HOST } from '@/components/grammar/youtube-iframe-api'
import { formatLectureDuration, parseYoutubeUrl, youtubeWatchUrl } from '@/lib/grammar/lecture-input'
import type { AdminLectureScript } from '@/lib/grammar/lecture-scripts'
import type { ManagedLecture } from '@/lib/grammar/lectures'
import { parseVideoScenes } from '@/types/grammar-video'
import { buildTimeline } from '@/lib/grammar/video/timeline'
import { linkYoutubeToScript, unlinkYoutubeFromScript } from '../../../../lecture-link-actions'
import { NoticeBox, inputClass, type Notice } from './studio-ui'

/** YouTube 길이와 타임라인 길이가 이만큼(초) 넘게 다르면 다른 영상일 수 있다고 알린다 */
const DURATION_MISMATCH_SEC = 8

type Check =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; videoId: string; durationSec: number | null; title: string | null }
  | { kind: 'unknown'; videoId: string }

function Preview({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="aspect-video w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-gray-900">
      <iframe
        title={title}
        src={`${YOUTUBE_NOCOOKIE_HOST}/embed/${videoId}?rel=0&modestbranding=1`}
        className="h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

export function YoutubePanel({ script, hqLecture }: { script: AdminLectureScript; hqLecture: ManagedLecture | null }) {
  const router = useRouter()
  const timelineSec = useMemo(
    () => Math.max(1, Math.round(buildTimeline(parseVideoScenes(script.scenesJson).scenes).duration / 1000)),
    [script.scenesJson],
  )
  const linked = script.lecture
  const [editing, setEditing] = useState(!linked)
  const [url, setUrl] = useState('')
  const [check, setCheck] = useState<Check>({ kind: 'idle' })
  const [notice, setNotice] = useState<Notice>(null)
  const [pending, startTransition] = useTransition()
  const probeHost = useRef<HTMLDivElement>(null)

  // 이 스크립트가 아닌 다른 본사 강의가 걸려 있으면 연결 시 교체된다
  const otherHq = hqLecture && hqLecture.id !== linked?.id ? hqLecture : null

  function handleUrlChange(v: string) {
    setUrl(v)
    setNotice(null)
    if (check.kind !== 'idle') setCheck({ kind: 'idle' })
  }

  async function handleCheck() {
    setNotice(null)
    const videoId = parseYoutubeUrl(url)
    if (!videoId) {
      setNotice({ kind: 'error', text: 'YouTube 영상 링크 형식이 아니에요. 예: https://youtu.be/영상ID' })
      return
    }
    if (!probeHost.current) return
    setCheck({ kind: 'checking' })
    const r = await probeVideo(probeHost.current, videoId)
    if (r.ok === true) setCheck({ kind: 'ok', videoId, durationSec: r.durationSec, title: r.title })
    else if (r.ok === 'timeout') setCheck({ kind: 'unknown', videoId })
    else {
      setCheck({ kind: 'idle' })
      setNotice({ kind: 'error', text: r.error })
    }
  }

  function doLink(confirmLectureId: string | null) {
    startTransition(async () => {
      const res = await linkYoutubeToScript(script.id, url, { confirmLectureId })
      if (res.ok) {
        const parts = [res.created ? '본사 기본 강의로 연결했어요.' : '본사 기본 강의를 이 영상으로 바꿨어요.']
        if (res.viewsReset) parts.push('이전 영상의 시청 기록은 초기화됐어요.')
        setNotice({ kind: 'ok', text: parts.join(' ') })
        setEditing(false)
        setUrl('')
        setCheck({ kind: 'idle' })
        router.refresh()
        return
      }
      if ('needsConfirm' in res) {
        const e = res.existing
        const lines = [
          e.sameScript
            ? `지금 연결된 영상을 이 영상으로 바꿀까요?`
            : `이 포인트에는 이미 본사 기본 강의 "${e.title}"가 있어요.`,
          e.scriptTitle ? `(AI 강의 "${e.scriptTitle}"로 만든 영상 — 그 스크립트는 연결 전 상태로 돌아가요.)` : '',
          e.videoId !== parseYoutubeUrl(url) && e.completedCount > 0 ? `시청 완료 기록 ${e.completedCount}건이 초기화돼요.` : '',
          e.sameScript ? '' : '이 영상으로 교체할까요?',
        ].filter(Boolean)
        if (window.confirm(lines.join('\n'))) doLink(e.id)
        return
      }
      setNotice({ kind: 'error', text: res.error })
    })
  }

  function handleUnlink() {
    if (!linked) return
    const warn = linked.completedCount > 0 ? `\n시청 완료 기록 ${linked.completedCount}건도 함께 지워져요.` : ''
    if (!window.confirm(`본사 기본 강의 "${linked.title}"를 내리고 연결을 해제할까요?\n학생 단원 화면에서 이 강의가 빠져요. YouTube 영상 자체는 지워지지 않아요.${warn}`)) return
    setNotice(null)
    startTransition(async () => {
      const res = await unlinkYoutubeFromScript(script.id)
      if (res.ok) {
        setNotice({ kind: 'ok', text: '연결을 해제했어요. 학생에게는 더 이상 이 강의가 보이지 않아요.' })
        setEditing(true)
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error })
    })
  }

  const checkedId = check.kind === 'ok' || check.kind === 'unknown' ? check.videoId : null
  const mismatch =
    check.kind === 'ok' && check.durationSec != null && Math.abs(check.durationSec - timelineSec) > DURATION_MISMATCH_SEC

  return (
    <div className="space-y-4">
      <NoticeBox notice={notice} />

      {linked && (
        <section className="space-y-3 rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#1FAF54]" />
            <h4 className="text-sm font-semibold text-gray-900">본사 기본 강의로 연결됨</h4>
            {script.linkedAt && (
              <span className="text-xs text-gray-500">{new Date(script.linkedAt).toLocaleString('ko-KR')}</span>
            )}
          </div>
          <Preview videoId={linked.videoId} title={linked.title} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
            <span className="font-medium text-gray-900">{linked.title}</span>
            <span className="tabular-nums">길이 {formatLectureDuration(linked.durationSec)}</span>
            <span>시청 완료 {linked.completedCount}명</span>
            <a
              href={youtubeWatchUrl(linked.videoId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1 text-[#1865F2] hover:underline"
            >
              YouTube에서 보기
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="text-xs text-gray-500">
            학원 자체 강의가 없는 모든 학원 학생의 단원 화면에서 이 YouTube 영상이 재생돼요. 장면을 고쳐 다시 만들었다면 새 영상을 올리고 링크를 바꿔 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {!editing && (
              <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(true)} disabled={pending}>
                <Link2 className="mr-1 h-4 w-4" />
                다른 영상으로 바꾸기
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-[#D92916] hover:bg-[#FDECEA] hover:text-[#D92916]"
              onClick={handleUnlink}
              disabled={pending}
            >
              <Unlink className="mr-1 h-4 w-4" />
              연결 해제
            </Button>
          </div>
        </section>
      )}

      {editing && (
        <section className="space-y-4 rounded-xl border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FDECEA]">
              <Youtube className="h-5 w-5 text-[#D92916]" />
            </div>
            <div className="text-sm text-gray-700">
              <h4 className="font-semibold text-gray-900">{linked ? '새 영상 링크로 바꾸기' : 'YouTube 영상 연결'}</h4>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-gray-500">
                <li>미리보기·내보내기에서 MP4·자막(SRT)·설명문·썸네일을 받아요.</li>
                <li>YouTube 스튜디오에 직접 올리고 공개 범위는 &lsquo;일부 공개&rsquo;로 두세요. (&lsquo;비공개&rsquo;는 학생이 볼 수 없어요)</li>
                <li>영상 링크를 아래에 붙여넣고 링크 확인 → 연결을 눌러요.</li>
              </ol>
            </div>
          </div>

          {otherHq && (
            <p className="flex items-start gap-2 rounded-lg bg-[#FFF4D6] px-3 py-2 text-sm text-[#8A5A00]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              지금 본사 기본 강의는 &ldquo;{otherHq.title}&rdquo;예요. 연결하면 이 영상으로 교체돼요
              {otherHq.completedCount > 0 ? ` (시청 완료 ${otherHq.completedCount}명 기록 초기화)` : ''}.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://youtu.be/영상ID"
              aria-label="YouTube 영상 링크"
              className={inputClass}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={handleCheck}
              disabled={!url.trim() || check.kind === 'checking' || pending}
            >
              {check.kind === 'checking' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              링크 확인
            </Button>
          </div>
          <div ref={probeHost} className="hidden" aria-hidden />

          {check.kind === 'ok' && (
            <p className="text-sm text-[#127A3A]">
              재생할 수 있는 영상이에요{check.title ? ` — "${check.title}"` : ''}
              {check.durationSec ? ` · YouTube 길이 ${formatLectureDuration(check.durationSec)}` : ''}
            </p>
          )}
          {check.kind === 'unknown' && (
            <p className="text-sm text-[#8A5A00]">재생 가능 여부를 확인하지 못했어요. 아래 미리보기가 재생되는지 직접 확인한 뒤 연결해 주세요.</p>
          )}
          {mismatch && (
            <p className="flex items-start gap-2 rounded-lg bg-[#FFF4D6] px-3 py-2 text-sm text-[#8A5A00]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              이 스크립트 영상 길이({formatLectureDuration(timelineSec)})와 달라요. 다른 영상의 링크가 아닌지 확인해 주세요.
            </p>
          )}
          {checkedId && <Preview videoId={checkedId} title="연결할 영상 미리보기" />}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-11 bg-[#1865F2] hover:bg-[#1558d6]"
              onClick={() => doLink(null)}
              disabled={!checkedId || pending}
            >
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
              본사 기본 강의로 연결
            </Button>
            {linked && (
              <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(false)} disabled={pending}>
                취소
              </Button>
            )}
            <span className="text-xs text-gray-500">
              강의 제목은 &ldquo;{script.title}&rdquo;, 길이는 타임라인 합계 {formatLectureDuration(timelineSec)}로 저장돼요.
            </span>
          </div>
        </section>
      )}
    </div>
  )
}
