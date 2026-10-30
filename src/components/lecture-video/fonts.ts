// Pretendard 글꼴을 public/fonts/pretendard에서 불러온다 (OFL 1.1 라이선스, LICENSE.txt 동봉)

import { continueRender, delayRender, staticFile } from 'remotion'

const WEIGHTS: [number, string][] = [
  [400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold'],
]

let loading: Promise<void> | null = null

function loadAll(): Promise<void> {
  if (loading) return loading
  loading = Promise.all(
    WEIGHTS.map(async ([weight, name]) => {
      const face = new FontFace('Pretendard', `url(${staticFile(`fonts/pretendard/Pretendard-${name}.woff2`)}) format('woff2')`, { weight: String(weight) })
      await face.load()
      document.fonts.add(face)
    }),
  ).then(() => undefined)
  return loading
}

/** 글꼴을 다 받기 전에는 프레임을 찍지 않는다 */
export function usePretendard(): void {
  if (typeof document === 'undefined') return
  if (!loading) {
    const handle = delayRender('Pretendard 글꼴 불러오기', { timeoutInMilliseconds: 60_000 })
    loadAll()
      .catch((e: unknown) => console.warn('[lecture-video] 글꼴을 불러오지 못했어요 (대체 글꼴로 그림)', e))
      .finally(() => continueRender(handle))
  }
}
