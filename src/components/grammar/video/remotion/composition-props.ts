// Remotion 컴포지션 id·입력값 (React 없이 — PC 렌더 스크립트도 가져다 씀)

import type { VideoScene } from '../../../../types/grammar-video'

export const LECTURE_COMPOSITION_ID = 'GrammarLecture'

/** Remotion inputProps는 JSON으로 넘어가므로 직렬화 가능한 값만 둔다 */
export type LectureCompositionProps = {
  scenes: VideoScene[]
  /** 세그먼트 id → 음성 서명 URL (없는 세그먼트는 소리 없이) */
  audioUrls: Record<string, string>
  /** 그림 경로 → 서명 URL */
  imageUrls: Record<string, string>
  subtitles: boolean
}
