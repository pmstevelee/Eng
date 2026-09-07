const EXAM_CATEGORY_LABEL: Record<string, string> = {
  IELTS: '아이엘츠',
  CELPIP: '셀핍',
  TOEFL: '토플',
  TOEIC: '토익',
  SAT: 'SAT',
}

interface ExamCategoryBadgesProps {
  categories: string[]
  className?: string
}

/** 단어/세트가 속한 시험 카테고리를 뱃지로 나열한다. 여러 개면 중복 소속을 그대로 보여준다. */
export function ExamCategoryBadges({ categories, className = '' }: ExamCategoryBadgesProps) {
  if (categories.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {categories.map((cat) => (
        <span
          key={cat}
          className="text-xs font-medium px-1.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 shrink-0"
        >
          {EXAM_CATEGORY_LABEL[cat] ?? cat}
        </span>
      ))}
    </div>
  )
}

export const EXAM_CATEGORY_OPTIONS = [
  { value: 'IELTS', label: 'IELTS' },
  { value: 'CELPIP', label: 'CELPIP' },
  { value: 'TOEFL', label: 'TOEFL' },
  { value: 'TOEIC', label: 'TOEIC' },
  { value: 'SAT', label: 'SAT' },
] as const
