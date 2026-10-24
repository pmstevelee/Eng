import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { getGrammarCodeDepth, getParentGrammarCode, isValidGrammarCode } from './code'
import {
  findPrerequisiteCycle,
  flattenCurriculumPoints,
  validateCurriculum,
  type CurriculumData,
} from './curriculum-data'

describe('isValidGrammarCode', () => {
  it('세 가지 깊이의 올바른 코드', () => {
    expect(isValidGrammarCode('G07')).toBe(true)
    expect(isValidGrammarCode('G07-01')).toBe(true)
    expect(isValidGrammarCode('G07-01-03')).toBe(true)
  })

  it('깊이를 지정하면 그 깊이만 통과', () => {
    expect(isValidGrammarCode('G07-01-03', 3)).toBe(true)
    expect(isValidGrammarCode('G07-01', 3)).toBe(false)
    expect(isValidGrammarCode('G07', 1)).toBe(true)
    expect(isValidGrammarCode('G07-01-03', 1)).toBe(false)
  })

  it('형식이 틀린 코드', () => {
    for (const bad of ['', 'G7', 'g07', 'G07-1', 'G07-01-3', 'G07-01-03-01', 'G07_01', ' G07', 'X07-01', 'G07-01-'])
      expect(isValidGrammarCode(bad)).toBe(false)
  })

  it('번호 00은 무효', () => {
    expect(isValidGrammarCode('G00')).toBe(false)
    expect(isValidGrammarCode('G01-00')).toBe(false)
    expect(isValidGrammarCode('G01-01-00')).toBe(false)
  })

  it('깊이·상위 코드', () => {
    expect(getGrammarCodeDepth('G12-04-03')).toBe(3)
    expect(getGrammarCodeDepth('nope')).toBeNull()
    expect(getParentGrammarCode('G07-01-03')).toBe('G07-01')
    expect(getParentGrammarCode('G07-01')).toBe('G07')
    expect(getParentGrammarCode('G07')).toBeNull()
  })
})

describe('findPrerequisiteCycle', () => {
  it('순환이 없으면 null', () => {
    const edges = new Map([
      ['c', ['b']],
      ['b', ['a']],
      ['a', []],
    ])
    expect(findPrerequisiteCycle(edges)).toBeNull()
  })

  it('순환 경로를 찾는다', () => {
    const edges = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ])
    expect(findPrerequisiteCycle(edges)).toEqual(['a', 'b', 'c', 'a'])
  })
})

function sample(): CurriculumData {
  return {
    version: 1,
    categories: [
      {
        code: 'G01',
        name: '문장의 기초',
        sortOrder: 1,
        children: [
          {
            code: 'G01-01',
            name: '품사',
            sortOrder: 1,
            points: [
              { code: 'G01-01-01', title: '8품사', levelMin: 1, levelMax: 2, sortOrder: 1, prerequisites: [] },
              { code: 'G01-01-02', title: '명사', levelMin: 1, levelMax: 2, sortOrder: 2, prerequisites: ['G01-01-01'] },
            ],
          },
        ],
      },
    ],
    courses: [{ name: '기초', sortOrder: 1, targetLevel: 2, points: ['G01-01-01', 'G01-01-02'] }],
  }
}

describe('validateCurriculum', () => {
  it('올바른 데이터는 오류 없음', () => {
    expect(validateCurriculum(sample())).toEqual([])
  })

  it('없는 선수 코드·순환·코스 오류를 잡는다', () => {
    const data = sample()
    const [p1, p2] = data.categories[0].children[0].points
    p1.prerequisites = ['G01-01-02']
    p2.prerequisites.push('G09-09-09')
    data.courses[0].points.push('G02-01-01')
    const errors = validateCurriculum(data)
    expect(errors.some((e) => e.includes('없는 선수 코드') && e.includes('G09-09-09'))).toBe(true)
    expect(errors.some((e) => e.startsWith('선수 관계 순환'))).toBe(true)
    expect(errors.some((e) => e.includes('없는 포인트: G02-01-01'))).toBe(true)
  })

  it('상위 코드 불일치·레벨 오류·중복 코드를 잡는다', () => {
    const data = sample()
    const sub = data.categories[0].children[0]
    sub.points[1].code = 'G02-01-02'
    sub.points[0].levelMin = 5
    sub.points[0].levelMax = 3
    sub.points.push({ ...sub.points[0] })
    const errors = validateCurriculum(data)
    expect(errors.some((e) => e.includes('G02-01-02') && e.includes('아래에 있지 않음'))).toBe(true)
    expect(errors.some((e) => e.startsWith('레벨 범위 오류'))).toBe(true)
    expect(errors.some((e) => e === '중복 코드: G01-01-01')).toBe(true)
  })
})

describe('prisma/data/grammar-curriculum.json', () => {
  const file = path.resolve(__dirname, '../../../prisma/data/grammar-curriculum.json')
  const data = JSON.parse(readFileSync(file, 'utf8')) as CurriculumData

  it('검증 오류 없음 (선수 코드 존재, 순환 없음, 코스 포인트 존재)', () => {
    expect(validateCurriculum(data)).toEqual([])
  })

  it('대분류 G01~G12, 포인트 약 200개, 본사 코스 6종', () => {
    expect(data.categories.map((c) => c.code)).toEqual(
      Array.from({ length: 12 }, (_, i) => `G${String(i + 1).padStart(2, '0')}`),
    )
    const count = flattenCurriculumPoints(data).length
    expect(count).toBeGreaterThanOrEqual(180)
    expect(count).toBeLessThanOrEqual(230)
    expect(data.courses.map((c) => c.name)).toEqual(['초등 기초', '중1 문법', '중2 문법', '중3 문법', '고1 총정리', '고2 심화'])
  })

  it('고1 총정리는 G01~G12를 모두 포함, 고2 심화는 G09~G12 중심', () => {
    const top = (code: string) => code.slice(0, 3)
    const go1 = new Set(data.courses.find((c) => c.name === '고1 총정리')!.points.map(top))
    expect(go1.size).toBe(12)
    const go2 = data.courses.find((c) => c.name === '고2 심화')!.points
    const core = go2.filter((code) => ['G09', 'G10', 'G11', 'G12'].includes(top(code))).length
    expect(core / go2.length).toBeGreaterThan(0.8)
  })
})
