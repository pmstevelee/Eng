// 장면 배경 그림 불러오기 — 브라우저 전용 (관리자 미리보기·MP4 내보내기·Remotion 렌더가 함께 씀)
// fetch → createImageBitmap으로 받아 캔버스가 오염(taint)되지 않게 한다 (MP4 인코딩에 필요).

import type { SceneImageSources } from './index'

export interface LoadedSceneImages {
  images: SceneImageSources
  /** 받지 못한 그림 수 (그 장면은 그림 없이 그려진다) */
  failed: number
}

/** urls: 그림 경로 → 서명 URL */
export async function loadSceneImages(urls: Record<string, string>, signal?: AbortSignal): Promise<LoadedSceneImages> {
  const out = new Map<string, ImageBitmap>()
  let failed = 0
  await Promise.all(
    Object.entries(urls).map(async ([path, url]) => {
      try {
        const res = await fetch(url, { signal })
        if (!res.ok) throw new Error(String(res.status))
        out.set(path, await createImageBitmap(await res.blob()))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        console.error('[lecture-image] 그림 불러오기 실패:', path, error)
        failed += 1
      }
    }),
  )
  return { images: out, failed }
}
