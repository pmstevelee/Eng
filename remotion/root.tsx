// Remotion 컴포지션 등록 — 기본값은 수동태 샘플(음성·그림 없음). 실제 강의는 inputProps로 넘긴다.
// '@/' 별칭은 Remotion 번들러가 모르므로 상대 경로만 쓴다.

import { Composition } from 'remotion'
import sample from '../src/lib/grammar/video/samples/passive-voice.json'
import { parseVideoScenes } from '../src/types/grammar-video'
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from '../src/lib/grammar/video/constants'
import {
  LECTURE_COMPOSITION_ID,
  LectureComposition,
  lectureDurationInFrames,
  type LectureCompositionProps,
} from '../src/components/grammar/video/remotion/lecture-composition'

const defaultProps: LectureCompositionProps = {
  scenes: parseVideoScenes(sample).scenes,
  audioUrls: {},
  imageUrls: {},
  subtitles: true,
}

export function RemotionRoot() {
  return (
    <Composition
      id={LECTURE_COMPOSITION_ID}
      component={LectureComposition}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      fps={VIDEO_FPS}
      durationInFrames={lectureDurationInFrames(defaultProps.scenes)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({ durationInFrames: lectureDurationInFrames(props.scenes) })}
    />
  )
}
