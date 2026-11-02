// 위고업잉글리시 강의 영상 파이프라인 컴포지션 등록 (npm run preview / render)
// 실제 강의는 inputProps(script·timeline·audioUrl)로 넘긴다. 기본값은 음성 없는 짧은 샘플.
// '@/' 별칭은 Remotion 번들러가 모르므로 상대 경로만 쓴다.

import { Composition, Still } from 'remotion'
import { LectureVideo } from '../src/components/lecture-video/lecture-video'
import { LectureThumbnail } from '../src/components/lecture-video/thumbnail'
import { ShortsVideo } from '../src/components/lecture-video/shorts-video'
import { CardStill } from '../src/components/lecture-video/card-still'
import {
  CARD_STILL_ID, LECTURE_THUMBNAIL_ID, LECTURE_VIDEO_ID, SHORTS_VIDEO_ID, durationInFrames,
  type CardStillProps, type LectureVideoProps, type ShortsVideoProps, type ThumbnailProps,
} from '../src/components/lecture-video/props'
import { SHORTS, THUMB, VIDEO } from '../src/components/lecture-video/theme'
import { CARD } from '../src/lib/lecture-pipeline/cardnews'
import { SHORTS_TEMPO } from '../src/lib/lecture-pipeline/shorts'
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

const sampleShorts: LectureScript = {
  version: 1,
  slug: 'sample-shorts-01',
  title: '샘플 숏폼',
  grammarPoint: null,
  targetMinutes: 1,
  createdAt: '',
  format: 'shorts',
  tempo: SHORTS_TEMPO,
  slides: [
    { id: 's1', type: 'hook', data: { question: "'~해 본 적 있어?' 영어로 바로 말할 수 있나요?" } },
    { id: 's2', type: 'pattern', data: { pattern: 'Have you ever ~?', slot: '과거분사', ko: '~해 본 적 있어?' } },
    { id: 's4', type: 'repeat', data: { sentence: 'Have you ever been to Jeju?', ko: '제주도에 가 본 적 있어?', stress: ['ever', 'Jeju'], links: [{ text: 'Have you', hint: '해뷰' }] } },
    { id: 's5', type: 'cta', data: { lectureTitle: '현재완료 시제' } },
  ],
  segments: [
    { id: 's1-1', slideId: 's1', lang: 'ko', emotion: '질문', text: "'~해 본 적 있어?' 영어로 바로 말할 수 있나요?" },
    { id: 's2-1', slideId: 's2', lang: 'en', emotion: '강조', type: 'pattern', text: 'Have you ever …?', reveal: 1 },
    { id: 's2-2', slideId: 's2', lang: 'ko', emotion: '설명', text: '해 본 적 있냐고 물을 때 써요.', reveal: 2 },
    { id: 's4-1', slideId: 's4', lang: 'en', emotion: '설명', type: 'repeat', speed: 1, text: 'Have you ever been to Jeju?' },
    { id: 's5-1', slideId: 's5', lang: 'ko', emotion: '칭찬', text: '전체 강의는 채널에서 확인하세요!' },
  ],
}

const sampleCard: CardStillProps = { card: { type: 'cover', topic: '현재완료 시제', hook: '"I have went"가 틀린 이유, 알고 있나요?' }, page: 1, total: 10 }

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
      <Composition
        id={SHORTS_VIDEO_ID}
        component={ShortsVideo}
        width={SHORTS.width}
        height={SHORTS.height}
        fps={SHORTS.fps}
        durationInFrames={durationInFrames(layoutTimeline(sampleShorts).totalMs, SHORTS.fps)}
        defaultProps={{ script: sampleShorts, timeline: null, audioUrl: null } satisfies ShortsVideoProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: durationInFrames((props.timeline ?? layoutTimeline(props.script)).totalMs, SHORTS.fps),
        })}
      />
      <Still id={CARD_STILL_ID} component={CardStill} width={CARD.width} height={CARD.height} defaultProps={sampleCard} />
    </>
  )
}
