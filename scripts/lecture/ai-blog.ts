// 네이버 블로그 SEO 글 AI — 본 강의 대본(script.json)만 근거로 블로그용으로 새로 쓴다
// 1) 키워드: 메인 1 + 서브 3~5 (후보·선정 이유)  2) 원고: blog-post.md 형식 + 제목·태그
// 유튜브 설명·카드뉴스 캡션 문장은 그대로 쓰지 않는다 (네이버 유사 문서 방지 — findCopiedSentences로 검사)

import { requestJson } from '@/lib/openai/grammar-point-draft'
import { AI_CONTENT_MODEL } from '@/lib/openai/models'
import type { LectureScript } from '../../src/lib/lecture-pipeline/types'
import { WEBSITE } from '../../src/lib/lecture-pipeline/types'
import {
  BLOG_LIMIT, blogPlainText, checkBlogPost, cleanTags, findCopiedSentences, parseBlogPost,
  type BlogKeywords, type KeywordCandidate,
} from '../../src/lib/lecture-pipeline/blog'

const MODEL = process.env.LECTURE_SCRIPT_MODEL?.trim() || AI_CONTENT_MODEL

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function lectureContent(lecture: LectureScript): string {
  const slides = JSON.stringify(lecture.slides.map((s) => ({ id: s.id, type: s.type, chapter: s.chapter, data: s.data })))
  const narration = lecture.segments.map((s) => s.text).join(' ')
  return `화면(JSON): ${slides.slice(0, 9000)}\n\n선생님 설명(음성 대본): ${narration.slice(0, 5000)}`
}

// ── 키워드 ────────────────────────────────────────────────

const KEYWORD_SYSTEM = `너는 네이버 블로그 SEO 담당자야. 한국 중학생·학부모·성인 초보가 네이버에서 영어 문법을 검색할 때 쓰는 말을 잘 안다.
본 강의 주제로 블로그 키워드를 고른다.
- 메인 키워드 1개: 검색량이 꾸준하고 강의 주제와 정확히 맞는 2~3단어 (예: "현재완료 시제")
- 서브 키워드 3~5개: 메인과 함께 검색되는 롱테일 (예: "현재완료 예문", "현재완료 과거시제 차이", "중학 영문법")
- 후보는 메인 2~3개, 서브 8~10개를 제안하고 각각 이유를 한 줄로 (검색 의도·경쟁 정도·강의 내용과의 연결)
- 강의에서 실제로 다루지 않는 내용의 키워드는 고르지 않는다

출력 JSON:
{ "candidates": [{"keyword": 문자열, "kind": "main"|"sub", "reason": 문자열}],
  "main": 선정한 메인, "subs": [선정한 서브 3~5개],
  "mainReason": 메인 선정 이유 1~2문장, "subsReason": 서브 선정 이유 1~2문장 }`

export async function generateBlogKeywords(lecture: LectureScript): Promise<{ picked: BlogKeywords; candidates: KeywordCandidate[]; reasons: { main: string; subs: string } }> {
  const res = await requestJson(
    [
      { role: 'system', content: KEYWORD_SYSTEM },
      { role: 'user', content: `본 강의 제목: ${lecture.title}${lecture.grammarPoint ? ` (문법 포인트 ${lecture.grammarPoint.code} ${lecture.grammarPoint.title})` : ''}\n${lectureContent(lecture)}` },
    ],
    2000,
    { model: MODEL, temperature: 0.4 },
  )
  if (!res.ok) throw new Error(res.error)
  const j = isObj(res.json) ? res.json : {}
  const candidates: KeywordCandidate[] = Array.isArray(j.candidates)
    ? j.candidates.flatMap((c): KeywordCandidate[] => (isObj(c) && str(c.keyword) ? [{ keyword: str(c.keyword), kind: c.kind === 'main' ? 'main' : 'sub', reason: str(c.reason) }] : []))
    : []
  const main = str(j.main) || lecture.title
  const subs = (Array.isArray(j.subs) ? j.subs.map(str).filter(Boolean) : []).filter((s) => s !== main).slice(0, BLOG_LIMIT.subKeywordsMax)
  if (subs.length < BLOG_LIMIT.subKeywordsMin) throw new Error('서브 키워드를 3개 이상 고르지 못했어요. 다시 실행해 주세요.')
  return { picked: { main, subs }, candidates, reasons: { main: str(j.mainReason), subs: str(j.subsReason) } }
}

// ── 원고 ──────────────────────────────────────────────────

export interface BlogImageOption { file: string; about: string }

const POST_SYSTEM = `너는 "위고업잉글리시(WeGoUp English)" 네이버 블로그를 쓰는 친근한 영어 선생님이야. 독자는 한국 중학생과 학부모, 영어 기초를 다시 잡는 성인.
본 강의 내용만 근거로 쓴다. 강의에 없는 규칙을 지어내지 않는다. 문법 정확성 최우선.

말투: "~해요"체. 친근하지만 반말 금지. 한 문단은 2~3줄(80~160자)로 짧게 끊고, 문단 사이는 빈 줄.
과장 금지("무조건", "100%", "완벽", "한 번에 끝" 같은 말 쓰지 않기). 이모지는 쓰지 않거나 아주 가끔만.
마크다운 굵게(**)·기울임·표·목록 기호는 쓰지 않는다 (네이버 에디터에 그대로 입력된다). 예문은 문단 안에 "I have finished my homework. (나는 숙제를 다 끝냈어요.)"처럼 쓴다.

blog-post.md 형식 (이 형식만 쓴다):
# 제목
도입 문단들
## 소제목
본문 문단들
[IMG: 파일이름 | 이미지 설명 한 줄]
[YOUTUBE: 본편 링크 | 영상 소개 한 줄]

구성 (순서 그대로):
1. 도입: 독자가 겪는 고민으로 시작. 메인 키워드를 첫 문단에 자연스럽게 넣는다. 소제목 없이 2~3문단.
2. 소제목은 정확히 6개(## 줄 6개, 더 만들지 않는다). 소제목에 서브 키워드를 자연스럽게 넣는다 (모든 소제목에 억지로 넣지 않기).
3. 소제목 6개의 내용 (순서 그대로):
   ① 핵심 개념 (언제 쓰는지)
   ② 공식 (만드는 법)
   ③ 예문 (+ 비슷한 시제와의 차이가 강의에 있으면 여기서)
   ④ 흔한 실수
   ⑤ 일상회화 패턴 (강의의 패턴·대화를 짧게) — 강의에 패턴이 없으면 예문 더 보기
   ⑥ 퀴즈와 정리 (문제를 내고, 다음 문단에 정답과 이유 → 마무리)
4. 유튜브 본편 위치 표시 [YOUTUBE: 본편 링크 | …]는 정확히 1번, 글 중간(공식이나 예문 설명 뒤)에 넣는다.
5. 마무리(마지막 소제목 아래): 핵심 요약 2~3문장 → 댓글을 부르는 질문 1문장 → 마지막 줄은 위고업잉글리시 소개 한 줄 (예: "${WEBSITE.cta} ${WEBSITE.host}에서 레벨 테스트와 문법 강의를 만나 보세요.").

분량: 본문(제목·이미지 표시 제외, 이미지 설명 포함) ${BLOG_LIMIT.bodyMin}~${BLOG_LIMIT.bodyMax}자, 목표 2,600자 안팎 (2,000자보다 짧으면 안 된다).
키워드: 메인 키워드는 제목 포함 전체 ${BLOG_LIMIT.mainKeywordMin}~${BLOG_LIMIT.mainKeywordMax}번(목표 6번)만 쓴다. 서브 키워드는 각각 1~3번. 같은 말을 억지로 반복하지 않는다.
제목: 메인 키워드를 맨 앞에, 30자 안팎(${BLOG_LIMIT.titleMin}~${BLOG_LIMIT.titleMax}자), 궁금증을 부르되 과장 없이.
이미지: 목록이 많아도 정확히 8장만 고른다(한 소제목에 1~2장, [IMG] 두 줄을 바로 붙여 쓰지 말고 사이에 문단을 둔다). 카드뉴스와 슬라이드 캡처를 섞고, 같은 내용을 보여 주는 이미지는 하나만. 글 흐름에 맞는 자리에 넣고, 각 이미지에 그 이미지가 보여 주는 내용을 설명하는 한 줄을 단다. 같은 이미지를 두 번 쓰지 않는다.
태그: ${BLOG_LIMIT.tagsMin}~${BLOG_LIMIT.tagsMax}개(목표 15개). 메인·서브 키워드, 학년/대상(중학영어, 중1영어 등), 브랜드(위고업잉글리시). # 없이, 띄어쓰기 없이.

출력 JSON: { "title": 제목, "markdown": blog-post.md 전체(첫 줄 # 제목 포함), "tags": [태그] }`

function postUser(lecture: LectureScript, kw: BlogKeywords, images: BlogImageOption[], avoid: string[], feedback: string[]): string {
  return `본 강의 제목: ${lecture.title}
메인 키워드: ${kw.main}
서브 키워드: ${kw.subs.join(', ')}

쓸 수 있는 이미지 (파일이름 — 내용):
${images.map((i) => `- ${i.file} — ${i.about}`).join('\n')}

${lectureContent(lecture)}
${avoid.length ? `\n아래는 이미 다른 곳(유튜브 설명·인스타그램·쓰레드)에 올린 글이에요. 이 문장들을 그대로 쓰거나 살짝만 바꿔 쓰지 말고, 블로그용으로 완전히 새로 써요:\n${avoid.join('\n---\n').slice(0, 4000)}` : ''}
${feedback.length ? `\n지난 원고에서 고칠 점 (모두 고쳐서 전체를 다시 써 주세요):\n${feedback.map((f) => `- ${f}`).join('\n')}` : ''}`
}

/** 이미지가 max장을 넘으면 같은 이미지 반복·연속 배치부터 빼고, 그래도 많으면 고르게 남긴다 */
function trimImages(md: string, max: number): string {
  const lines = md.split('\n')
  const isImg = (l: string) => /^\[IMG:/i.test(l.trim())
  const seen = new Set<string>()
  const drop = new Set<number>()
  lines.forEach((l, i) => {
    if (!isImg(l)) return
    const file = l.trim().slice(5).split('|')[0].trim()
    if (seen.has(file)) drop.add(i)
    seen.add(file)
  })
  let idx = lines.map((l, i) => (isImg(l) && !drop.has(i) ? i : -1)).filter((i) => i >= 0)
  // 연속 배치된 두 번째 이미지부터 뺀다
  for (let k = 1; k < idx.length && idx.length - drop.size > max; k++) {
    const between = lines.slice(idx[k - 1] + 1, idx[k]).some((l) => l.trim() && !isImg(l))
    if (!between) drop.add(idx[k])
  }
  idx = idx.filter((i) => !drop.has(i))
  if (idx.length > max) {
    const keep = new Set(Array.from({ length: max }, (_, k) => idx[Math.round((k * (idx.length - 1)) / (max - 1))]))
    idx.forEach((i) => !keep.has(i) && drop.add(i))
  }
  return lines.filter((_, i) => !drop.has(i)).join('\n')
}

/**
 * 메인 키워드가 max번을 넘으면 뒤쪽 본문 문단부터 짧은 말로 바꾼다 ("현재완료 시제" → "현재완료").
 * 제목·소제목·첫 문단은 그대로 둔다. 한 단어 키워드면 바꾸지 않는다 (검사에서 다시 요청).
 */
function limitKeyword(md: string, main: string, max: number): string {
  const words = main.trim().split(/\s+/)
  if (words.length < 2) return md
  const short = words.slice(0, -1).join(' ')
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), 'g')
  const lines = md.split('\n')
  const total = lines.reduce((n, l) => n + (l.match(re)?.length ?? 0), 0)
  let extra = total - max
  if (extra <= 0) return md
  const firstPara = lines.findIndex((l) => l.trim() && !/^#|^\[|^<!--/.test(l.trim()))
  for (let i = lines.length - 1; i > firstPara && extra > 0; i--) {
    if (/^#|^\[/.test(lines[i].trim())) continue
    const hits = lines[i].match(re)?.length ?? 0
    if (!hits) continue
    const keep = Math.max(0, hits - extra)
    extra -= hits - keep
    let seen = 0
    lines[i] = lines[i].replace(re, (m) => (seen++ < keep ? m : short))
  }
  return lines.join('\n')
}

export interface BlogDraft { title: string; markdown: string; tags: string[]; notes: string[] }

export async function generateBlogPost(
  lecture: LectureScript,
  kw: BlogKeywords,
  images: BlogImageOption[],
  avoid: string[],
  log: (m: string) => void,
): Promise<BlogDraft> {
  let feedback: string[] = []
  let best: { draft: BlogDraft; errors: number } | null = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await requestJson(
      [{ role: 'system', content: POST_SYSTEM }, { role: 'user', content: postUser(lecture, kw, images, avoid, feedback) }],
      9000,
      { model: MODEL, temperature: 0.7 },
    )
    if (!res.ok) throw new Error(res.error)
    const j = isObj(res.json) ? res.json : {}
    let markdown = str(j.markdown).replace(/\*\*/g, '')
    const title = str(j.title) || parseBlogPost(markdown).title
    if (!/^#\s+/.test(markdown)) markdown = `# ${title}\n\n${markdown}`
    markdown = trimImages(markdown, BLOG_LIMIT.imagesMax)
    markdown = limitKeyword(markdown, kw.main, BLOG_LIMIT.mainKeywordMax - 1)
    const tags = cleanTags([...(Array.isArray(j.tags) ? j.tags.map(str) : []), kw.main, ...kw.subs, '위고업잉글리시']).slice(0, BLOG_LIMIT.tagsMax)
    const issues = checkBlogPost(markdown, { keywords: kw, tags }, images.map((i) => i.file))
    const copied = findCopiedSentences(blogPlainText(parseBlogPost(markdown).blocks), avoid)
    const errors = [
      ...issues.filter((i) => i.level === 'error').map((i) => i.message),
      ...copied.map((s) => `다른 곳에 올린 문장과 같아요 → 새로 써 주세요: "${s.slice(0, 60)}"`),
    ]
    const warns = issues.filter((i) => i.level === 'warn').map((i) => i.message)
    const draft: BlogDraft = { title, markdown: markdown.trim() + '\n', tags, notes: [...errors.map((e) => `자동 수정 못 함: ${e}`), ...warns] }
    if (!best || errors.length < best.errors) best = { draft, errors: errors.length }
    if (!errors.length) return draft
    log(`    고칠 점 ${errors.length}개 → 다시 요청 (${attempt}/4)`)
    feedback = [...errors, ...warns]
  }
  if (!best) throw new Error('블로그 원고를 만들지 못했어요. 다시 실행해 주세요.')
  return best.draft
}
