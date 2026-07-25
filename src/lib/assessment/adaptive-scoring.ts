/**
 * 적응형 레벨 테스트 점수/레벨 산정 (순수 로직, DB 의존성 없음)
 * - 난이도 추정, 목표 난이도 결정, 종료 조건, 영역/종합 레벨 판정
 * - DB 호출이 없어 유닛 테스트로 커버 가능 (adaptive-test-engine.ts에서 재-export)
 */

export type AdaptiveDomain = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'

export type QuestionHistoryItem = {
  questionId: string
  difficulty: number
  isCorrect: boolean
  domain: AdaptiveDomain
}

export type AdaptiveConfig = {
  questionsPerDomain: number   // 영역당 문제 수 (기본 7)
  startLevel: number           // 시작 난이도 (기본 5)
  writingQuestions: number     // 쓰기 문제 수 (기본 2)
  minListeningQuestions?: number  // 듣기 측정 최소 문제 수 (기본 3, 미달 시 듣기 생략)
}

export type DomainLevelResult = {
  domain: AdaptiveDomain
  level: number        // 1~10 정수
  rawScore: number     // 0~1 소수
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export type PlacementResult = {
  grammarLevel: number
  vocabularyLevel: number
  readingLevel: number
  listeningLevel: number | null  // null: 듣기 문제 부족으로 미측정
  writingLevel: number
  overallLevel: number
  domainDetails: DomainLevelResult[]
  imbalanceWarning: boolean   // 특정 영역이 종합보다 3단계 이상 낮음
  weakestDomain: AdaptiveDomain
  strongestDomain: AdaptiveDomain
  previousLevel: number | null
  levelChange: number | null
}

// ─── 레벨 추정 알고리즘 ────────────────────────────────────────────────────────

/**
 * 현재까지 풀이 이력으로 레벨 추정값 계산
 */
export function estimateCurrentLevel(
  history: QuestionHistoryItem[],
  startLevel: number,
): number {
  if (history.length === 0) return startLevel

  const correctItems = history.filter((h) => h.isCorrect)
  const wrongItems = history.filter((h) => !h.isCorrect)

  if (correctItems.length === 0) {
    // 모두 틀림: 시작레벨 - 1 (최소 1)
    const lowestWrong = Math.min(...wrongItems.map((h) => h.difficulty))
    return Math.max(1, lowestWrong - 1)
  }

  if (wrongItems.length === 0) {
    // 모두 맞힘: 마지막 정답 난이도 + 1 (최대 10)
    const highestCorrect = Math.max(...correctItems.map((h) => h.difficulty))
    return Math.min(10, highestCorrect + 1)
  }

  // 맞힌 문제 중 가장 높은 난이도와 틀린 문제 중 가장 낮은 난이도의 중간
  const highestCorrect = Math.max(...correctItems.map((h) => h.difficulty))
  const lowestWrong = Math.min(...wrongItems.map((h) => h.difficulty))

  if (highestCorrect >= lowestWrong) {
    // 역전 현상 (고난이도 맞추고 저난이도 틀린 경우) → 최근 성과 중시
    const recentItems = history.slice(-4)
    const recentCorrect = recentItems.filter((h) => h.isCorrect).length
    return recentCorrect >= 2
      ? Math.min(10, highestCorrect + 0.5)
      : Math.max(1, lowestWrong - 0.5)
  }

  return (highestCorrect + lowestWrong) / 2
}

/**
 * 다음 문제 목표 난이도 결정
 */
export function getTargetDifficulty(
  history: QuestionHistoryItem[],
  currentEstimate: number,
): number {
  let target = Math.round(currentEstimate)
  target = Math.max(1, Math.min(10, target))

  if (history.length < 2) return target

  const lastTwo = history.slice(-2)
  const lastTwoCorrect = lastTwo.every((h) => h.isCorrect)
  const lastTwoWrong = lastTwo.every((h) => !h.isCorrect)

  if (lastTwoCorrect) {
    target = Math.min(10, target + 1)
  } else if (lastTwoWrong) {
    target = Math.max(1, target - 1)
  }

  return target
}

/**
 * 종료 조건 체크
 */
export function shouldEndDomain(
  history: QuestionHistoryItem[],
  config: AdaptiveConfig,
  domain: AdaptiveDomain,
): boolean {
  const maxQ = domain === 'WRITING' ? config.writingQuestions : config.questionsPerDomain

  // 최대 문제 수 도달
  if (history.length >= maxQ) return true

  if (history.length < 3) return false

  const lastThree = history.slice(-3)

  // 연속 3문제 정답 + 최고 난이도 도달 (천장 효과)
  if (lastThree.every((h) => h.isCorrect) && lastThree.every((h) => h.difficulty >= 10)) {
    return true
  }

  // 연속 3문제 오답 + 최저 난이도 도달 (바닥 효과)
  if (lastThree.every((h) => !h.isCorrect) && lastThree.every((h) => h.difficulty <= 1)) {
    return true
  }

  // 추정 레벨이 3문제 연속 수렴 (±0.5 이내)
  if (history.length >= 5) {
    const estimates = []
    for (let i = history.length - 3; i < history.length; i++) {
      estimates.push(estimateCurrentLevel(history.slice(0, i + 1), 5))
    }
    const maxEst = Math.max(...estimates)
    const minEst = Math.min(...estimates)
    if (maxEst - minEst <= 0.5) return true
  }

  return false
}

// ─── 레벨 판정 ─────────────────────────────────────────────────────────────────

/**
 * 영역별 레벨 판정 (경계선 방식 + 가중 평균 혼합)
 */
export function calculateDomainLevel(
  history: QuestionHistoryItem[],
  startLevel: number,
): DomainLevelResult {
  const domain = history[0]?.domain ?? 'GRAMMAR'

  if (history.length === 0) {
    return { domain, level: startLevel, rawScore: 0.5, confidence: 'LOW' }
  }

  // 방법 1: 경계선 방식 - 난이도별 정답률
  const levelStats: Record<number, { correct: number; total: number }> = {}
  for (const item of history) {
    if (!levelStats[item.difficulty]) {
      levelStats[item.difficulty] = { correct: 0, total: 0 }
    }
    levelStats[item.difficulty].total++
    if (item.isCorrect) levelStats[item.difficulty].correct++
  }

  // 정답률 70% 이상인 가장 높은 레벨
  let boundaryLevel = 1
  for (let lv = 1; lv <= 10; lv++) {
    const stat = levelStats[lv]
    if (!stat) continue
    const rate = stat.correct / stat.total
    if (rate >= 0.7) {
      boundaryLevel = lv
    }
  }

  // 경계선 위 레벨의 정답률이 40~70%이면 소수점으로 표현
  const nextLevelStat = levelStats[boundaryLevel + 1]
  if (nextLevelStat) {
    const nextRate = nextLevelStat.correct / nextLevelStat.total
    if (nextRate >= 0.4 && nextRate < 0.7) {
      boundaryLevel = boundaryLevel + 0.5
    }
  }

  // 방법 2: 가중 평균 (최근 문제일수록 가중치 높음)
  let weightedSum = 0
  let weightTotal = 0
  history.forEach((item, idx) => {
    if (item.isCorrect) {
      const weight = idx + 1 // 최근일수록 높은 가중치
      weightedSum += item.difficulty * weight
      weightTotal += weight
    }
  })
  // 정답이 하나도 없으면 startLevel로 폴백하지 않는다.
  // (폴백 시 전부 오답인 학생도 Level 3 안팎으로 부풀려지는 버그가 있었음)
  // 대신 응시한 최저 난이도 - 1을 추정치로 사용해 실제 실력에 가깝게 낮춘다.
  const weightedAvg =
    weightTotal > 0
      ? weightedSum / weightTotal
      : Math.max(1, Math.min(...history.map((h) => h.difficulty)) - 1)

  // 최종: 두 방법의 평균, 반올림
  const rawLevel = (boundaryLevel + weightedAvg) / 2
  const finalLevel = Math.max(1, Math.min(10, Math.round(rawLevel)))

  // 신뢰도 판정 (문제 수 기반)
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    history.length >= 6 ? 'HIGH' : history.length >= 4 ? 'MEDIUM' : 'LOW'

  // rawScore: 전체 정답률
  const totalCorrect = history.filter((h) => h.isCorrect).length
  const rawScore = history.length > 0 ? totalCorrect / history.length : 0

  return { domain, level: finalLevel, rawScore, confidence }
}

/**
 * 종합 레벨 판정 (가중 방식)
 * 듣기가 측정된 경우: 5영역 가중 평균 (문법 25%, 어휘 25%, 읽기 20%, 듣기 15%, 쓰기 15%)
 * 듣기가 미측정인 경우: 4영역 가중 평균 (문법 30%, 어휘 30%, 읽기 25%, 쓰기 15%)
 */
export function calculateOverallLevel(domainResults: DomainLevelResult[]): number {
  const getLevel = (domain: AdaptiveDomain): number | null => {
    const r = domainResults.find((d) => d.domain === domain)
    return r?.level ?? null
  }

  const grammar = getLevel('GRAMMAR') ?? 5
  const vocabulary = getLevel('VOCABULARY') ?? 5
  const reading = getLevel('READING') ?? 5
  const listening = getLevel('LISTENING')
  const writing = getLevel('WRITING') ?? 5

  let weighted: number
  if (listening !== null) {
    // 5영역 가중 평균
    weighted = grammar * 0.25 + vocabulary * 0.25 + reading * 0.20 + listening * 0.15 + writing * 0.15
  } else {
    // 4영역 가중 평균 (듣기 미측정 시 하위 호환)
    weighted = grammar * 0.3 + vocabulary * 0.3 + reading * 0.25 + writing * 0.15
  }

  return Math.max(1, Math.min(10, Math.round(weighted)))
}

/**
 * 배치 결과 생성
 */
export function buildPlacementResult(
  domainResults: DomainLevelResult[],
  previousLevel: number | null,
): PlacementResult {
  const getLevel = (d: AdaptiveDomain): number =>
    domainResults.find((r) => r.domain === d)?.level ?? 5
  const getLevelOrNull = (d: AdaptiveDomain): number | null =>
    domainResults.find((r) => r.domain === d)?.level ?? null

  const grammarLevel = getLevel('GRAMMAR')
  const vocabularyLevel = getLevel('VOCABULARY')
  const readingLevel = getLevel('READING')
  const listeningLevel = getLevelOrNull('LISTENING')
  const writingLevel = getLevel('WRITING')
  const overallLevel = calculateOverallLevel(domainResults)

  // 측정된 도메인만 비교
  const measuredLevels = [grammarLevel, vocabularyLevel, readingLevel, writingLevel]
  if (listeningLevel !== null) measuredLevels.push(listeningLevel)
  const minLevel = Math.min(...measuredLevels)

  const domainLevels: Record<AdaptiveDomain, number> = {
    GRAMMAR: grammarLevel,
    VOCABULARY: vocabularyLevel,
    READING: readingLevel,
    LISTENING: listeningLevel ?? 5,
    WRITING: writingLevel,
  }
  // weakest/strongest는 측정된 도메인만 고려
  const measuredDomains = (Object.entries(domainLevels) as [AdaptiveDomain, number][])
    .filter(([d]) => d !== 'LISTENING' || listeningLevel !== null)
  const weakestDomain = measuredDomains.sort(([, a], [, b]) => a - b)[0][0]
  const strongestDomain = [...measuredDomains].sort(([, a], [, b]) => b - a)[0][0]

  return {
    grammarLevel,
    vocabularyLevel,
    readingLevel,
    listeningLevel,
    writingLevel,
    overallLevel,
    domainDetails: domainResults,
    imbalanceWarning: minLevel <= overallLevel - 3,
    weakestDomain,
    strongestDomain,
    previousLevel,
    levelChange: previousLevel !== null ? overallLevel - previousLevel : null,
  }
}

// ─── 쓰기 주제 선택 ────────────────────────────────────────────────────────────

export function getWritingPromptByLevel(estimatedLevel: number): {
  prompt: string
  wordRange: string
  levelLabel: string
} {
  if (estimatedLevel <= 3) {
    return {
      prompt: '자기 소개를 해보세요. 이름, 나이, 좋아하는 것을 영어로 써 보세요.',
      wordRange: '20~40단어',
      levelLabel: '초급',
    }
  } else if (estimatedLevel <= 5) {
    return {
      prompt:
        'Describe your favorite hobby or activity. Why do you enjoy it? Write about what you do and how it makes you feel.',
      wordRange: '40~80단어',
      levelLabel: '중하급',
    }
  } else if (estimatedLevel <= 7) {
    return {
      prompt:
        'Do you think technology has made our lives better or worse? Give your opinion with at least two reasons and examples.',
      wordRange: '80~120단어',
      levelLabel: '중급',
    }
  } else {
    return {
      prompt:
        'Some people argue that social media has had a largely negative impact on society. To what extent do you agree or disagree? Support your argument with specific evidence and reasoning.',
      wordRange: '120~200단어',
      levelLabel: '고급',
    }
  }
}
