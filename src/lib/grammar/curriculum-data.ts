// 커리큘럼 JSON(prisma/data/grammar-curriculum.json) 형식과 검증 — 순수 함수
// 시드 실행 전 검사, 검사 스크립트, 테스트가 같이 쓴다.

import { getParentGrammarCode, isValidGrammarCode } from './code'

export interface CurriculumPointData {
  code: string
  title: string
  levelMin: number
  levelMax: number
  sortOrder: number
  /** 먼저 배우기를 권장하는 포인트 코드 (잠금 없음) */
  prerequisites: string[]
}

export interface CurriculumSubCategoryData {
  code: string
  name: string
  sortOrder: number
  points: CurriculumPointData[]
}

export interface CurriculumCategoryData {
  code: string
  name: string
  description?: string
  sortOrder: number
  children: CurriculumSubCategoryData[]
}

export interface CurriculumCourseData {
  name: string
  description?: string
  targetLevel?: number
  sortOrder: number
  /** 학습 순서대로 나열한 포인트 코드 */
  points: string[]
}

export interface CurriculumData {
  version: number
  description?: string
  categories: CurriculumCategoryData[]
  courses: CurriculumCourseData[]
}

export function flattenCurriculumPoints(data: CurriculumData): CurriculumPointData[] {
  return data.categories.flatMap((c) => c.children.flatMap((m) => m.points))
}

function isLevel(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10
}

/** 선수 관계에서 순환을 찾아 경로를 돌려준다 (없으면 null) */
export function findPrerequisiteCycle(edges: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  function visit(code: string): string[] | null {
    const s = state.get(code)
    if (s === 'done') return null
    if (s === 'visiting') return [...stack.slice(stack.indexOf(code)), code]
    state.set(code, 'visiting')
    stack.push(code)
    for (const next of edges.get(code) ?? []) {
      const cycle = visit(next)
      if (cycle) return cycle
    }
    stack.pop()
    state.set(code, 'done')
    return null
  }

  for (const code of Array.from(edges.keys())) {
    const cycle = visit(code)
    if (cycle) return cycle
  }
  return null
}

/**
 * 커리큘럼 데이터 검증. 문제가 없으면 빈 배열.
 * 코드 형식·상하위 일치·중복, 레벨 범위, 선수 코드 존재·순환, 코스 포인트 존재를 본다.
 */
export function validateCurriculum(data: CurriculumData): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  const pointCodes = new Set<string>()

  const claim = (code: string) => {
    if (seen.has(code)) errors.push(`중복 코드: ${code}`)
    seen.add(code)
  }

  for (const cat of data.categories) {
    if (!isValidGrammarCode(cat.code, 1)) errors.push(`대분류 코드 형식 오류: ${cat.code}`)
    if (!cat.name?.trim()) errors.push(`대분류 이름 없음: ${cat.code}`)
    claim(cat.code)

    for (const sub of cat.children) {
      if (!isValidGrammarCode(sub.code, 2)) errors.push(`중분류 코드 형식 오류: ${sub.code}`)
      else if (getParentGrammarCode(sub.code) !== cat.code)
        errors.push(`중분류 ${sub.code}가 대분류 ${cat.code} 아래에 있지 않음`)
      if (!sub.name?.trim()) errors.push(`중분류 이름 없음: ${sub.code}`)
      claim(sub.code)

      for (const p of sub.points) {
        if (!isValidGrammarCode(p.code, 3)) errors.push(`포인트 코드 형식 오류: ${p.code}`)
        else if (getParentGrammarCode(p.code) !== sub.code)
          errors.push(`포인트 ${p.code}가 중분류 ${sub.code} 아래에 있지 않음`)
        if (!p.title?.trim()) errors.push(`포인트 제목 없음: ${p.code}`)
        if (!isLevel(p.levelMin) || !isLevel(p.levelMax) || p.levelMin > p.levelMax)
          errors.push(`레벨 범위 오류: ${p.code} (${p.levelMin}~${p.levelMax})`)
        claim(p.code)
        pointCodes.add(p.code)
      }
    }
  }

  const edges = new Map<string, string[]>()
  for (const p of flattenCurriculumPoints(data)) {
    for (const req of p.prerequisites) {
      if (req === p.code) errors.push(`자기 자신을 선수로 지정: ${p.code}`)
      else if (!pointCodes.has(req)) errors.push(`없는 선수 코드: ${p.code} → ${req}`)
    }
    if (new Set(p.prerequisites).size !== p.prerequisites.length)
      errors.push(`선수 코드 중복: ${p.code}`)
    edges.set(p.code, p.prerequisites.filter((r) => pointCodes.has(r) && r !== p.code))
  }
  const cycle = findPrerequisiteCycle(edges)
  if (cycle) errors.push(`선수 관계 순환: ${cycle.join(' → ')}`)

  const courseNames = new Set<string>()
  for (const course of data.courses) {
    if (courseNames.has(course.name)) errors.push(`코스 이름 중복: ${course.name}`)
    courseNames.add(course.name)
    if (course.points.length === 0) errors.push(`빈 코스: ${course.name}`)
    if (new Set(course.points).size !== course.points.length) errors.push(`코스 포인트 중복: ${course.name}`)
    if (course.targetLevel !== undefined && !isLevel(course.targetLevel))
      errors.push(`코스 대상 레벨 오류: ${course.name}`)
    for (const code of course.points) {
      if (!pointCodes.has(code)) errors.push(`코스 ${course.name}에 없는 포인트: ${code}`)
    }
  }

  return errors
}
