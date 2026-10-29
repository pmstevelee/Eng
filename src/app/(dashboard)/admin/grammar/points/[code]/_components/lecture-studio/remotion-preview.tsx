'use client'

// Remotion Player — CLI 렌더와 같은 컴포지션을 브라우저에서 재생 (remotion-panel이 필요할 때만 불러옴)

import { Player } from '@remotion/player'
import { LectureComposition } from '@/components/grammar/video/remotion/lecture-composition'
import type { LectureCompositionProps } from '@/components/grammar/video/remotion/composition-props'

export function RemotionPreview({
  inputProps,
  durationInFrames,
  fps,
  width,
  height,
}: {
  inputProps: LectureCompositionProps
  durationInFrames: number
  fps: number
  width: number
  height: number
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
      <Player
        component={LectureComposition}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        controls
        style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
      />
    </div>
  )
}
