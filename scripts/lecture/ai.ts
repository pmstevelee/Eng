// AI 대본 생성 — 문법학습관리의 관리자 원고·개념 정리를 기준으로 슬라이드 + 세그먼트 대본을 만든다.
// 1단계: 슬라이드 구성(화면 내용) / 2단계: 슬라이드 몇 장씩 나레이션 세그먼트 (출력 길이 한도 회피)
// 모델은 AI_CONTENT_MODEL (requestJson이 거부 시 기본 모델로 재시도).

import { requestJson, EASY_EXPLANATION_RULES } from '@/lib/openai/grammar-point-draft'
import { formatScriptsForPrompt } from '@/lib/grammar/point-editing'
import { AI_CONTENT_MODEL } from '@/lib/openai/models'
import { getScriptsForCategory, getScriptsForPoint } from '@/lib/grammar/source-scripts'
import { prisma } from '@/lib/prisma/client'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'
import { mapLimit } from './common'
import type { PronunciationDict } from '../../src/lib/lecture-pipeline/normalize'
import { formatIssues, parseLectureScript, SLIDE_TYPES, type LectureScript, type ScriptIssue, type SlideType } from '../../src/lib/lecture-pipeline/types'
import type { Chapter } from '../../src/lib/lecture-pipeline/timing'
import { formatClock } from '../../src/lib/lecture-pipeline/timing'

/** 대본 작성 모델 — LECTURE_SCRIPT_MODEL이 없으면 관리자 콘텐츠 모델(AI_CONTENT_MODEL) */
const SCRIPT_MODEL = process.env.LECTURE_SCRIPT_MODEL?.trim() || AI_CONTENT_MODEL

// ── 문법 포인트 찾기 ──────────────────────────────────────

export interface GrammarScope {
  kind: 'point' | 'category'
  code: string
  title: string
  levelMin: number
  levelMax: number
  /** AI에 넘길 포인트 정리 (요약·규칙·예문·흔한 오류) */
  pointsText: string
  /** 관리자 원고 (없으면 빈 문자열) */
  sourceText: string
  pointTitles: string[]
}

const squash = (s: string) => s.replace(/\s+/g, '').replace(/(시제|용법|강의|의쓰임|문법)$/g, '')

const pointSelect = {
  id: true, code: true, title: true, levelMin: true, levelMax: true, categoryId: true, summary: true,
  rulesJson: true, examplesJson: true, commonErrorsJson: true, category: { select: { parentId: true } },
} as const

type PointRow = { code: string; title: string; summary: string | null; rulesJson: unknown; examplesJson: unknown; commonErrorsJson: unknown }

function describePoint(p: PointRow): string {
  const rules = parseGrammarRules(p.rulesJson)
  const examples = parseGrammarExamples(p.examplesJson)
  const errors = parseGrammarCommonErrors(p.commonErrorsJson)
  const lines = [`### ${p.code} ${p.title}`]
  if (p.summary) lines.push(`요약: ${p.summary}`)
  rules.forEach((r) => lines.push(`- 규칙: ${r.text}${r.formula ? ` (공식: ${r.formula})` : ''}`))
  examples.slice(0, 8).forEach((e) => lines.push(`- 예문: ${e.en} / ${e.ko}`))
  errors.forEach((e) => lines.push(`- 흔한 오류: ${e.wrong} → ${e.correct} (${e.reason})`))
  if (lines.length === 1) lines.push('(개념 정리 없음)')
  return lines.join('\n')
}

/** 강의 타이틀(또는 --point 코드)로 문법 포인트·중분류를 찾는다. 못 찾으면 null */
export async function findGrammarScope(title: string, code?: string | null): Promise<GrammarScope | null> {
  const key = squash(title)
  let point = code
    ? await prisma.grammarPoint.findFirst({ where: { code, academyId: null }, select: pointSelect })
    : (await prisma.grammarPoint.findMany({ where: { academyId: null }, select: pointSelect })).find((p) => squash(p.title) === key) ?? null

  let category = null as null | { id: string; code: string; name: string }
  if (!point) {
    const cats = await prisma.grammarCategory.findMany({ where: code ? { code } : { depth: 2 }, select: { id: true, code: true, name: true } })
    category = cats.find((c) => code || squash(c.name) === key) ?? cats.find((c) => key.includes(squash(c.name)) || squash(c.name).includes(key)) ?? null
  }
  if (!point && !category) {
    const hits = await prisma.grammarPoint.findMany({ where: { academyId: null, title: { contains: key.slice(0, 6) } }, select: pointSelect })
    if (hits.length === 1) point = hits[0]
  }

  if (point) {
    const scripts = await getScriptsForPoint(point.id, { categoryId: point.categoryId, parentCategoryId: point.category.parentId })
    return {
      kind: 'point', code: point.code, title: point.title, levelMin: point.levelMin, levelMax: point.levelMax,
      pointsText: describePoint(point), sourceText: scripts.prompt.length ? formatScriptsForPrompt(scripts.prompt) : '', pointTitles: [point.title],
    }
  }
  if (category) {
    const points = await prisma.grammarPoint.findMany({ where: { categoryId: category.id, academyId: null }, orderBy: { sortOrder: 'asc' }, select: pointSelect })
    const scripts = await getScriptsForCategory(category.id)
    return {
      kind: 'category', code: category.code, title: category.name,
      levelMin: Math.min(...points.map((p) => p.levelMin), 10), levelMax: Math.max(...points.map((p) => p.levelMax), 1),
      pointsText: points.map(describePoint).join('\n\n'), sourceText: scripts.prompt.length ? formatScriptsForPrompt(scripts.prompt) : '',
      pointTitles: points.map((p) => p.title),
    }
  }
  return null
}

// ── 1단계: 슬라이드 구성 ──────────────────────────────────

const SLIDE_SCHEMA = `슬라이드 type과 data 형식 (화면에 보이는 글자만 쓴다. 나레이션은 쓰지 않는다):
- title: { "title": 강의 제목(한국어), "subtitle": 영어 문법 이름(예: "Present Perfect") }
- goal: { "goals": ["오늘 배울 것", …] }  // 2~4개, 각 25자 이내
- concept: { "heading": 개념 제목(20자 이내), "lines": ["설명 한 줄", …] }  // 1~3줄, 각 34자 이내, 핵심어는 **굵게**
- formula: { "heading": 공식 이름, "blocks": [{"text":"주어","role":"subject"},{"text":"have/has","role":"verb"},{"text":"과거분사","role":"verb","note":"p.p."}], "example": [토큰…], "exampleKo": 해석 }  // 블록 2~5개
- example: { "sentence": [토큰…], "ko": 자연스러운 해석, "note": 짧은 포인트 메모(선택) }  // 영어 문장 1개, 56자 이내
- compare: { "rows": [{"sentence":[토큰…],"correct":false,"ko":"왜 틀렸는지 짧게"},{"sentence":[토큰…],"correct":true,"ko":"해석"}] }  // 정확히 2줄
- mistake: { "wrong": 한국 학생이 자주 쓰는 틀린 영어 문장, "right": [고친 문장 토큰…], "why": 이유 한 줄(34자 이내) }
- quiz: { "question": 한국어 질문, "sentence": 빈칸(___)이 있는 영어 문장(선택), "choices": [보기 2~4개], "answer": 정답 번호(0부터), "explanation": 해설 한 줄 }
- summary: { "points": ["핵심 정리", …] }  // 2~4개, 각 30자 이내
- outro: { "message": 마무리 인사(짧게, 16자 이내), "next": 다음 강의 제목(반드시 — 같은 단원의 다음 포인트나 이어서 배울 문법) }
토큰 = {"text": 단어 또는 덩어리, "role": "subject"|"verb"|"object"|"error"|"correct"(선택), "point": true(이번 문법 포인트 부분만)}
  예: [{"text":"She","role":"subject"},{"text":"has visited","role":"verb","point":true},{"text":"Jeju"},{"text":"twice."}]
모든 슬라이드에 "chapter"(YouTube 챕터 이름, 예: "개념", "만드는 법", "예문", "퀴즈", "정리")를 넣는다. 이어진 슬라이드는 같은 chapter를 써도 된다.`

function structureGuide(minutes: number): string {
  if (minutes <= 1.5) {
    return '약 1분 맛보기 강의: title → formula → example → compare → quiz → outro 순서로 정확히 6장.'
  }
  const slides = Math.round(minutes * 1.7) + 1
  return `약 ${minutes}분 강의, 슬라이드 ${slides}장 안팎.
- 처음은 title, 그다음 goal, 마지막은 summary → outro.
- 흐름: 언제 쓰는지(concept) → 만드는 법(formula) → 예문(example 여러 장) → 맞는/틀린 문장(compare) → 자주 하는 실수(mistake) → 퀴즈 → 정리.
- example은 전체의 30% 이상(긍정·부정·의문문, 여러 주어를 섞어서), quiz는 ${minutes >= 5 ? '2~3' : '1'}장, compare·mistake는 각각 1장 이상.`
}

function outlineSystemPrompt(): string {
  return `너는 "위고업잉글리시(WeGoUp English)" 영어문법 강의 영상의 콘텐츠 디렉터야. 한국 중학생이 YouTube로 보는 강의의 슬라이드 구성을 JSON으로 만든다.

학생이 이해하기 쉬운 설명 기준:
${EASY_EXPLANATION_RULES}

화면 규칙:
- 한 화면 텍스트는 최대 4줄. 글자는 크게(모바일 시청). 그래서 문장은 짧게 쓴다.
- 문법 정확성이 최우선이다. compare의 틀린 문장(correct:false)과 mistake의 wrong은 실제로 문법적으로 틀린 문장이어야 한다
  (예: "I have visit Jeju.", "I have seen him yesterday."). 맞는 문장을 다른 시제라는 이유로 틀렸다고 하지 않는다.
- 해석(ko)은 자연스러운 존댓말 없는 평서문 해석으로 쓴다 (예: "나는 숙제를 다 끝냈다").
- 영어 예문은 이번 문법 포인트가 분명히 드러나는 짧은 문장. 문법 포인트 부분 토큰에 "point": true, 주어는 role "subject", 동사는 role "verb".

${SLIDE_SCHEMA}

출력: { "slug": 영문 소문자-하이픈 (예: "present-perfect"), "title": 강의 제목, "slides": [ { "id": "s1", "type": …, "chapter": …, "data": {…} }, … ] }`
}

function scopeText(scope: GrammarScope | null): string {
  if (!scope) return '문법학습관리에서 맞는 포인트를 찾지 못했다. 일반적인 중학교 교과 과정 기준으로 정확하게 만든다.'
  return `문법학습관리 ${scope.kind === 'point' ? '포인트' : '중분류'}: ${scope.code} ${scope.title} (권장 레벨 ${scope.levelMin}~${scope.levelMax}, 10단계 중)
포함 포인트: ${scope.pointTitles.join(', ')}

[개념 정리]
${scope.pointsText}

[관리자 원고 — 설명의 기준. 원고와 다른 설명은 하지 않는다]
${scope.sourceText || '(원고 없음 — 위 개념 정리와 교과서 기준으로만 설명한다)'}`
}

// ── 2단계: 나레이션 ───────────────────────────────────────

const SLIDE_WEIGHT: Record<SlideType, number> = {
  title: 0.45, goal: 0.8, concept: 1.3, formula: 1.2, example: 1.1, compare: 1.1, mistake: 1.1, quiz: 1.0, summary: 1.0, outro: 0.5,
}

const REVEAL_RULES = `reveal 규칙 (화면 요소가 말하는 순간에 나타나게):
- goal: i번째 목표를 말하는 세그먼트에 "reveal": i
- concept: i번째 줄을 설명하기 시작하는 세그먼트에 "reveal": i
- formula: i번째 블록을 말하는 세그먼트에 "reveal": i, 예문(example)은 블록 수+1
- example: 화면 영어 문장을 읽는 en 세그먼트에 "reveal": 1 (화면 sentence와 글자까지 같은 문장), 해석을 말하는 ko 세그먼트에 "reveal": 2
- compare: i번째 줄의 문장을 읽는(또는 소개하는) 세그먼트에 "reveal": i
- mistake: 틀린 문장 1, 고친 문장 2, 이유 3
- quiz: 문제를 읽고 → "5초 드릴게요." 같은 안내 → { "lang":"ko", "text":"", "waitSec": 5, "emotion":"설명" } → 정답을 말하는 세그먼트에 "reveal": 1 → 해설 → 칭찬
- summary: i번째 정리를 말하는 세그먼트에 "reveal": i
- outro: 다음 강의를 소개하는 세그먼트에 "reveal": 1`

function narrationSystemPrompt(dict: PronunciationDict): string {
  const terms = Object.keys(dict.ko).filter((k) => /[A-Za-z]/.test(k)).join(', ')
  return `너는 "위고업잉글리시(WeGoUp English)" 영어문법 강의의 선생님 나레이션 작가야. 정해진 슬라이드에 맞춰 음성으로 읽을 세그먼트를 JSON으로 쓴다.

말투:
- 친근하고 또렷한 선생님 존댓말. "~해요", "~죠?", "~볼까요?"를 자연스럽게 섞는다. 반말·딱딱한 문어체("~이다", "~한다") 금지.
- 한 세그먼트는 1~2문장, 70자 이내. 한 문장에 한 가지만.
- 학생에게 가끔 질문하고(emotion "질문"), 핵심 규칙은 강조(emotion "강조"), 정답 뒤에는 칭찬(emotion "칭찬"). 나머지는 "설명".

학생이 이해하기 쉬운 설명 기준:
${EASY_EXPLANATION_RULES}

언어 분리 (가장 중요):
- 한국어 세그먼트("lang":"ko")에는 영어 알파벳을 쓰지 않는다. 예외는 발음 사전에 있는 문법 용어뿐: ${terms}
- 영어 예문·영어 단어는 반드시 별도 영어 세그먼트("lang":"en")로 쓴다. 원어민 보이스가 읽는다.
- 영어 세그먼트 앞뒤의 한국어는 각각 끝맺은 문장(또는 "예를 들면,"처럼 끝맺은 구)으로 쓴다.
  영어 바로 뒤 한국어는 절대 조사(은·는·이·가·을·를·와·과·의·에·로·도·만)로 시작하지 않는다. "이", "여기서", "이 문장은", "이 부분이" 같은 말로 시작한다.
  좋은 예: {"lang":"ko","text":"이 문장을 들어 볼까요?"}, {"lang":"en","text":"She has visited Jeju twice.","reveal":1}, {"lang":"ko","text":"여기서 동사 자리에 has와 과거분사가 함께 왔죠?"} ← (X: 한국어에 has를 쓰면 안 됨)
  고친 예: {"lang":"ko","text":"여기서 동사 부분을 다시 들어 볼게요."}, {"lang":"en","text":"has visited"}, {"lang":"ko","text":"이렇게 해브 동사와 과거분사가 함께 와요."}
- 영어 단어를 한국어 문장 안에서 꼭 불러야 하면 한글로 소리 나는 대로 쓴다 (예: 해브, 해즈, 이버, 저스트). 단어 하나를 강조할 때만 영어 세그먼트로 따로 읽는다.
- 같은 영어 문장을 연달아 두 번 읽지 않는다.
- 숫자는 아라비아 숫자로 써도 된다 (자동으로 읽는 법을 바꾼다).

퀴즈 규칙:
- 카운트다운(waitSec) 전에는 정답을 말하지도, 정답 단어를 읽지도 않는다. 보기를 읽을 때는 모든 보기를 같은 방식으로 읽는다.
- 빈칸 문장은 영어 세그먼트로 읽고 빈칸 자리는 ___ 로 쓴다 (자동으로 "blank"로 읽힌다).

${REVEAL_RULES}

설명은 슬라이드 화면 내용과 [관리자 원고·개념 정리]를 벗어나지 않는다.
출력: { "segments": [ { "slideId": "s3", "lang": "ko"|"en", "text": "…", "emotion": "설명"|"강조"|"질문"|"칭찬", "reveal"?: 숫자, "waitSec"?: 5, "joinNext"?: true }, … ] }  // 슬라이드 순서대로`
}

interface RawSlide { id: string; type: SlideType }

async function requestNarration(
  system: string,
  outline: { title: string; slides: unknown[] },
  batch: RawSlide[],
  budgets: Map<string, number>,
  scope: GrammarScope | null,
  feedback?: string[],
): Promise<unknown[]> {
  const user = `${scopeText(scope)}

[강의 전체 슬라이드]
${JSON.stringify(outline)}

이번에 쓸 슬라이드: ${batch.map((s) => `${s.id}(${s.type}, 한국어 약 ${budgets.get(s.id)}자)`).join(', ')}
글자 수는 한국어 세그먼트 글자 합의 목표치예요(±20%). 영어 세그먼트는 따로 셉니다.
${batch.some((s) => s.id === (outline.slides[0] as RawSlide)?.id) ? '첫 슬라이드는 "안녕하세요, 위고업잉글리시예요."처럼 인사로 시작해요.' : '인사는 하지 않아요 (이미 앞에서 함).'}
${feedback?.length ? `\n지난 응답에서 고칠 점:\n${feedback.map((f) => `- ${f}`).join('\n')}` : ''}`
  const res = await requestJson([{ role: 'system', content: system }, { role: 'user', content: user }], 6000, { model: SCRIPT_MODEL, temperature: 0.6 })
  if (!res.ok) throw new Error(res.error)
  const json = res.json as { segments?: unknown }
  if (!Array.isArray(json.segments)) throw new Error('AI 응답에 segments가 없어요')
  const ids = new Set(batch.map((s) => s.id))
  return json.segments.filter((g) => !!g && typeof g === 'object' && ids.has(String((g as { slideId?: unknown }).slideId)))
}

export interface GenerateOptions {
  title: string
  minutes: number
  scope: GrammarScope | null
  dict: PronunciationDict
  log: (m: string) => void
}

/** 강의 타이틀 → 검증된 대본 (+ 검토 메모) */
export async function generateLectureScript(o: GenerateOptions): Promise<{ script: LectureScript; notes: string[] }> {
  o.log('  1/2 슬라이드 구성 만드는 중…')
  const outlineRes = await requestJson(
    [
      { role: 'system', content: outlineSystemPrompt() },
      { role: 'user', content: `강의 타이틀: ${o.title}\n\n${structureGuide(o.minutes)}\n\n${scopeText(o.scope)}` },
    ],
    7000,
    { model: SCRIPT_MODEL, temperature: 0.5 },
  )
  if (!outlineRes.ok) throw new Error(outlineRes.error)
  const outline = outlineRes.json as { slug?: string; title?: string; slides?: unknown[] }
  const slides = (Array.isArray(outline.slides) ? outline.slides : []).filter(
    (s): s is RawSlide & { data: unknown } => !!s && typeof s === 'object' && SLIDE_TYPES.includes((s as RawSlide).type),
  )
  slides.forEach((s, i) => (s.id = `s${i + 1}`))
  if (slides.length < 3) throw new Error('AI가 슬라이드를 충분히 만들지 못했어요. 다시 실행해 주세요.')
  const compact = { title: outline.title ?? o.title, slides }

  // 한국어 글자 목표 — 1분에 약 300자 (쉼·영어·대기 포함한 말하기 속도 기준)
  const totalChars = Math.round(o.minutes * 300)
  const weightSum = slides.reduce((a, s) => a + SLIDE_WEIGHT[s.type], 0)
  const budgets = new Map(slides.map((s) => [s.id, Math.max(25, Math.round((totalChars * SLIDE_WEIGHT[s.type]) / weightSum))]))

  o.log(`  2/2 나레이션 쓰는 중… (슬라이드 ${slides.length}장)`)
  const system = narrationSystemPrompt(o.dict)
  const batchSize = 4
  const batches: RawSlide[][] = []
  for (let i = 0; i < slides.length; i += batchSize) batches.push(slides.slice(i, i + batchSize))
  const results = await mapLimit(batches, 3, (b) => requestNarration(system, compact, b, budgets, o.scope))

  const assemble = (parts: unknown[][]) => {
    const counter = new Map<string, number>()
    const quizIds = new Set(slides.filter((s) => s.type === 'quiz').map((s) => s.id))
    const segments = repairQuizzes(parts.flat() as Record<string, unknown>[], quizIds).map((g) => {
      const seg = g as Record<string, unknown>
      const sid = String(seg.slideId)
      const n = (counter.get(sid) ?? 0) + 1
      counter.set(sid, n)
      return { ...seg, id: `${sid}-${n}` }
    })
    return {
      version: 1,
      slug: sanitizeSlug(outline.slug ?? '') || 'lecture',
      title: (outline.title ?? o.title).trim() || o.title,
      grammarPoint: o.scope ? { code: o.scope.code, title: o.scope.title } : null,
      targetMinutes: o.minutes,
      createdAt: new Date().toISOString(),
      slides,
      segments,
    }
  }

  const allErrors = () => {
    const raw = assemble(results)
    const parsed = parseLectureScript(raw)
    const narration = checkNarration(raw.segments as Record<string, unknown>[], raw.slides as unknown as RawQuizSlide[], o.dict)
    return { parsed, narration, errors: [...parsed.issues.filter((i) => i.level === 'error'), ...narration] }
  }
  let state = allErrors()
  // 문제가 난 슬라이드 묶음만 고칠 점을 넣어 한 번 더
  if (state.errors.length) {
    const bad = batches.map((b, i) => ({ b, i, msgs: state.errors.filter((e) => b.some((s) => belongsTo(e.where, s.id))).map((e) => `[${e.where}] ${e.message}`) }))
    const retry = bad.filter((x) => x.msgs.length)
    o.log(`  고칠 점 ${state.errors.length}개 → 슬라이드 묶음 ${retry.length}개 다시 요청`)
    await mapLimit(retry, 3, async (x) => {
      results[x.i] = await requestNarration(system, compact, x.b, budgets, o.scope, x.msgs)
    })
    state = allErrors()
  }
  const parsed = state.parsed
  if (!parsed.script) throw new Error(`AI 대본에 고칠 곳이 남았어요. 다시 실행해 주세요.\n${formatIssues(parsed.issues.filter((i) => i.level === 'error')).slice(0, 8).join('\n')}`)

  // 다시 요청해도 남은 나레이션 문제는 검토 메모로 (자동 분리가 처리하지만 사람이 확인)
  const notes = [...formatIssues(state.narration.map((i) => ({ ...i, level: 'warn' as const }))), ...formatIssues(parsed.issues.filter((i) => i.level === 'warn'))]
  if (!o.scope) notes.unshift('문법학습관리에서 맞는 문법 포인트를 찾지 못해 일반 지식으로 만들었어요. 내용을 꼭 확인하세요. (--point 코드로 지정 가능)')
  else if (!o.scope.sourceText) notes.unshift(`${o.scope.code} ${o.scope.title}에 관리자 원고가 없어 개념 정리·교과서 기준으로 만들었어요. 설명을 꼭 확인하세요.`)
  return { script: parsed.script, notes }
}

const belongsTo = (where: string, slideId: string) => new RegExp(`\\b${slideId}(?![0-9])`).test(where)

const PARTICLE_START = /^(은|는|가|을|를|와|과|의|에|에서|로|으로|도|만|랑|이랑|라는|이라는|이라고|라고)(\s|$|[.,?!])/

interface RawQuizSlide { id: string; type: SlideType; data?: { choices?: unknown; answer?: unknown } }

/** 나레이션 검사 — 영어 뒤 조사, 한국어 속 영어, 퀴즈 정답 미리 말하기 */
export function checkNarration(segments: Record<string, unknown>[], slides: RawQuizSlide[], dict: PronunciationDict): ScriptIssue[] {
  const issues: ScriptIssue[] = []
  const known = Object.keys(dict.ko).filter((k) => /[A-Za-z]/.test(k))
  segments.forEach((g, i) => {
    const prev = segments[i - 1]
    const text = String(g.text ?? '')
    const where = `세그먼트 ${String(g.id)}`
    if (g.lang === 'ko' && prev?.lang === 'en' && prev.slideId === g.slideId && PARTICLE_START.test(text)) {
      issues.push({ level: 'error', where, message: `영어 바로 뒤 한국어가 조사로 시작해요 ("${text.slice(0, 10)}…"). 끝맺은 문장으로 다시 쓰세요` })
    }
    if (g.lang === 'ko') {
      let rest = text
      known.forEach((k) => (rest = rest.split(k).join(' ')))
      if (/[A-Za-z]{2,}/.test(rest)) issues.push({ level: 'error', where, message: `한국어 세그먼트에 영어가 섞였어요 ("${text.slice(0, 20)}…"). 영어는 en 세그먼트로, 꼭 필요하면 한글 발음으로` })
    }
  })
  for (const s of slides.filter((x) => x.type === 'quiz')) {
    const choices = Array.isArray(s.data?.choices) ? (s.data?.choices as unknown[]).map(String) : []
    const answer = choices[Number(s.data?.answer)]
    if (!answer) continue
    const own = segments.filter((g) => g.slideId === s.id)
    const waitAt = own.findIndex((g) => Number(g.waitSec) > 0)
    const before = waitAt >= 0 ? own.slice(0, waitAt) : []
    const readsAllChoices = choices.every((c) => before.some((g) => String(g.text).toLowerCase().includes(c.toLowerCase())))
    const leak = before.find((g) => new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(String(g.text)))
    if (leak && !readsAllChoices) issues.push({ level: 'error', where: `세그먼트 ${String(leak.id)}`, message: `퀴즈 정답("${answer}")을 카운트다운 전에 말했어요. 보기는 모두 읽거나 하나도 읽지 마세요` })
  }
  return issues
}

/**
 * 퀴즈 순서를 코드로 바로잡는다: 문제 → 5초 대기 → 정답 공개(reveal 1).
 * 대기가 없으면 정답 직전(정답 표시가 없으면 둘째 문장 뒤)에 넣고, 대기 앞의 reveal은 지운다.
 */
export function repairQuizzes(segments: Record<string, unknown>[], quizIds: Set<string>): Record<string, unknown>[] {
  const out = [...segments]
  quizIds.forEach((sid) => {
    const idxs = () => out.map((g, i) => (g.slideId === sid ? i : -1)).filter((i) => i >= 0)
    let own = idxs()
    if (own.length === 0) return
    if (!own.some((i) => Number(out[i].waitSec) > 0)) {
      const answer = own.find((i) => Number(out[i].reveal) >= 1)
      const at = answer !== undefined && answer > own[0] ? answer : own[Math.min(2, own.length - 1)] + 1
      out.splice(at, 0, { slideId: sid, lang: 'ko', text: '', waitSec: 5, emotion: '설명' })
      own = idxs()
    }
    const waitPos = own.findIndex((i) => Number(out[i].waitSec) > 0)
    own.slice(0, waitPos).forEach((i) => delete out[i].reveal)
    const after = own.slice(waitPos + 1)
    if (after.length && !after.some((i) => Number(out[i].reveal) >= 1)) out[after[0]].reveal = 1
  })
  return out
}

export function sanitizeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

// ── YouTube 제목·설명·태그 ────────────────────────────────

export interface YoutubeMeta {
  titles: string[]
  description: string
  tags: string[]
}

export async function generateYoutubeMeta(script: LectureScript): Promise<YoutubeMeta> {
  const fallback: YoutubeMeta = {
    titles: [`${script.title} 한 번에 끝내기 | 위고업잉글리시 영문법`, `${script.title}, 이것만 알면 돼요 | 중학 영문법`, `[영문법] ${script.title} 쉽게 정리`],
    description: `${script.title}, 쉽고 정확하게 정리한 위고업잉글리시 영문법 강의예요.`,
    tags: ['영문법', '중학영어', '위고업잉글리시', 'WeGoUp English', script.title],
  }
  const content = script.slides
    .map((s) => JSON.stringify(s.data))
    .join('\n')
    .slice(0, 6000)
  const res = await requestJson(
    [
      {
        role: 'system',
        content: `너는 한국 중학생 대상 영어문법 YouTube 채널 "위고업잉글리시(WeGoUp English)"의 운영자야. 과장·낚시 없이 검색에 잘 걸리는 메타데이터를 JSON으로 만든다.
출력 JSON: { "titles": [제목 후보 정확히 3개, 각 60자 이내, 강의 주제어 포함], "description": 설명란 첫 단락(2~4문장, 무엇을 배우는지), "tags": [태그 정확히 15개, 한국어·영어 섞어서, # 없이] }`,
      },
      { role: 'user', content: `강의 제목: ${script.title}\n문법 단원: ${script.grammarPoint?.title ?? "-"} (내부 코드는 제목·태그에 쓰지 않는다)\n화면 내용:\n${content}` },
    ],
    1500,
    { model: SCRIPT_MODEL, temperature: 0.7 },
  )
  if (!res.ok) return fallback
  const j = res.json as Partial<YoutubeMeta>
  const titles = Array.isArray(j.titles) ? j.titles.filter((t): t is string => typeof t === 'string').slice(0, 3) : []
  const tags = Array.isArray(j.tags) ? Array.from(new Set(j.tags.filter((t): t is string => typeof t === "string").map((t) => t.replace(/^#/, "").trim()))).slice(0, 15) : []
  return {
    titles: titles.length === 3 ? titles : fallback.titles,
    description: typeof j.description === 'string' && j.description.trim() ? j.description.trim() : fallback.description,
    tags: tags.length >= 10 ? tags : Array.from(new Set([...tags, ...fallback.tags])).slice(0, 15),
  }
}

export function buildYoutubeMd(script: LectureScript, meta: YoutubeMeta, chapters: Chapter[], durationMs: number): string {
  return [
    `# YouTube 업로드 정보 — ${script.title}`,
    '',
    `영상 길이 ${formatClock(durationMs)} · 파일 \`output.mp4\` · 썸네일 \`thumbnail.png\` · 자막 \`subtitles.srt\``,
    '',
    '## 제목 후보',
    '',
    ...meta.titles.map((t, i) => `${i + 1}. ${t}`),
    '',
    '## 설명란 (그대로 복사해서 붙여넣기)',
    '',
    '```',
    meta.description,
    '',
    '📚 목차',
    ...chapters.map((c) => `${formatClock(c.startMs)} ${c.title}`),
    '',
    '위고업잉글리시(WeGoUp English) — 중학 영문법을 쉽고 정확하게',
    meta.tags.slice(0, 3).map((t) => `#${t.replace(/\s+/g, '')}`).join(' '),
    '```',
    '',
    '## 태그 (15개, 쉼표로 구분 — YouTube 태그 칸에 붙여넣기)',
    '',
    '```',
    meta.tags.join(', '),
    '```',
    '',
    '## 업로드 후 문법학습관리에 등록',
    '',
    '1. YouTube에 올린 뒤 영상 주소를 복사해요.',
    `2. 관리자 화면 \`/admin/grammar\`에서 ${script.grammarPoint ? `**${script.grammarPoint.code} ${script.grammarPoint.title}**` : '해당'} ${script.grammarPoint && script.grammarPoint.code.split('-').length === 2 ? '단원의 강의를 붙일 포인트' : '포인트'}를 열어요.`,
    '3. "강의" 탭 → "강의 등록"을 누르고 제목·YouTube 주소를 넣어 저장해요.',
    '',
  ].join('\n')
}
