// 영상 글꼴(Noto Sans KR · Lexend)을 Google Fonts에서 불러온다 (npm 설치 없음, 브라우저 전용).
// Noto Sans KR은 글자 범위별로 파일이 나뉘어 있어서, 영상에 나오는 글자를 모두 넘겨야
// 첫 프레임부터 대체 글꼴 없이 그려진다.

import type { VideoScene } from '../../../../types/grammar-video'
import { VIDEO_BRAND } from '../constants'
import { clearFontMetricsCache } from './primitives'

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap'
const LINK_ID = 'grammar-video-fonts'

const FACES: { family: string; weights: number[] }[] = [
  { family: 'Noto Sans KR', weights: [400, 500, 700, 900] },
  { family: 'Lexend', weights: [400, 600, 700] },
]

function ensureStylesheet(): Promise<void> {
  if (document.getElementById(LINK_ID)) return Promise.resolve()
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    link.href = FONT_CSS_URL
    link.onload = () => resolve()
    // 실패해도 대체 글꼴로 그릴 수 있게 막지 않는다 (결과에서 loaded=false로 알린다)
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
}

/** 장면에 나오는 모든 글자 (글꼴 범위 파일을 미리 받기 위함) */
export function collectSceneText(scenes: VideoScene[]): string {
  const parts: string[] = [VIDEO_BRAND, '0123456789 ✗✓()+:']
  const walk = (v: unknown) => {
    if (typeof v === 'string') parts.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  scenes.forEach((s) => {
    walk(s.name)
    walk(s.data)
    s.segments.forEach((seg) => parts.push(seg.text))
  })
  return Array.from(new Set(Array.from(parts.join('')))).join('')
}

/**
 * 글꼴을 불러온다. 반환값 loaded가 false면 일부 글꼴을 못 받은 것 (대체 글꼴로 그려짐).
 * 불러온 뒤 글꼴 측정값 캐시를 비워 새 글꼴 기준으로 다시 잰다.
 */
export async function loadVideoFonts(scenes: VideoScene[]): Promise<{ loaded: boolean }> {
  await ensureStylesheet()
  const text = collectSceneText(scenes)
  const loads = FACES.flatMap((face) =>
    face.weights.map((w) =>
      document.fonts
        .load(`${w} 40px "${face.family}"`, text)
        .then((list) => list.length > 0)
        .catch(() => false),
    ),
  )
  const results = await Promise.all(loads)
  await document.fonts.ready
  clearFontMetricsCache()
  return { loaded: results.every(Boolean) }
}
