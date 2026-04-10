import { prisma } from '@/lib/prisma/client'
import type { StudentProfile } from './student-analyzer'

// ── 타입 ───────────────────────────────────────────────────────────────────────

export type QuestionTagType = 'weakness' | 'maintain' | 'challenge'

export type QuestionTag = {
  type: QuestionTagType
  label: string
  category?: string
}

export type SelectedQuestion = {
  id: string
  domain: string
  difficulty: number
  subCategory: string | null
  cefrLevel: string | null
  contentJson: unknown
  tag: QuestionTag
}

// ── 상수 ───────────────────────────────────────────────────────────────────────

const DOMAIN_UPPER: Record<string, string> = {
  grammar: 'GRAMMAR',
  vocabulary: 'VOCABULARY',
  reading: 'READING',
  writing: 'WRITING',
  listening: 'LISTENING',
}

const DOMAIN_LABEL_KO: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  reading: '독해',
  writing: '쓰기',
  listening: '듣기',
}

const CEFR_LEVELS = ['Pre-A1', 'A1 하', 'A1 상', 'A2 하', 'A2 상', 'B1 하', 'B1 상', 'B2 하', 'B2 상', 'C1+']

// ── 헬퍼 ───────────────────────────────────────────────────────────────────────

function shiftCefr(cefrLevel: string, delta: number): string {
  const idx = CEFR_LEVELS.indexOf(cefrLevel)
  const base = idx === -1 ? 1 : idx
  const newIdx = Math.max(0, Math.min(CEFR_LEVELS.length - 1, base + delta))
  return CEFR_LEVELS[newIdx]
}

async function fetchCandidates(params: {
  domain: string
  subCategory?: string
  minDifficulty: number
  maxDifficulty: number
  studentId: string
  excludeIds: string[]
  take: number
}): Promise<SelectedQuestion[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const domainEnum = DOMAIN_UPPER[params.domain] as
    | 'GRAMMAR'
    | 'VOCABULARY'
    | 'READING'
    | 'WRITING'
    | 'LISTENING'

  if (!domainEnum) return []

  const rows = await prisma.question.findMany({
    where: {
      domain: domainEnum,
      ...(params.subCategory ? { subCategory: params.subCategory } : {}),
      difficulty: {
        gte: params.minDifficulty,
        lte: params.maxDifficulty,
      },
      // 최근 30일 내 이 학생이 이미 푼 문제 제외
      NOT: {
        responses: {
          some: {
            createdAt: { gte: thirtyDaysAgo },
            session: { studentId: params.studentId },
          },
        },
      },
      id:
        params.excludeIds.length > 0 ? { notIn: params.excludeIds } : undefined,
    },
    select: {
      id: true,
      domain: true,
      difficulty: true,
      subCategory: true,
      cefrLevel: true,
      contentJson: true,
    },
    take: params.take * 4, // 충분히 가져와서 셔플 후 자름
  })

  return [...rows]
    .sort(() => Math.random() - 0.5)
    .slice(0, params.take)
    .map((r) => ({ ...r, tag: { type: 'weakness' as QuestionTagType, label: '' } }))
}

// ── 메인 함수 ──────────────────────────────────────────────────────────────────

/**
 * adaptive 모드: 약점 70% + 유지 20% + 도전 10%
 */
export async function selectAdaptiveQuestions(
  profile: StudentProfile,
  count: number,
): Promise<SelectedQuestion[]> {
  const weakCount = Math.round(count * 0.7)
  const maintainCount = Math.round(count * 0.2)
  const challengeCount = count - weakCount - maintainCount

  const usedIds: string[] = []
  const result: SelectedQuestion[] = []

  // ── 1. 약점 문제 (70%) ──────────────────────────────────────────────────────

  const mistakes = profile.recentMistakes.slice(0, 3) // 상위 3개 오답 카테고리

  for (let i = 0; i < weakCount; i++) {
    const mistake = mistakes[i % Math.max(mistakes.length, 1)]
    const targetDomain = mistake?.domain.toLowerCase() ?? profile.overallWeakest
    const subCat = mistake?.category !== 'general' ? mistake?.category : undefined

    // 1차 시도: 해당 카테고리 문제
    let rows = await fetchCandidates({
      domain: targetDomain,
      subCategory: subCat,
      minDifficulty: Math.max(1, profile.currentLevel - 1),
      maxDifficulty: profile.currentLevel,
      studentId: profile.studentId,
      excludeIds: usedIds,
      take: 1,
    })

    // 2차 시도: 카테고리 제한 없이 해당 영역에서
    if (rows.length === 0) {
      rows = await fetchCandidates({
        domain: targetDomain,
        minDifficulty: Math.max(1, profile.currentLevel - 1),
        maxDifficulty: profile.currentLevel,
        studentId: profile.studentId,
        excludeIds: usedIds,
        take: 1,
      })
    }

    if (rows.length > 0) {
      const q = rows[0]
      usedIds.push(q.id)
      const catLabel = subCat ?? DOMAIN_LABEL_KO[targetDomain] ?? targetDomain
      result.push({
        ...q,
        tag: {
          type: 'weakness',
          label: `약점 보강: ${catLabel}`,
          category: subCat,
        },
      })
    }
  }

  // 약점 문제가 부족한 경우: 가장 약한 영역에서 채우기
  if (result.length < weakCount) {
    const needed = weakCount - result.length
    const fallback = await fetchCandidates({
      domain: profile.overallWeakest,
      minDifficulty: Math.max(1, profile.currentLevel - 1),
      maxDifficulty: profile.currentLevel,
      studentId: profile.studentId,
      excludeIds: usedIds,
      take: needed,
    })
    for (const q of fallback) {
      usedIds.push(q.id)
      result.push({
        ...q,
        tag: {
          type: 'weakness',
          label: `약점 보강: ${DOMAIN_LABEL_KO[profile.overallWeakest] ?? profile.overallWeakest}`,
        },
      })
    }
  }

  // ── 2. 유지 문제 (20%) ──────────────────────────────────────────────────────

  const maintainRows = await fetchCandidates({
    domain: profile.overallStrongest,
    minDifficulty: profile.currentLevel,
    maxDifficulty: profile.currentLevel,
    studentId: profile.studentId,
    excludeIds: usedIds,
    take: maintainCount,
  })

  for (const q of maintainRows) {
    usedIds.push(q.id)
    result.push({
      ...q,
      tag: {
        type: 'maintain',
        label: `실력 유지: ${DOMAIN_LABEL_KO[profile.overallStrongest] ?? profile.overallStrongest}`,
      },
    })
  }

  // ── 3. 도전 문제 (10%) ──────────────────────────────────────────────────────

  const challengeRows = await fetchCandidates({
    domain: profile.overallStrongest,
    minDifficulty: Math.min(10, profile.currentLevel + 1),
    maxDifficulty: Math.min(10, profile.currentLevel + 2),
    studentId: profile.studentId,
    excludeIds: usedIds,
    take: challengeCount,
  })

  for (const q of challengeRows) {
    usedIds.push(q.id)
    result.push({
      ...q,
      tag: {
        type: 'challenge',
        label: `도전 문제: Level ${Math.min(10, profile.currentLevel + 1)}`,
      },
    })
  }

  // 도전 문제 부족 시 다른 영역에서라도 가져오기
  if (challengeCount > 0 && result.filter((r) => r.tag.type === 'challenge').length === 0) {
    const fallbackChal = await fetchCandidates({
      domain: profile.overallWeakest,
      minDifficulty: profile.currentLevel,
      maxDifficulty: Math.min(10, profile.currentLevel + 1),
      studentId: profile.studentId,
      excludeIds: usedIds,
      take: challengeCount,
    })
    for (const q of fallbackChal) {
      usedIds.push(q.id)
      result.push({
        ...q,
        tag: {
          type: 'challenge',
          label: `도전 문제: Level ${Math.min(10, profile.currentLevel + 1)}`,
        },
      })
    }
  }

  return result
}

/**
 * domain 모드: 선택 영역 집중, 약점 카테고리 50% + 랜덤 50%
 */
export async function selectDomainQuestions(
  profile: StudentProfile,
  domain: string,
  difficulty: number,
  count: number,
): Promise<SelectedQuestion[]> {
  const targetLevel = Math.max(1, Math.min(10, difficulty))
  const usedIds: string[] = []
  const result: SelectedQuestion[] = []

  const halfCount = Math.ceil(count / 2)

  // 약한 카테고리 50%
  const dk = domain.toLowerCase() as keyof typeof profile.domainScores
  const weakCats = profile.domainScores[dk]?.weakCategories.slice(0, 2) ?? []

  for (const cat of weakCats) {
    const rows = await fetchCandidates({
      domain,
      subCategory: cat,
      minDifficulty: targetLevel,
      maxDifficulty: targetLevel,
      studentId: profile.studentId,
      excludeIds: usedIds,
      take: Math.ceil(halfCount / Math.max(weakCats.length, 1)),
    })
    for (const q of rows) {
      if (result.length >= halfCount) break
      usedIds.push(q.id)
      result.push({ ...q, tag: { type: 'weakness', label: `약점 보강: ${cat}` } })
    }
  }

  // 나머지 랜덤
  const remaining = count - result.length
  if (remaining > 0) {
    const rows = await fetchCandidates({
      domain,
      minDifficulty: targetLevel,
      maxDifficulty: targetLevel,
      studentId: profile.studentId,
      excludeIds: usedIds,
      take: remaining,
    })
    for (const q of rows) {
      usedIds.push(q.id)
      result.push({
        ...q,
        tag: {
          type: 'maintain',
          label: `${DOMAIN_LABEL_KO[domain.toLowerCase()] ?? domain} 연습`,
        },
      })
    }
  }

  return result
}

/**
 * smart domain 모드: 3가지 학습 모드 지원
 * - weakness: 가장 약한 카테고리 집중, 현재 레벨 or -1 난이도
 * - balanced: 균등 배분, 약점 30% 가중
 * - levelup: 현재 레벨+1 난이도, 강한 카테고리 우선
 */
export async function selectSmartDomainQuestions(
  profile: StudentProfile,
  domain: string,
  mode: 'weakness' | 'balanced' | 'levelup',
  count: number,
  excludeIds: string[] = [],
): Promise<SelectedQuestion[]> {
  const usedIds: string[] = [...excludeIds]
  const result: SelectedQuestion[] = []

  const dk = domain.toLowerCase() as keyof typeof profile.domainScores
  const weakCats = profile.domainScores[dk]?.weakCategories.slice(0, 3) ?? []

  if (mode === 'weakness') {
    // 약점 카테고리 집중, 난이도: currentLevel or max(1, currentLevel - 1)
    const targetLevel = Math.max(1, profile.currentLevel)
    const easierLevel = Math.max(1, profile.currentLevel - 1)

    // 1차: 약점 카테고리에서 가져오기
    if (weakCats.length > 0) {
      for (const cat of weakCats) {
        if (result.length >= count) break
        const rows = await fetchCandidates({
          domain,
          subCategory: cat,
          minDifficulty: easierLevel,
          maxDifficulty: targetLevel,
          studentId: profile.studentId,
          excludeIds: usedIds,
          take: Math.ceil(count / Math.max(weakCats.length, 1)) + 1,
        })
        for (const q of rows) {
          if (result.length >= count) break
          usedIds.push(q.id)
          result.push({ ...q, tag: { type: 'weakness', label: `약점 보강: ${cat}`, category: cat } })
        }
      }
    }

    // 2차: 부족하면 영역 전체에서 같은 난이도로 채우기
    if (result.length < count) {
      const fallback = await fetchCandidates({
        domain,
        minDifficulty: easierLevel,
        maxDifficulty: targetLevel,
        studentId: profile.studentId,
        excludeIds: usedIds,
        take: count - result.length,
      })
      for (const q of fallback) {
        if (result.length >= count) break
        usedIds.push(q.id)
        result.push({
          ...q,
          tag: { type: 'weakness', label: `${DOMAIN_LABEL_KO[domain] ?? domain} 연습` },
        })
      }
    }
  } else if (mode === 'balanced') {
    // 균등 배분: 약점 카테고리에서 약간 더 (30% 가중)
    const targetLevel = profile.currentLevel

    // 약점 카테고리에서 40% 가져오기
    const weakShare = Math.ceil(count * 0.4)
    if (weakCats.length > 0) {
      for (const cat of weakCats) {
        if (result.filter((q) => q.tag.type === 'weakness').length >= weakShare) break
        const take = Math.ceil(weakShare / Math.max(weakCats.length, 1))
        const rows = await fetchCandidates({
          domain,
          subCategory: cat,
          minDifficulty: targetLevel,
          maxDifficulty: targetLevel,
          studentId: profile.studentId,
          excludeIds: usedIds,
          take,
        })
        for (const q of rows) {
          if (result.filter((q2) => q2.tag.type === 'weakness').length >= weakShare) break
          usedIds.push(q.id)
          result.push({ ...q, tag: { type: 'weakness', label: `약점 보강: ${cat}`, category: cat } })
        }
      }
    }

    // 나머지는 전체 영역에서 균등하게
    const remaining = count - result.length
    if (remaining > 0) {
      const rows = await fetchCandidates({
        domain,
        minDifficulty: targetLevel,
        maxDifficulty: targetLevel,
        studentId: profile.studentId,
        excludeIds: usedIds,
        take: remaining,
      })
      for (const q of rows) {
        if (result.length >= count) break
        usedIds.push(q.id)
        result.push({
          ...q,
          tag: { type: 'maintain', label: `${DOMAIN_LABEL_KO[domain] ?? domain} 연습` },
        })
      }
    }

    // 최종 fallback: 난이도 범위 확장
    if (result.length < count) {
      const fallback = await fetchCandidates({
        domain,
        minDifficulty: Math.max(1, targetLevel - 1),
        maxDifficulty: Math.min(10, targetLevel + 1),
        studentId: profile.studentId,
        excludeIds: usedIds,
        take: count - result.length,
      })
      for (const q of fallback) {
        if (result.length >= count) break
        usedIds.push(q.id)
        result.push({
          ...q,
          tag: { type: 'maintain', label: `${DOMAIN_LABEL_KO[domain] ?? domain} 연습` },
        })
      }
    }
  } else {
    // levelup: 현재 레벨+1, 강한 카테고리(약점이 아닌 것) 우선
    const targetLevel = Math.min(10, profile.currentLevel + 1)
    const fallbackLevel = Math.min(10, profile.currentLevel + 2)

    // 1차: 높은 난이도로 가져오기
    const rows = await fetchCandidates({
      domain,
      minDifficulty: targetLevel,
      maxDifficulty: fallbackLevel,
      studentId: profile.studentId,
      excludeIds: usedIds,
      take: count,
    })
    for (const q of rows) {
      if (result.length >= count) break
      usedIds.push(q.id)
      result.push({
        ...q,
        tag: {
          type: 'challenge',
          label: `도전 문제: Level ${targetLevel}`,
        },
      })
    }

    // 2차 fallback: 현재 레벨에서 채우기
    if (result.length < count) {
      const fallback = await fetchCandidates({
        domain,
        minDifficulty: profile.currentLevel,
        maxDifficulty: targetLevel,
        studentId: profile.studentId,
        excludeIds: usedIds,
        take: count - result.length,
      })
      for (const q of fallback) {
        if (result.length >= count) break
        usedIds.push(q.id)
        result.push({
          ...q,
          tag: { type: 'challenge', label: `도전 문제: Level ${profile.currentLevel}` },
        })
      }
    }
  }

  return result
}

/**
 * review 모드: 스페이스드 리피티션 기반 오늘의 복습 문제
 */
export async function selectReviewQuestions(
  studentId: string,
  count: number,
): Promise<SelectedQuestion[]> {
  const now = new Date()

  const responses = await prisma.questionResponse.findMany({
    where: {
      isMastered: false,
      reviewDueAt: { lte: now },
      session: { studentId },
    },
    select: {
      question: {
        select: {
          id: true,
          domain: true,
          difficulty: true,
          subCategory: true,
          cefrLevel: true,
          contentJson: true,
        },
      },
    },
    orderBy: { reviewDueAt: 'asc' },
    take: count,
  })

  return responses.map((r) => ({
    ...r.question,
    tag: {
      type: 'weakness' as QuestionTagType,
      label: '오답 복습',
    },
  }))
}
