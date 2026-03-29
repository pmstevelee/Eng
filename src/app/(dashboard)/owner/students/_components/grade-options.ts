export const GRADE_OPTIONS = [
  { value: 1, label: '초1' },
  { value: 2, label: '초2' },
  { value: 3, label: '초3' },
  { value: 4, label: '중1' },
  { value: 5, label: '중2' },
  { value: 6, label: '중3' },
  { value: 7, label: '고1' },
  { value: 8, label: '고2' },
  { value: 9, label: '고3' },
  { value: 10, label: '대학생' },
  { value: 11, label: '일반' },
] as const

export function gradeLabel(grade: number | null | undefined): string {
  if (!grade) return '–'
  return GRADE_OPTIONS.find((g) => g.value === grade)?.label ?? String(grade)
}
