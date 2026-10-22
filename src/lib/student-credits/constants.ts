// 학생 결제(학생 개인 크레딧) 공용 상수 — 서버·클라이언트 공용
// 학생 결제는 Academy.settingsJson.studentPaidFeatures.aiFlashcard === true 인 학원(현재 위고업잉글리시)에서만 열린다.

export type StudentCreditPackage = {
  key: string
  name: string
  priceKrw: number
  credits: number
}

/** 학생 충전 상품 (1크레딧 ≈ 1원, 큰 상품은 보너스 포함) */
export const STUDENT_CREDIT_PACKAGES: StudentCreditPackage[] = [
  { key: 'STUDENT_3000', name: '라이트', priceKrw: 3_000, credits: 3_000 },
  { key: 'STUDENT_5000', name: '베이직', priceKrw: 5_000, credits: 5_500 },
  { key: 'STUDENT_10000', name: '플러스', priceKrw: 10_000, credits: 12_000 },
]

export function findStudentCreditPackage(key: string): StudentCreditPackage | null {
  return STUDENT_CREDIT_PACKAGES.find((p) => p.key === key) ?? null
}

/** 학생 1명당 매월 무료로 만들 수 있는 AI 플래시카드 단어 수 (체험용) */
export const STUDENT_FREE_FLASHCARD_WORDS_PER_MONTH = 20

export type StudentPaidFeatures = { aiFlashcard: boolean }

/** Academy.settingsJson → 학생 결제 기능 설정 (없으면 모두 꺼짐 = 기존 동작) */
export function parseStudentPaidFeatures(settingsJson: unknown): StudentPaidFeatures {
  const root = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson) ? settingsJson : {}
  const raw = (root as Record<string, unknown>).studentPaidFeatures
  const features = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return { aiFlashcard: features.aiFlashcard === true }
}
