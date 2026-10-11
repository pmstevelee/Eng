// 학생 학년·학습레벨 설문 (가입·설정 공용 — 클라이언트/서버 공용, 서버 전용 import 금지)

import { GRADE_OPTIONS } from '@/lib/consultation/constants'

export const STUDENT_GRADE_OPTIONS = GRADE_OPTIONS

export function isValidStudentGrade(grade: string): boolean {
  return STUDENT_GRADE_OPTIONS.includes(grade)
}

export function isValidLearningLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 10
}

// 학년별 추천 시작 레벨 (설문에서 기본 선택값으로만 사용)
const GRADE_RECOMMENDED_LEVEL: Record<string, number> = {
  '미취학': 1,
  '초1': 1, '초2': 1, '초3': 2, '초4': 2, '초5': 3, '초6': 3,
  '중1': 4, '중2': 4, '중3': 5,
  '고1': 5, '고2': 6, '고3': 6,
}

export function getRecommendedLevel(grade: string): number {
  return GRADE_RECOMMENDED_LEVEL[grade] ?? 1
}
