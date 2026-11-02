// 숏폼·카드뉴스 문구 AI — 본 강의 대본(script.json)만 근거로 쓴다 (원고와 다른 설명 금지는 본 강의 단계에서 이미 지킴)
// 숏폼: 패턴 1개 → ShortsDraft (+ 유튜브 제목·설명·해시태그)
// 카드뉴스: 강의 전체 → 카드 8~10장 + 인스타그램 캡션 + 쓰레드 글

import { requestJson } from '@/lib/openai/grammar-point-draft'
import { AI_CONTENT_MODEL } from '@/lib/openai/models'
import { buildShortsScript, SHORTS_LENGTH, type ShortsDraft } from '../../src/lib/lecture-pipeline/shorts'
import type { PatternGroup } from '../../src/lib/lecture-pipeline/patterns'
import { layoutTimeline } from '../../src/lib/lecture-pipeline/timing'
import { parseLectureScript, WEBSITE, type LectureScript, type PatternExample, type RepeatData } from '../../src/lib/lecture-pipeline/types'
import {
  charCount, cleanHashtags, INSTAGRAM_LIMIT, parseCardNews, THREADS_LIMIT, type CardIssue, type CardNews,
} from '../../src/lib/lecture-pipeline/cardnews'

const MODEL = process.env.LECTURE_SCRIPT_MODEL?.trim() || AI_CONTENT_MODEL

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// ── 숏폼 ──────────────────────────────────────────────────

export interface ShortsYoutube {
  titles: string[]
  description: string
  hashtags: string[]
}

const SHORTS_SYSTEM = `너는 "위고업잉글리시(WeGoUp English)" 유튜브 숏폼 작가야. 한국 중학생·성인 초보가 45~60초 안에 영어 회화 패턴 하나를 익히게 한다.

말투: 짧고 리듬감 있게. "~해요"체, 한 문장 25자 안팎. 군더더기·인사 없음. 반말 금지.
한국어 문장에는 영어 알파벳을 쓰지 않는다 (영어는 화면과 원어민이 담당). 영어 단어를 꼭 말해야 하면 한글 발음으로 (예: 해브 유 에버).
문법 정확성 최우선. 예문은 짧고 자연스러운 일상 영어, 패턴을 그대로 쓴다.

출력 JSON:
{
  "hook": 첫 2초 훅 질문 (패턴 의미를 따옴표로 넣고 "영어로 바로 말할 수 있나요?"류, 30자 이내. 예: "'곧 ~하려던 참이야' 영어로 바로 말할 수 있나요?"),
  "hookSub": 훅 아래 짧은 한 마디 (12자 이내, 선택. 예: "3초 안에 떠올려 보세요"),
  "patternIntro": 패턴 소개 한 문장 (원어민이 패턴을 읽기 직전),
  "patternMeaning": 패턴 의미·쓰는 상황 1~2문장 (원어민이 읽은 직후),
  "examplesLead": 예문 들어가기 전 한 마디 (예: "예문 세 개, 바로 갈게요!"),
  "examples": [{"en": 영어 예문(패턴 사용, 40자 이내), "ko": 자연스러운 해석(반말 구어체 OK)}] 정확히 3개,
  "repeat": {"sentence": 따라 말할 문장(40자 이내), "ko": 해석, "stress": [강세 단어 1~3개], "links": [{"text": 연음 구간, "hint": 한글 발음}] 0~2개},
  "repeatLead": 따라하기 안내 한 문장 (예: "이제 따라 해 보세요!"),
  "ctaLine": 마무리 1~2문장 (짧은 한마디 + 마지막 문장은 정확히 "더 자세한 설명은 위고업잉글리시에서!". 주소 글자는 읽지 않는다),
  "youtube": {"titles": [제목 후보 3개, 각 40자 이내, 끝에 #Shorts 없이], "description": 설명 2~3문장, "hashtags": [해시태그 5~8개, # 없이, 영어회화·패턴 관련]}
}
youtube 제목·설명은 화면 글이라 영어 패턴을 영어 그대로 쓴다 (예: "Have you ever ~?" — 한글 발음 표기 금지).`

function shortsUser(lecture: LectureScript, g: PatternGroup, reuseRepeat: RepeatData | null, feedback: string[]): string {
  const p = g.pattern.data
  return `본 강의 제목: ${lecture.title}
숏폼 번호: ${g.index}
패턴: ${p.pattern} (빈칸: ${p.slot ?? '~'}) — 의미: ${p.ko}${p.tip ? ` / ${p.tip}` : ''}
본 강의 예문: ${JSON.stringify(p.examples ?? [])}
본 강의 대화: ${JSON.stringify(g.dialogue?.data.lines ?? [])}
${reuseRepeat ? `따라하기 문장은 본 강의 것을 그대로 쓴다: ${JSON.stringify(reuseRepeat)}` : ''}

길이 목표: 음성 전체 약 52초 (45~60초). 한국어 문장 글자 수 합계 약 170~220자 (예문 해석 포함).
${feedback.length ? `\n지난 결과에서 고칠 점:\n${feedback.map((f) => `- ${f}`).join('\n')}` : ''}`
}

function cleanDraft(j: Record<string, unknown>, reuseRepeat: RepeatData | null): { draft: ShortsDraft; youtube: ShortsYoutube; errors: string[] } {
  const errors: string[] = []
  const examples: PatternExample[] = Array.isArray(j.examples)
    ? j.examples.flatMap((e): PatternExample[] => (isObj(e) && str(e.en) ? [{ en: str(e.en), ko: str(e.ko) }] : [])).slice(0, 3)
    : []
  if (examples.length !== 3) errors.push('examples는 정확히 3개여야 해요')
  examples.forEach((e, i) => /[가-힣]/.test(e.en) && errors.push(`예문 ${i + 1} 영어에 한글이 섞였어요`))
  const r = isObj(j.repeat) ? j.repeat : {}
  const repeat: RepeatData = reuseRepeat ?? {
    sentence: str(r.sentence),
    ko: str(r.ko),
    ...(Array.isArray(r.stress) ? { stress: r.stress.map(str).filter(Boolean).slice(0, 3) } : {}),
    ...(Array.isArray(r.links) ? { links: r.links.flatMap((l) => (isObj(l) && str(l.text) && str(l.hint) ? [{ text: str(l.text), hint: str(l.hint) }] : [])).slice(0, 2) } : {}),
  }
  if (!repeat.sentence) errors.push('repeat.sentence가 비어 있어요')
  const draft: ShortsDraft = {
    hook: str(j.hook), hookSub: str(j.hookSub) || undefined, patternIntro: str(j.patternIntro), patternMeaning: str(j.patternMeaning),
    examplesLead: str(j.examplesLead), examples, repeatLead: str(j.repeatLead), repeat, ctaLine: str(j.ctaLine),
  }
  for (const k of ['hook', 'patternIntro', 'patternMeaning', 'examplesLead', 'repeatLead', 'ctaLine'] as const) {
    if (!draft[k]) errors.push(`${k}가 비어 있어요`)
    else if (/[A-Za-z]{2,}/.test(draft[k].replace(/'[^']*'/g, ''))) errors.push(`${k}에 영어 알파벳이 있어요 (한글 발음으로): "${draft[k]}"`)
  }
  const y = isObj(j.youtube) ? j.youtube : {}
  const youtube: ShortsYoutube = {
    titles: Array.isArray(y.titles) ? y.titles.map(str).filter(Boolean).slice(0, 3) : [],
    description: str(y.description),
    hashtags: Array.isArray(y.hashtags) ? y.hashtags.map(str).filter(Boolean) : [],
  }
  return { draft, youtube, errors }
}

/** 패턴 1개 → 숏폼 대본 (길이 45~60초 어림이 맞을 때까지 한 번 더 요청) */
export async function generateShorts(lecture: LectureScript, g: PatternGroup, log: (m: string) => void): Promise<{ script: LectureScript; youtube: ShortsYoutube; notes: string[] }> {
  const reuse = g.repeats[0]?.data ?? null
  let feedback: string[] = []
  let last: { script: LectureScript; youtube: ShortsYoutube; notes: string[] } | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await requestJson(
      [{ role: 'system', content: SHORTS_SYSTEM }, { role: 'user', content: shortsUser(lecture, g, reuse, feedback) }],
      2500,
      { model: MODEL, temperature: 0.7 },
    )
    if (!res.ok) throw new Error(res.error)
    const { draft, youtube, errors } = cleanDraft(isObj(res.json) ? res.json : {}, reuse)
    const parsed = parseLectureScript(buildShortsScript(lecture, g, draft))
    const parseErrors = parsed.issues.filter((i) => i.level === 'error').map((i) => `[${i.where}] ${i.message}`)
    const all = [...errors, ...parseErrors]
    if (parsed.script) {
      const sec = layoutTimeline(parsed.script).totalMs / 1000
      const notes = parsed.issues.filter((i) => i.level === 'warn').map((i) => `[${i.where}] ${i.message}`)
      last = { script: parsed.script, youtube, notes: [...errors, ...notes, `예상 길이 약 ${Math.round(sec)}초 (목표 ${SHORTS_LENGTH.minSec}~${SHORTS_LENGTH.maxSec}초, 실제 길이는 음성을 만든 뒤 확정)`] }
      if (sec < SHORTS_LENGTH.minSec + 2) all.push(`예상 길이가 ${Math.round(sec)}초로 짧아요. 한국어 문장을 약 ${Math.round((50 - sec) * 5.8)}자 늘려 주세요 (patternMeaning·ctaLine 위주)`)
      if (sec > SHORTS_LENGTH.maxSec - 3) all.push(`예상 길이가 ${Math.round(sec)}초로 길어요. 한국어 문장을 약 ${Math.round((sec - 54) * 5.8)}자 줄여 주세요`)
    }
    if (!all.length && last) return last
    log(`    고칠 점 ${all.length}개 → 다시 요청 (${attempt}/3)`)
    feedback = all
  }
  if (!last) throw new Error(`숏폼 ${g.index} 문구를 만들지 못했어요. 다시 실행해 주세요.\n${feedback.join('\n')}`)
  return { ...last, notes: [...feedback.map((f) => `자동 수정 못 함: ${f}`), ...last.notes] }
}

export function buildShortsYoutubeMd(script: LectureScript, y: ShortsYoutube, n: string, lectureTitle: string): string {
  const pattern = script.slides.find((s) => s.type === 'pattern')
  const fallbackTitle = `${pattern?.type === 'pattern' ? pattern.data.ko : lectureTitle} 영어로? | 위고업잉글리시`
  const titles = (y.titles.length ? y.titles : [fallbackTitle]).map((t) => `${t.replace(/#shorts/gi, '').trim()} #Shorts`)
  const tags = cleanHashtags(['Shorts', ...y.hashtags, '영어회화', '위고업잉글리시']).slice(0, 10)
  return [
    `# 유튜브 숏폼 업로드 정보 — ${n}`,
    '',
    `파일 \`${n}.mp4\` (1080×1920) · 본 강의: ${lectureTitle}`,
    '',
    '## 제목 후보',
    '',
    ...titles.map((t, i) => `${i + 1}. ${t}`),
    '',
    '## 설명란 (그대로 복사해서 붙여넣기)',
    '',
    '```',
    y.description || `${lectureTitle}에서 배운 회화 패턴을 1분 안에 익혀요.`,
    '',
    `▶ ${WEBSITE.cta} ${WEBSITE.url}`,
    '',
    tags.join(' '),
    '```',
    '',
    '## 업로드 팁',
    '',
    '- YouTube Studio에서 "관련 동영상"에 본 강의를 연결하면 숏폼에서 본 강의로 바로 넘어갈 수 있어요.',
    '- 세로(9:16) 짧은 영상이라 자동으로 Shorts로 올라가요.',
    '',
  ].join('\n')
}

// ── 카드뉴스 ──────────────────────────────────────────────

const CARD_SYSTEM = `너는 "위고업잉글리시(WeGoUp English)" 인스타그램·쓰레드 카드뉴스 에디터야. 본 강의 내용만으로 저장하고 싶은 카드뉴스를 만든다.
문법 정확성 최우선. 강의에 없는 규칙을 지어내지 않는다. 화면 글은 짧게 — 한 장 최대 5줄, 줄마다 한 가지.

카드 구성 (순서 그대로, 9~10장):
1. {"type":"cover","topic": 강의 주제(12자 이내),"hook": 훅 문구(28자 이내, 궁금하게),"label": 작은 꼬리표(예 "중학 영문법")}
2. {"type":"question","prompt":"이거 맞을까요?","sentence": 한국 학생이 자주 쓰는 틀린 영어 문장(28자 이내),"hint": 생각해 볼 한 줄(26자 이내, 선택)}
3~5. {"type":"rule","heading": 제목(14자 이내),"formula": [공식 블록 2~4개, 각 10자 이내](선택),"lines": [설명, 각 22자 이내, 핵심어는 **굵게**],"example": {"en": 예문(30자 이내),"ko": 해석}} — 정확히 3장
   줄 수 = 제목 1 + formula 1 + lines 수 + example 2 → 5줄 이내. 그래서 formula가 있으면 lines는 1줄, 없으면 2줄.
6. {"type":"mistakes","heading":"흔한 실수 TOP 3","items": [{"wrong": 틀린 부분(14자 이내, 짧은 구),"right": 고친 부분(14자 이내)}] 정확히 3개}
7. {"type":"quiz","question": 한국어 질문(22자 이내, 예 "빈칸에 알맞은 말은?" — 영어 문장을 그대로 쓰지 않는다),"sentence": 빈칸(___) 문장(30자 이내),"choices": [보기 2~4개, 각 12자 이내]}
8. {"type":"answer","answer": 정답(보기 그대로),"sentence": 정답을 넣은 문장,"explanation": 해설(44자 이내)}
9. {"type":"pattern","pattern": 강의의 일상회화 패턴(빈칸 ~),"slot": 빈칸 이름,"ko": 의미,"example": {"en","ko"}}  — 강의에 패턴이 없으면 이 카드는 뺀다
10. {"type":"cta","lectureTitle": 본 강의 제목,"message":"저장하고 복습하세요"}

캡션:
- "instagram": {"body": 본문(1,000~1,800자. 첫 줄은 훅, 빈 줄로 단락 구분, 카드 핵심 요약 + 예문 + 저장·팔로우 유도 + 마무리 줄은 "더 자세한 설명은 위고업잉글리시에서! 👉 wegoupenglish.com"),"hashtags": [해시태그 22~25개, # 없이, 한국어·영어 섞어서]}
- "threads": {"body": 대화체 짧은 글(200~380자, 친구에게 말하듯 "~죠?" "~더라고요", 마지막 질문 바로 앞 줄에 "더 자세한 설명은 위고업잉글리시에서! wegoupenglish.com" 한 줄, 마지막 문장은 반드시 질문으로 끝내 댓글 유도),"hashtags": [3~5개, # 없이]}

출력 JSON: { "cards": [...], "instagram": {...}, "threads": {...} }`

export interface SocialCaptions {
  instagram: { body: string; hashtags: string[] }
  threads: { body: string; hashtags: string[] }
}

const FALLBACK_TAGS = ['영어공부', '영문법', '중학영어', '영어회화', '영어표현', '영어패턴', '기초영어', '영어독학', '영어단어', '중등영어', '고등영어', '영어문법', '영어스터디', '공부스타그램', '영어카드뉴스', '위고업잉글리시', 'WeGoUpEnglish', 'englishgrammar', 'englishstudy', 'learnenglish', 'dailyenglish', 'englishpattern', 'ESL', '카드뉴스', '저장필수']

function lectureContent(lecture: LectureScript): string {
  return JSON.stringify(lecture.slides.map((s) => ({ type: s.type, data: s.data }))).slice(0, 9000)
}

function cleanCaptions(j: Record<string, unknown>): { captions: SocialCaptions; errors: string[] } {
  const errors: string[] = []
  const ig = isObj(j.instagram) ? j.instagram : {}
  const th = isObj(j.threads) ? j.threads : {}
  const igTags = cleanHashtags([...(Array.isArray(ig.hashtags) ? ig.hashtags.map(str) : []), ...FALLBACK_TAGS]).slice(0, INSTAGRAM_LIMIT.maxTags)
  const igBody = str(ig.body)
  if (!igBody) errors.push('instagram.body가 비어 있어요')
  if (charCount(igBody) > INSTAGRAM_LIMIT.bodyChars) errors.push(`인스타그램 본문이 ${charCount(igBody)}자예요 (${INSTAGRAM_LIMIT.bodyChars}자 이내)`)
  const thTags = cleanHashtags(Array.isArray(th.hashtags) ? th.hashtags.map(str) : []).slice(0, THREADS_LIMIT.maxTags)
  while (thTags.length < THREADS_LIMIT.minTags) thTags.push(cleanHashtags([FALLBACK_TAGS[thTags.length]])[0])
  // 마지막 문장이 질문이 아니면, 마지막 질문 뒤에 붙은 말("댓글로 알려 주세요!" 등)을 잘라 질문으로 끝낸다
  let thBody = str(th.body)
  const lastQ = Math.max(thBody.lastIndexOf('?'), thBody.lastIndexOf('？'))
  if (lastQ > thBody.length * 0.5 && !/[?？]\s*$/.test(thBody.replace(/[^0-9A-Za-z가-힣?？]+$/, ''))) thBody = thBody.slice(0, lastQ + 1).trim()
  const total = charCount(thBody) + 2 + charCount(thTags.join(' '))
  if (!thBody) errors.push('threads.body가 비어 있어요')
  if (total > THREADS_LIMIT.totalChars) errors.push(`쓰레드 글이 해시태그 포함 ${total}자예요 (${THREADS_LIMIT.totalChars}자 이내)`)
  if (thBody && !/[?？]\s*$/.test(thBody.replace(/[^0-9A-Za-z가-힣?？]+$/, ''))) errors.push('쓰레드 글 마지막 문장을 질문(?)으로 끝내 주세요')
  return { captions: { instagram: { body: igBody, hashtags: igTags }, threads: { body: thBody, hashtags: thTags } }, errors }
}

export async function generateCardNews(lecture: LectureScript, log: (m: string) => void): Promise<{ cardnews: CardNews; captions: SocialCaptions; notes: string[] }> {
  let feedback: string[] = []
  let best: { cardnews: CardNews; captions: SocialCaptions; notes: string[] } | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await requestJson(
      [
        { role: 'system', content: CARD_SYSTEM },
        {
          role: 'user',
          content: `본 강의 제목: ${lecture.title}\n강의 화면 내용(JSON):\n${lectureContent(lecture)}${feedback.length ? `\n\n지난 결과에서 고칠 점:\n${feedback.map((f) => `- ${f}`).join('\n')}` : ''}`,
        },
      ],
      6000,
      { model: MODEL, temperature: 0.6 },
    )
    if (!res.ok) throw new Error(res.error)
    const j = isObj(res.json) ? res.json : {}
    const { cardnews, issues } = parseCardNews({ slug: lecture.slug, title: lecture.title, cards: j.cards })
    const { captions, errors } = cleanCaptions(j)
    const fmt = (i: CardIssue) => `[${i.where}] ${i.message}`
    const problems = [...issues.filter((i) => i.level === 'error').map(fmt), ...errors, ...issues.filter((i) => i.level === 'warn').map(fmt)]
    if (cardnews) {
      const warns = issues.filter((i) => i.level === 'warn').map(fmt)
      best = { cardnews, captions, notes: [...errors, ...warns] }
      if (!errors.length && !warns.length) return best
    }
    log(`    고칠 점 ${problems.length}개 → 다시 요청 (${attempt}/3)`)
    feedback = problems
  }
  if (!best) throw new Error(`카드뉴스 문구를 만들지 못했어요. 다시 실행해 주세요.\n${feedback.slice(0, 8).join('\n')}`)
  return best
}

export function buildInstagramMd(title: string, c: SocialCaptions['instagram']): string {
  return [
    `# 인스타그램 캡션 — ${title}`,
    '',
    `본문 ${charCount(c.body)}자 (${INSTAGRAM_LIMIT.bodyChars}자 이내) · 해시태그 ${c.hashtags.length}개 · 이미지 \`card-01.png\` ~`,
    '',
    '```',
    c.body,
    '',
    c.hashtags.join(' '),
    '```',
    '',
  ].join('\n')
}

export function buildThreadsMd(title: string, c: SocialCaptions['threads']): string {
  const text = `${c.body}\n\n${c.hashtags.join(' ')}`
  return [
    `# 쓰레드 글 — ${title}`,
    '',
    `${charCount(text)}자 (해시태그 포함, ${THREADS_LIMIT.totalChars}자 이내) · 해시태그 ${c.hashtags.length}개 · 이미지는 카드뉴스와 같이 올려요`,
    '',
    '```',
    text,
    '```',
    '',
  ].join('\n')
}
