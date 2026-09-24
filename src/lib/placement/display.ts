// 레벨테스트 결과 표시용 라벨·문구 (클라이언트/서버 공용)

import { getLevelInfo } from '@/lib/constants/levels'

export type PlacementDomain = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'

export const PLACEMENT_DOMAIN_LABEL: Record<PlacementDomain, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

/** 영역 색상 (디자인 시스템 5영역 색상) */
export const PLACEMENT_DOMAIN_COLOR: Record<PlacementDomain, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

export const INVITE_STATUS_LABEL: Record<string, string> = {
  SENT: '응시 대기',
  STARTED: '응시 중',
  COMPLETED: '응시 완료',
  EXPIRED: '만료',
}

export const INVITE_STATUS_BADGE: Record<string, string> = {
  SENT: 'bg-primary-100 text-primary-700',
  STARTED: 'bg-accent-gold-light text-[#9A6B00]',
  COMPLETED: 'bg-accent-green-light text-[#16803D]',
  EXPIRED: 'bg-gray-100 text-gray-700',
}

/** 학부모용 레벨 설명 (1~10) */
const LEVEL_DESCRIPTION: Record<number, string> = {
  1: '영어를 처음 시작하는 단계로, 알파벳과 기초 단어를 익히고 있어요.',
  2: '간단한 단어와 짧은 표현을 이해하고, 기초 문장을 읽기 시작하는 단계예요.',
  3: '일상적인 짧은 문장을 이해하고, 쉬운 문장으로 자신을 표현할 수 있어요.',
  4: '익숙한 주제의 짧은 글을 읽고 이해하며, 기본 문법을 활용할 수 있어요.',
  5: '일상 주제의 글을 비교적 정확하게 이해하고, 간단한 글을 쓸 수 있어요.',
  6: '다양한 주제의 글에서 핵심 내용을 파악하고, 문장을 연결해 표현할 수 있어요.',
  7: '긴 글의 흐름을 이해하고, 자신의 생각을 논리적으로 표현하기 시작하는 단계예요.',
  8: '학술적·시사적 글도 이해할 수 있고, 복잡한 문장 구조를 활용할 수 있어요.',
  9: '수준 높은 글을 정확하게 이해하고, 자연스럽고 정확한 영어로 표현할 수 있어요.',
  10: '고급 수준의 영어를 폭넓게 이해하고 유창하게 사용할 수 있는 단계예요.',
}

export function levelHeadline(level: number): { title: string; cefr: string; description: string } {
  const info = getLevelInfo(level)
  return {
    title: `Level ${info.level} · ${info.nameKo}`,
    cefr: info.cefr,
    description: LEVEL_DESCRIPTION[info.level] ?? '',
  }
}

/** 영역별 결과를 종합 레벨과 비교한 한 줄 설명 */
export function domainComment(level: number | null, overall: number): string {
  if (level === null) return '이번 테스트에서는 측정하지 않았어요.'
  const diff = level - overall
  if (diff >= 2) return '특히 뛰어난 강점 영역이에요.'
  if (diff >= 1) return '전체 수준보다 조금 앞서 있어요.'
  if (diff <= -2) return '집중적인 보완이 필요한 영역이에요.'
  if (diff <= -1) return '조금 더 연습하면 좋아질 영역이에요.'
  return '전체 수준과 비슷하게 고르게 성장하고 있어요.'
}
