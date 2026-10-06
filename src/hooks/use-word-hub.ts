'use client'

import { useSearchParams } from 'next/navigation'

/**
 * 단어 학습 화면의 "돌아가기" 대상.
 * 오늘의 단어학습에서 진입(?from=daily)했으면 오늘의 학습 허브로, 아니면 단어 허브로 돌아간다.
 */
export function useWordHub() {
  const searchParams = useSearchParams()
  const fromDaily = searchParams.get('from') === 'daily'
  return {
    href: fromDaily ? '/student/daily-mission' : '/student/words',
    label: fromDaily ? '오늘의 단어학습으로 돌아가기' : '단어 허브로 돌아가기',
    /** 다음 단계 링크에 붙일 쿼리 (진입 경로 유지) */
    query: fromDaily ? '?from=daily' : '',
  }
}
