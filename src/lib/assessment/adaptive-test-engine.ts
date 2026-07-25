/**
 * 적응형 레벨 테스트 엔진
 * 학생의 응답에 따라 다음 문제 난이도를 실시간 조정하여 정확한 레벨 측정
 */

import { prisma } from '@/lib/prisma/client'
import { getAdaptivePoolMeta } from '@/lib/questions/cached-queries'
import { pickAdaptiveQuestion } from './adaptive-selection'
import type {
  AdaptiveDomain,
  QuestionHistoryItem,
  AdaptiveConfig,
  PlacementResult,
} from './adaptive-scoring'

// ─── 순수 점수 로직 재-export (기존 import 경로 호환) ────────────────────────────

export {
  estimateCurrentLevel,
  getTargetDifficulty,
  shouldEndDomain,
  calculateDomainLevel,
  calculateOverallLevel,
  buildPlacementResult,
  getWritingPromptByLevel,
  type AdaptiveDomain,
  type QuestionHistoryItem,
  type AdaptiveConfig,
  type DomainLevelResult,
  type PlacementResult,
} from './adaptive-scoring'

// ─── 엔진 전용 타입 정의 ────────────────────────────────────────────────────────

export type DomainProgress = {
  domain: AdaptiveDomain
  history: QuestionHistoryItem[]
  currentEstimate: number
  isComplete: boolean
  assessedLevel: number | null
}

export type AdaptiveSessionState = {
  studentId: string
  testSessionId: string
  config: AdaptiveConfig
  currentDomain: AdaptiveDomain
  domainOrder: AdaptiveDomain[]
  domainProgress: Record<AdaptiveDomain, DomainProgress>
  isComplete: boolean
}

export type NextQuestionResult = {
  questionId: string
  domain: AdaptiveDomain
  difficulty: number
  contentJson: unknown
  targetDifficulty: number
  estimatedLevel: number
}

// ─── 문제 선택 ─────────────────────────────────────────────────────────────────

export {
  pickAdaptiveQuestion,
  type AdaptivePickCandidate,
  type AdaptiveExclusions,
} from './adaptive-selection'

/**
 * 적응형 다음 문제 선택
 * - 캐시된 영역별 문제 풀(메타데이터)에서 메모리 선정 후, 선택된 1건만 본문 조회
 * - exclusions 미전달 시 세션 내 중복만 방지 (하위 호환)
 */
export async function selectNextAdaptiveQuestion(
  domain: AdaptiveDomain,
  targetDifficulty: number,
  usedQuestionIds: string[],
  academyId: string | null,
  options?: {
    studentSeenIds?: string[]
    academyUsedIds?: string[]
  },
): Promise<NextQuestionResult | null> {
  const pool = await getAdaptivePoolMeta(academyId, domain)

  const picked = pickAdaptiveQuestion(pool, targetDifficulty, {
    sessionUsedIds: new Set(usedQuestionIds),
    studentSeenIds: new Set(options?.studentSeenIds ?? []),
    academyUsedIds: new Set(options?.academyUsedIds ?? []),
  })

  if (!picked) return null

  const question = await prisma.question.findUnique({
    where: { id: picked.id },
    select: { id: true, difficulty: true, contentJson: true },
  })
  if (!question) return null

  return {
    questionId: question.id,
    domain,
    difficulty: question.difficulty,
    contentJson: question.contentJson,
    targetDifficulty,
    estimatedLevel: targetDifficulty,
  }
}

// ─── 결과 저장 ─────────────────────────────────────────────────────────────────

/**
 * 레벨 평가 결과 DB 저장 + 학생 현재 레벨 업데이트
 */
export async function saveLevelAssessment(
  studentId: string,
  testSessionId: string,
  result: PlacementResult,
): Promise<{ id: string }> {
  // 트랜잭션으로 이전 평가 비활성화 + 새 평가 생성
  // 주의: 학생 레벨 직접 업데이트는 제거됨.
  //       레벨은 promotion-engine.ts의 checkPromotionStatus()가 3가지 승급 조건을
  //       모두 확인한 후 충족 시에만 업데이트함.
  const assessment = await prisma.$transaction(async (tx) => {
    // 이전 is_current 비활성화
    await tx.levelAssessment.updateMany({
      where: { studentId, isCurrent: true },
      data: { isCurrent: false },
    })

    // 새 평가 생성
    const newAssessment = await tx.levelAssessment.create({
      data: {
        studentId,
        testSessionId,
        assessmentType: 'PLACEMENT',
        grammarLevel: result.grammarLevel,
        vocabularyLevel: result.vocabularyLevel,
        readingLevel: result.readingLevel,
        listeningLevel: result.listeningLevel ?? null,
        writingLevel: result.writingLevel,
        overallLevel: result.overallLevel,
        detailJson: JSON.parse(JSON.stringify(result)),
        assessedBy: 'SYSTEM',
        isCurrent: true,
      },
      select: { id: true },
    })

    // [구 로직 - 주석 처리] 레벨 테스트 완료 직후 바로 레벨 업데이트하던 방식
    // 이제 checkPromotionStatus()를 통해 3가지 조건 모두 충족 시에만 승급됨
    // await tx.student.update({
    //   where: { id: studentId },
    //   data: { currentLevel: result.overallLevel },
    // })

    return newAssessment
  })

  return assessment
}
