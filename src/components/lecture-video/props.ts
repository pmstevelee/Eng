// 강의 영상 컴포지션 id·입력값 (React 없이 — CLI 렌더 스크립트도 가져다 씀)

import type { LectureScript } from '../../lib/lecture-pipeline/types'
import type { Timeline } from '../../lib/lecture-pipeline/timing'
import { VIDEO } from './theme'

export const LECTURE_VIDEO_ID = 'WeGoUpLecture'
export const LECTURE_THUMBNAIL_ID = 'WeGoUpThumbnail'

/** Remotion inputProps는 JSON으로 넘어가므로 직렬화 가능한 값만 둔다 */
export type LectureVideoProps = {
  script: LectureScript
  /** 음성 단계가 만든 타임라인 (없으면 글자 수 어림으로 미리보기) */
  timeline: Timeline | null
  /** narration.wav 주소 (없으면 소리 없이) */
  audioUrl: string | null
  subtitles: boolean
}

export type ThumbnailProps = {
  title: string
  subtitle?: string
  label?: string
}

export function durationInFrames(timelineMs: number, fps: number = VIDEO.fps): number {
  return Math.max(1, Math.ceil((timelineMs / 1000) * fps))
}
