// 위고업잉글리시 강의 영상 파이프라인 컴포지션 등록 (npm run preview / render)
// 실제 강의는 inputProps(script·timeline·audioUrl)로 넘긴다. 기본값은 음성 없는 짧은 샘플.
// '@/' 별칭은 Remotion 번들러가 모르므로 상대 경로만 쓴다.

import { Composition, Still } from 'remotion'
import { LectureVideo } from '../src/components/lecture-video/lecture-video'
import { LectureThumbnail } from '../src/components/lecture-video/thumbnail'
import { LECTURE_THUMBNAIL_ID, LECTURE_VIDEO_ID, durationInFrames, type LectureVideoProps, type ThumbnailProps } from '../src/components/lecture-video/props'
import { THUMB, VIDEO } from '../src/components/lecture-video/theme'
import { layoutTimeline } from '../src/lib/lecture-pipeline/timing'
import type { LectureScript } from '../src/lib/lecture-pipeline/types'

const sampleScript: LectureScript = {
  version: 1,
  slug: 'sample',
  title: '샘플 강의',
  grammarPoint: null,
  targetMinutes: 1,
  createdAt: '',
  slides: [
    { id: 's1', type: 'title', data: { title: '현재완료 시제', subtitle: 'Present Perfect' } },
    { id: 's2', type: 'example', data: { sentence: [{ text: 'I', role: 'subject' }, { text: 'have finished', role: 'verb', point: true }, { text: 'my homework.' }], ko: '나는 숙제를 다 끝냈어요.' } },
  ],
  segments: [
    { id: 's1-1', slideId: 's1', lang: 'ko', emotion: '설명', text: '안녕하세요, 위고업잉글리시예요.' },
    { id: 's2-1', slideId: 's2', lang: 'ko', emotion: '설명', text: '예문을 볼게요.' },
    { id: 's2-2', slideId: 's2', lang: 'en', emotion: '설명', text: 'I have finished my homework.', reveal: 1 },
    { id: 's2-3', slideId: 's2', lang: 'ko', emotion: '설명', text: '나는 숙제를 다 끝냈어요.', reveal: 2 },
  ],
}

const defaultProps: LectureVideoProps = { script: sampleScript, timeline: null, audioUrl: null, subtitles: true }

export function LecturePipelineRoot() {
  return (
    <>
      <Composition
        id={LECTURE_VIDEO_ID}
        component={LectureVideo}
        width={VIDEO.width}
        height={VIDEO.height}
        fps={VIDEO.fps}
        durationInFrames={durationInFrames(layoutTimeline(sampleScript).totalMs)}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: durationInFrames((props.timeline ?? layoutTimeline(props.script)).totalMs),
        })}
      />
      <Still
        id={LECTURE_THUMBNAIL_ID}
        component={LectureThumbnail}
        width={THUMB.width}
        height={THUMB.height}
        defaultProps={{ title: '현재완료 시제', subtitle: 'Present Perfect' } satisfies ThumbnailProps}
      />
    </>
  )
}
