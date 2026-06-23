import { LEVELS } from '@/lib/constants/levels'

// Oxford CEFR(A1/A2/B1/B2/C1) → 위고업 레벨(1~10) 매핑
// 각 CEFR 대역의 하위 레벨(짝수)로 매핑.
// 홀수 중간 레벨(1,3,5,7,9)은 향후 세분화(예: A1하/A1상 구분 데이터) 시 사용.
const OXFORD_CEFR_TO_WEGOUP: Record<string, number> = {
  A1: 2, // LEVELS[1]: 'A1 하' (A1상=3은 세분화 시 활용)
  A2: 4, // LEVELS[3]: 'A2 하' (A2상=5은 세분화 시 활용)
  B1: 6, // LEVELS[5]: 'B1 하' (B1상=7은 세분화 시 활용)
  B2: 8, // LEVELS[7]: 'B2 하' (B2상=9은 세분화 시 활용)
  C1: 10, // LEVELS[9]: 'C1+'
}

// 빌드 타임에 매핑 값이 LEVELS 상수와 일치하는지 검증
;(function validateMapping() {
  for (const [oxfordCefr, wegoupLevel] of Object.entries(OXFORD_CEFR_TO_WEGOUP)) {
    const found = LEVELS.find((l) => l.level === wegoupLevel)
    if (!found) {
      throw new Error(
        `[cefr-mapping] Oxford CEFR "${oxfordCefr}" → 위고업 레벨 ${wegoupLevel}이 LEVELS 상수에 없습니다.`,
      )
    }
  }
})()

export function mapOxfordCefrToWegoupLevel(oxfordCefr: string): number {
  const level = OXFORD_CEFR_TO_WEGOUP[oxfordCefr]
  if (level === undefined) {
    throw new Error(`[cefr-mapping] 알 수 없는 Oxford CEFR: "${oxfordCefr}"`)
  }
  return level
}
