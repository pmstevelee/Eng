'use client'

// Remotion — PC에서 고화질 MP4를 렌더하는 명령과, 같은 컴포지션을 Remotion Player로 미리 보기
// Player는 눌렀을 때만 불러온다 (번들이 커서).

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, Clapperboard, Copy, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VideoScene } from '@/types/grammar-video'
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from '@/lib/grammar/video/constants'
import { frameCount } from '@/lib/grammar/video/export/plan'
import { buildTimeline } from '@/lib/grammar/video/timeline'
import type { LectureCompositionProps } from '@/components/grammar/video/remotion/composition-props'

const RemotionPreview = dynamic(() => import('./remotion-preview').then((m) => m.RemotionPreview), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center rounded-xl border border-gray-200 text-sm text-gray-500">
      Remotion 불러오는 중…
    </div>
  ),
})

export function RemotionPanel({
  scriptId,
  scenes,
  audioUrls,
  imageUrls,
  subtitles,
}: {
  scriptId: string
  scenes: VideoScene[]
  audioUrls: Record<string, string>
  imageUrls: Record<string, string>
  subtitles: boolean
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const durationInFrames = useMemo(() => frameCount(buildTimeline(scenes).duration), [scenes])
  const inputProps = useMemo<LectureCompositionProps>(
    () => ({ scenes, audioUrls, imageUrls, subtitles }),
    [scenes, audioUrls, imageUrls, subtitles],
  )

  const commands = [
    { label: '렌더 (자막 포함)', cmd: `npm run lecture:render -- ${scriptId}` },
    { label: '자막 없이', cmd: `npm run lecture:render -- ${scriptId} --no-subtitles` },
  ]

  async function copy(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(cmd)
      setTimeout(() => setCopied((c) => (c === cmd ? null : c)), 1500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Clapperboard className="h-4 w-4 text-[#7854F7]" />
          Remotion으로 PC에서 렌더 (고화질)
        </h4>
        <p className="mt-0.5 text-xs text-gray-500">
          ivy 폴더 터미널에서 아래 명령을 실행하면 같은 화면·음성·배경 그림으로 MP4·SRT·설명문이 <code>out/lectures</code>에 만들어져요.
          브라우저 MP4보다 화질이 좋고 탭을 열어 둘 필요가 없어요. 처음 한 번은 렌더용 Chrome을 내려받아요.
        </p>
      </div>

      <div className="space-y-2">
        {commands.map((c) => (
          <div key={c.cmd} className="flex items-center gap-2">
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3">
              <Terminal className="h-4 w-4 shrink-0 text-gray-400" />
              <code className="truncate font-mono text-xs text-gray-800" title={c.cmd}>
                {c.cmd}
              </code>
            </div>
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => copy(c.cmd)} aria-label={`${c.label} 명령 복사`}>
              {copied === c.cmd ? <Check className="mr-1 h-4 w-4 text-[#1FAF54]" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied === c.cmd ? '복사됨' : c.label}
            </Button>
          </div>
        ))}
      </div>

      {open ? (
        <RemotionPreview
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={VIDEO_FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
      ) : (
        <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
          <Clapperboard className="mr-1.5 h-4 w-4" />
          Remotion Player로 미리보기
        </Button>
      )}
    </div>
  )
}
