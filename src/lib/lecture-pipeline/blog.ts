// 네이버 블로그 SEO 글 — 본 강의 대본(script.json)으로 새로 쓴 블로그 원고
// lectures/{slug}/blog/ : keywords.md · blog-post.md · blog-meta.json · publish-log.md · images/
// blog-post.md는 사람이 고칠 수 있는 형식이고, 등록(blog:publish)은 이 파일을 블록으로 나눠 순서대로 입력한다.
//   # 제목            (첫 줄, 등록 때 제목 칸에)
//   ## 소제목         (에디터 "소제목" 서식)
//   [IMG: card-03.png | 설명]
//   [YOUTUBE: https://youtu.be/... | 설명]   (주소가 아직 없으면 [YOUTUBE: 본편 링크 | 설명])
//   그 밖의 줄        본문 문단 (빈 줄로 문단 구분)

export const BLOG_LIMIT = {
  bodyMin: 2000,
  bodyMax: 3000,
  titleMin: 20,
  titleMax: 40,
  headingsMin: 4,
  headingsMax: 6,
  imagesMin: 6,
  imagesMax: 10,
  tagsMin: 10,
  tagsMax: 20,
  mainKeywordMin: 5,
  mainKeywordMax: 8,
  subKeywordsMin: 3,
  subKeywordsMax: 5,
} as const

export const BLOG_DEFAULT_CATEGORY = '중학 영문법'

export type BlogBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; file: string; caption: string }
  | { type: 'youtube'; url: string | null; caption: string }

export interface BlogKeywords {
  main: string
  subs: string[]
}

export interface BlogMeta {
  version: 1
  slug: string
  lectureTitle: string
  title: string
  keywords: BlogKeywords
  tags: string[]
  category: string
  /** 본문에 넣는 순서 그대로 (blog/images/ 안 파일 이름) */
  images: { file: string; caption: string }[]
  youtubeUrl: string | null
  createdAt: string
}

export interface BlogIssue { level: 'error' | 'warn'; message: string }

export const charCount = (s: string) => Array.from(s).length

const YOUTUBE_RE = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{6,}/

export function isYoutubeUrl(s: string | null | undefined): s is string {
  return !!s && YOUTUBE_RE.test(s.trim())
}

/** blog-post.md → 제목 + 블록 */
export function parseBlogPost(md: string): { title: string; blocks: BlogBlock[] } {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  const blocks: BlogBlock[] = []
  let para: string[] = []
  const flush = () => {
    const text = para.join('\n').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    para = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (/^<!--.*-->$/.test(t)) continue
    if (!title && /^#\s+/.test(t)) {
      title = t.replace(/^#\s+/, '').trim()
      continue
    }
    const h = t.match(/^##+\s+(.+)$/)
    const img = t.match(/^\[IMG:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*))?\]$/i)
    const yt = t.match(/^\[(?:YOUTUBE|VIDEO|동영상):\s*([^|\]]+?)\s*(?:\|\s*([^\]]*))?\]$/i)
    if (h) {
      flush()
      blocks.push({ type: 'heading', text: h[1].trim() })
    } else if (img) {
      flush()
      blocks.push({ type: 'image', file: img[1].trim(), caption: (img[2] ?? '').trim() })
    } else if (yt) {
      flush()
      const url = yt[1].trim()
      blocks.push({ type: 'youtube', url: isYoutubeUrl(url) ? url : null, caption: (yt[2] ?? '').trim() })
    } else if (!t) {
      flush()
    } else {
      para.push(t)
    }
  }
  flush()
  return { title, blocks }
}

/** 본문 글자 수 (공백 포함, 제목·이미지·동영상 표시는 빼고, 이미지 설명은 넣음 — 에디터에 들어가는 글 기준) */
export function bodyCharCount(blocks: BlogBlock[]): number {
  return blocks.reduce((n, b) => {
    if (b.type === 'heading' || b.type === 'paragraph') return n + charCount(b.text.replace(/\n/g, ' '))
    if (b.type === 'image') return n + charCount(b.caption)
    return n
  }, 0)
}

/** 키워드가 나온 횟수 (띄어쓰기 차이는 무시) */
export function countKeyword(text: string, keyword: string): number {
  const squash = (s: string) => s.replace(/\s+/g, '')
  const hay = squash(text)
  const needle = squash(keyword)
  if (!needle) return 0
  let n = 0
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++
  return n
}

export function blogPlainText(blocks: BlogBlock[]): string {
  return blocks.map((b) => (b.type === 'heading' || b.type === 'paragraph' ? b.text : b.type === 'image' ? b.caption : '')).join('\n')
}

/** 해시태그 정리 — # 빼고, 띄어쓰기 없애고, 중복 제거 */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const v = t.replace(/^#+/, '').replace(/\s+/g, '').trim()
    if (!v || v.length > 30 || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
  }
  return out
}

/**
 * 다른 글(유튜브 설명·카드뉴스 캡션)과 겹치는 문장 — 같은 문장을 그대로 쓰면 네이버가 유사 문서로 볼 수 있다.
 * 띄어쓰기·문장부호를 뺀 15자 이상(한글 10자 이상) 문장이 그대로 들어 있으면 겹친 것으로 본다.
 */
export function findCopiedSentences(blogText: string, others: string[]): string[] {
  const norm = (s: string) => s.replace(/[\s.,!?~'"“”‘’()[\]#:·…-]+/g, '')
  const hay = norm(blogText)
  const hits = new Set<string>()
  for (const other of others) {
    for (const sentence of other.split(/[\n.!?]+/)) {
      const s = sentence.trim()
      const n = norm(s)
      // 영어 예문·퀴즈 문장은 강의 내용이라 겹쳐도 된다 — 한국어 문장만 본다
      const korean = (n.match(/[가-힣]/g) ?? []).length
      if (n.length >= 15 && korean >= 10 && hay.includes(n)) hits.add(s)
    }
  }
  return Array.from(hits)
}

/** blog-post.md + 메타 검사 — 오류(error)는 등록을 막고, 경고(warn)는 검토 때 보라는 뜻 */
export function checkBlogPost(md: string, meta: Pick<BlogMeta, 'keywords' | 'tags'>, availableImages: string[]): BlogIssue[] {
  const issues: BlogIssue[] = []
  const { title, blocks } = parseBlogPost(md)
  const err = (message: string) => issues.push({ level: 'error', message })
  const warn = (message: string) => issues.push({ level: 'warn', message })
  const L = BLOG_LIMIT

  if (!title) err('첫 줄에 "# 제목"이 없어요')
  else {
    const tl = charCount(title)
    if (tl < L.titleMin || tl > L.titleMax) warn(`제목이 ${tl}자예요 (30자 안팎, ${L.titleMin}~${L.titleMax}자)`)
    const pos = title.replace(/\s+/g, '').indexOf(meta.keywords.main.replace(/\s+/g, ''))
    if (pos === -1) err(`제목에 메인 키워드 "${meta.keywords.main}"가 없어요`)
    else if (pos > 8) warn(`메인 키워드가 제목 앞쪽에 있지 않아요 (${pos}번째 글자)`)
  }

  const body = bodyCharCount(blocks)
  if (body < L.bodyMin || body > L.bodyMax) err(`본문이 ${body.toLocaleString()}자예요 (${L.bodyMin.toLocaleString()}~${L.bodyMax.toLocaleString()}자)`)

  const headings = blocks.filter((b) => b.type === 'heading')
  if (headings.length < L.headingsMin || headings.length > L.headingsMax) err(`소제목이 ${headings.length}개예요 (${L.headingsMin}~${L.headingsMax}개)`)
  const firstPara = blocks.find((b) => b.type === 'paragraph')
  if (blocks[0]?.type !== 'paragraph') warn('제목 다음은 도입 문단으로 시작해 주세요')
  if (firstPara && firstPara.type === 'paragraph' && countKeyword(firstPara.text, meta.keywords.main) === 0) err(`첫 문단에 메인 키워드 "${meta.keywords.main}"가 없어요`)

  const plain = `${title}\n${blogPlainText(blocks)}`
  const mainCount = countKeyword(plain, meta.keywords.main)
  if (mainCount < L.mainKeywordMin || mainCount > L.mainKeywordMax) err(`메인 키워드 "${meta.keywords.main}"가 ${mainCount}번 나와요 (제목 포함 ${L.mainKeywordMin}~${L.mainKeywordMax}번)`)
  const headingText = headings.map((h) => (h.type === 'heading' ? h.text : '')).join('\n')
  const subsInHeadings = meta.keywords.subs.filter((s) => countKeyword(headingText, s) > 0 || s.split(/\s+/).every((w) => headingText.includes(w)))
  if (subsInHeadings.length < 2) warn(`소제목에 서브 키워드가 ${subsInHeadings.length}개만 들어갔어요 (2개 이상 권장)`)
  for (const s of meta.keywords.subs) {
    const c = countKeyword(plain, s)
    if (c > 4) warn(`서브 키워드 "${s}"가 ${c}번 나와요 (억지 반복 주의)`)
  }

  const images = blocks.filter((b): b is Extract<BlogBlock, { type: 'image' }> => b.type === 'image')
  if (images.length < L.imagesMin || images.length > L.imagesMax) err(`이미지가 ${images.length}장이에요 (${L.imagesMin}~${L.imagesMax}장)`)
  const avail = new Set(availableImages)
  images.forEach((im) => {
    if (!avail.has(im.file)) err(`없는 이미지예요: ${im.file} (blog/images/ 안 파일만)`)
    if (!im.caption) err(`이미지 설명이 없어요: ${im.file}`)
  })
  const dupImg = images.map((i) => i.file).filter((f, i, a) => a.indexOf(f) !== i)
  if (dupImg.length) warn(`같은 이미지를 두 번 넣었어요: ${Array.from(new Set(dupImg)).join(', ')}`)

  const yts = blocks.filter((b) => b.type === 'youtube')
  if (yts.length !== 1) err(`유튜브 본편 위치 표시([YOUTUBE: …])가 ${yts.length}개예요 (정확히 1개)`)

  const longParas = blocks.filter((b) => b.type === 'paragraph' && charCount(b.text) > 180)
  if (longParas.length) warn(`긴 문단이 ${longParas.length}개 있어요 (2~3줄, 180자 이내로 끊기)`)

  if (meta.tags.length < L.tagsMin || meta.tags.length > L.tagsMax) err(`태그가 ${meta.tags.length}개예요 (${L.tagsMin}~${L.tagsMax}개)`)
  return issues
}

/** keywords.md의 "선정" 블록 → 키워드 (사람이 고친 값을 다음 실행에서 그대로 쓴다) */
export function parseKeywordsMd(md: string): BlogKeywords | null {
  const block = md.match(/```keywords\n([\s\S]*?)```/)
  if (!block) return null
  const main = block[1].match(/^메인:\s*(.+)$/m)?.[1].trim() ?? ''
  const subs = (block[1].match(/^서브:\s*(.+)$/m)?.[1] ?? '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  return main && subs.length ? { main, subs } : null
}

export interface KeywordCandidate { keyword: string; kind: 'main' | 'sub'; reason: string }

export function buildKeywordsMd(title: string, picked: BlogKeywords, candidates: KeywordCandidate[], reasons: { main: string; subs: string }): string {
  const rows = candidates.map((c) => `| ${c.keyword} | ${c.kind === 'main' ? '메인 후보' : '서브 후보'} | ${picked.main === c.keyword || picked.subs.includes(c.keyword) ? '✅' : ''} | ${c.reason.replace(/\|/g, '/')} |`)
  return [
    `# 블로그 키워드 제안 — ${title}`,
    '',
    '네이버 블로그 글을 쓰기 전에 고른 키워드예요. 바꾸고 싶으면 아래 **선정** 블록만 고친 뒤 `npm run blog -- {slug} --force`로 원고를 다시 만들어요.',
    '',
    '## 선정',
    '',
    '```keywords',
    `메인: ${picked.main}`,
    `서브: ${picked.subs.join(', ')}`,
    '```',
    '',
    `- **메인 키워드를 고른 이유:** ${reasons.main}`,
    `- **서브 키워드를 고른 이유:** ${reasons.subs}`,
    '',
    '## 후보',
    '',
    '| 키워드 | 구분 | 선정 | 이유 |',
    '|---|---|---|---|',
    ...rows,
    '',
    '> 검색량은 AI 어림이에요. 정확히 보려면 네이버 검색광고 → 키워드 도구에서 월간 검색수를 확인해 보세요.',
    '',
  ].join('\n')
}
