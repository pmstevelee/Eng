'use client'

import { useEffect, useState } from 'react'

/** 서버 렌더 시각으로 시작해 30초마다 갱신되는 현재 시각 (수업 상태·지각 판단용) */
export function useNow(initialMs: number, intervalMs = 30_000): number {
  const [now, setNow] = useState(initialMs)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
