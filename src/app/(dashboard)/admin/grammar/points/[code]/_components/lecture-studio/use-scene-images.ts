'use client'

// 장면 배경 그림을 서명 URL로 받아 캔버스용 그림으로 불러온다 (그림 경로가 바뀔 때만 다시 받음)

import { useEffect, useMemo, useState } from 'react'
import type { VideoScene } from '@/types/grammar-video'
import type { SceneImageSources } from '@/lib/grammar/video/render'
import { loadSceneImages } from '@/lib/grammar/video/render/images'
import { referencedImagePaths } from '@/lib/grammar/video/image-plan'
import { getImageUrls } from '../../../../lecture-image-actions'

export interface SceneImagesState {
  images: SceneImageSources
  loading: boolean
  /** 경로 → 서명 URL (Remotion 미리보기·그림 크게 보기용) */
  urls: Record<string, string>
  error: string | null
}

const EMPTY: SceneImageSources = new Map()

export function useSceneImages(scriptId: string, scenes: VideoScene[]): SceneImagesState {
  const pathsKey = useMemo(() => Array.from(referencedImagePaths(scenes)).sort().join('|'), [scenes])
  const [state, setState] = useState<SceneImagesState>({ images: EMPTY, loading: false, urls: {}, error: null })

  useEffect(() => {
    if (!pathsKey) {
      setState({ images: EMPTY, loading: false, urls: {}, error: null })
      return
    }
    const abort = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    ;(async () => {
      const res = await getImageUrls(scriptId)
      if (abort.signal.aborted) return
      if (!res.ok) return setState({ images: EMPTY, loading: false, urls: {}, error: res.error })
      try {
        const loaded = await loadSceneImages(res.urls, abort.signal)
        if (abort.signal.aborted) return
        setState({
          images: loaded.images,
          loading: false,
          urls: res.urls,
          error: loaded.failed > 0 ? `배경 그림 ${loaded.failed}개를 불러오지 못해 그림 없이 보여요.` : null,
        })
      } catch {
        // 취소됨
      }
    })()
    return () => abort.abort()
  }, [scriptId, pathsKey])

  return state
}
