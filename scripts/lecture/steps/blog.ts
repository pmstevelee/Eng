// 블로그 단계 — 본 강의 대본 → 네이버 블로그 SEO 원고 (여기서 멈춤, 검토용)
// 1) 이미지 준비: 카드뉴스 PNG(없는 장은 렌더) + 강의 슬라이드 캡처 → blog/images/
// 2) keywords.md (메인 1 + 서브 3~5, 후보·이유)  — --keywords-only면 여기서 멈춤
// 3) blog-post.md + blog-meta.json (+ publish-log.md 자리)

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { renderStill, selectComposition } from '@remotion/renderer'
import { prisma } from '@/lib/prisma/client'
import {
  BLOG_DEFAULT_CATEGORY, bodyCharCount, buildKeywordsMd, checkBlogPost, countKeyword, isYoutubeUrl, parseBlogPost, parseKeywordsMd,
  type BlogKeywords, type BlogMeta,
} from '../../../src/lib/lecture-pipeline/blog'
import { CARD_LABELS, parseCardNews, type Card } from '../../../src/lib/lecture-pipeline/cardnews'
import { layoutTimeline } from '../../../src/lib/lecture-pipeline/timing'
import { SLIDE_TYPE_LABELS, type LectureScript, type Slide } from '../../../src/lib/lecture-pipeline/types'
import { LECTURE_VIDEO_ID, type LectureVideoProps } from '../../../src/components/lecture-video/props'
import { generateBlogKeywords, generateBlogPost, type BlogImageOption } from '../ai-blog'
import { browserOptions, cardnewsPaths, lectureDir, paths, readScript, readTimeline, rel, shortsPaths } from '../common'
import { runCardnewsRender } from './cardnews'
import { getBundle, timelineMatches } from './render'

export const blogPaths = (slug: string) => {
  const dir = path.join(lectureDir(slug), 'blog')
  return {
    dir,
    images: path.join(dir, 'images'),
    shots: path.join(dir, 'screenshots'),
    keywords: path.join(dir, 'keywords.md'),
    post: path.join(dir, 'blog-post.md'),
    meta: path.join(dir, 'blog-meta.json'),
    log: path.join(dir, 'publish-log.md'),
  }
}

/** 캡처하지 않는 슬라이드 (블로그 이미지로 쓸 내용이 적음) */
const SKIP_CAPTURE: Slide['type'][] = ['title', 'outro', 'hook', 'cta']

function slideAbout(s: Slide): string {
  const d = s.data as unknown as Record<string, unknown>
  const heading = typeof d.heading === 'string' ? d.heading : typeof d.pattern === 'string' ? d.pattern : typeof d.question === 'string' ? d.question : ''
  const text = JSON.stringify(s.data).replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').slice(0, 160)
  return `강의 슬라이드 캡처 · ${SLIDE_TYPE_LABELS[s.type]}${heading ? ` "${heading}"` : ''} · 내용: ${text}`
}

function cardAbout(c: Card): string {
  const text = JSON.stringify(c).replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').slice(0, 160)
  return `카드뉴스 · ${CARD_LABELS[c.type]} · 내용: ${text}`
}

/** 카드뉴스 PNG + 슬라이드 캡처를 blog/images/로 모은다 → AI에게 줄 목록 */
async function prepareImages(slug: string, script: LectureScript, opts: { recapture?: boolean }): Promise<BlogImageOption[]> {
  const bp = blogPaths(slug)
  mkdirSync(bp.images, { recursive: true })
  const options: BlogImageOption[] = []

  // 카드뉴스
  const cp = cardnewsPaths(slug)
  if (existsSync(cp.data)) {
    const { cardnews } = parseCardNews(JSON.parse(readFileSync(cp.data, 'utf8')))
    if (cardnews) {
      const missing = cardnews.cards.map((_, i) => i + 1).filter((n) => !existsSync(cp.card(n)))
      if (missing.length) {
        console.log(`  카드뉴스 PNG ${missing.length}장이 없어 먼저 렌더해요`)
        await runCardnewsRender(slug, { only: missing })
      }
      cardnews.cards.forEach((c, i) => {
        const src = cp.card(i + 1)
        const file = path.basename(src)
        if (existsSync(src)) {
          copyFileSync(src, path.join(bp.images, file))
          options.push({ file, about: cardAbout(c) })
        }
      })
    }
  } else {
    console.log(`  카드뉴스가 없어 슬라이드 캡처만 써요 (카드도 쓰려면 먼저 npm run cardnews -- ${slug})`)
  }

  // 강의 슬라이드 캡처 — 슬라이드 끝나기 직전(모든 요소가 나타난 화면), 자막 없이 1920×1080
  const saved = readTimeline(slug)
  const timeline = saved && timelineMatches(script, saved) ? saved : layoutTimeline(script)
  const targets = script.slides.filter((s) => !SKIP_CAPTURE.includes(s.type))
  const todo = targets.filter((s) => opts.recapture || !existsSync(path.join(bp.images, `slide-${s.id}.png`)))
  if (todo.length) {
    console.log(`  강의 슬라이드 캡처 ${todo.length}장`)
    const serveUrl = await getBundle()
    const browser = browserOptions()
    const inputProps: LectureVideoProps = { script, timeline, audioUrl: null, subtitles: false }
    const composition = await selectComposition({ serveUrl, id: LECTURE_VIDEO_ID, inputProps, ...browser })
    for (const s of todo) {
      const range = timeline.slides.find((r) => r.id === s.id)
      if (!range) continue
      const ms = Math.max(range.startMs, range.endMs - 400)
      const frame = Math.min(composition.durationInFrames - 1, Math.floor((ms / 1000) * composition.fps))
      const output = path.join(bp.images, `slide-${s.id}.png`)
      await renderStill({ composition, serveUrl, output, inputProps, frame, imageFormat: 'png', ...browser })
      console.log(`    ✔ ${rel(output)} (${SLIDE_TYPE_LABELS[s.type]})`)
    }
  }
  for (const s of targets) {
    const file = `slide-${s.id}.png`
    if (existsSync(path.join(bp.images, file))) options.push({ file, about: slideAbout(s) })
  }
  return options
}

/** 다른 곳에 올린 글 (블로그에 그대로 쓰면 안 되는 문장) */
function otherTexts(slug: string): string[] {
  const files = [paths(slug).youtube, cardnewsPaths(slug).instagram, cardnewsPaths(slug).threads]
  const shortsDir = shortsPaths(slug, 1).dir
  if (existsSync(shortsDir)) files.push(...readdirSync(shortsDir).filter((f) => f.endsWith('-youtube.md')).map((f) => path.join(shortsDir, f)))
  return files.filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8'))
}

/** 본편 유튜브 주소 — --youtube가 우선, 없으면 문법학습관리에 등록된 본사 강의 */
async function findYoutubeUrl(script: LectureScript, given: string | null): Promise<string | null> {
  if (given) {
    if (!isYoutubeUrl(given)) throw new Error(`유튜브 주소 형식이 아니에요: ${given}`)
    return given
  }
  const code = script.grammarPoint?.code
  if (!code) return null
  try {
    const lec = await prisma.grammarLecture.findFirst({
      where: { academyId: null, isActive: true, provider: 'youtube', grammarPoint: { code: { startsWith: code } } },
      orderBy: { createdAt: 'desc' },
      select: { videoId: true },
    })
    return lec ? `https://youtu.be/${lec.videoId}` : null
  } catch {
    return null
  }
}

export interface BlogOptions {
  force?: boolean
  keywordsOnly?: boolean
  youtube?: string | null
  category?: string | null
  recapture?: boolean
}

export async function runBlog(slug: string, opts: BlogOptions = {}): Promise<void> {
  const bp = blogPaths(slug)
  const script = readScript(slug)
  if (existsSync(bp.post) && !opts.force) {
    throw new Error(`이미 ${rel(bp.post)}이 있어요 (고친 내용을 지키려고 멈춤). 새로 만들려면 --force`)
  }
  mkdirSync(bp.dir, { recursive: true })
  console.log(`▶ 블로그 원고: ${script.title}`)

  // 키워드 — keywords.md의 선정 블록이 있으면 그대로 쓴다 (사람이 고친 값). --keywords-only면 늘 새로 제안
  let kw: BlogKeywords | null = existsSync(bp.keywords) && !opts.keywordsOnly ? parseKeywordsMd(readFileSync(bp.keywords, 'utf8')) : null
  if (kw) {
    console.log(`  키워드: keywords.md 선정 그대로 (메인 "${kw.main}" · 서브 ${kw.subs.join(', ')})`)
  } else {
    console.log('  키워드 제안 중…')
    const k = await generateBlogKeywords(script)
    writeFileSync(bp.keywords, buildKeywordsMd(script.title, k.picked, k.candidates, k.reasons))
    kw = k.picked
    console.log(`  ✔ ${rel(bp.keywords)} (메인 "${kw.main}" · 서브 ${kw.subs.join(', ')})`)
    if (opts.keywordsOnly) {
      console.log(`\n⏸ 키워드만 만들고 멈췄어요. 검토 후 원고 만들기: npm run blog -- ${slug}`)
      return
    }
  }

  const images = await prepareImages(slug, script, { recapture: opts.recapture })
  console.log(`  이미지 후보 ${images.length}장`)
  const youtubeUrl = await findYoutubeUrl(script, opts.youtube ?? null)
  console.log(youtubeUrl ? `  본편 유튜브: ${youtubeUrl}` : '  본편 유튜브 주소가 아직 없어요 → 원고에 자리만 표시 (나중에 --youtube로 넣기)')

  console.log('  원고 쓰는 중… (1~3분)')
  const draft = await generateBlogPost(script, kw, images, otherTexts(slug), (m) => console.log(m))

  // 유튜브 자리 → 실제 주소
  const markdown = draft.markdown.replace(/^\[(?:YOUTUBE|VIDEO|동영상):\s*[^|\]]*?\s*(\|[^\]]*)?\]$/im, (_m, cap: string | undefined) => `[YOUTUBE: ${youtubeUrl ?? '본편 링크'} ${cap ?? '| 본편 강의 영상'}]`)
  const parsed = parseBlogPost(markdown)
  const meta: BlogMeta = {
    version: 1,
    slug,
    lectureTitle: script.title,
    title: parsed.title || draft.title,
    keywords: kw,
    tags: draft.tags,
    category: opts.category?.trim() || process.env.NAVER_BLOG_CATEGORY?.trim() || BLOG_DEFAULT_CATEGORY,
    images: parsed.blocks.flatMap((b) => (b.type === 'image' ? [{ file: b.file, caption: b.caption }] : [])),
    youtubeUrl,
    createdAt: new Date().toISOString(),
  }
  const header = [
    '<!-- 블로그 원고: # 제목 / ## 소제목 / [IMG: 파일 | 설명] / [YOUTUBE: 주소 | 설명] / 나머지는 본문 문단(빈 줄로 구분). 고친 뒤 npm run blog:publish -->',
    '',
  ].join('\n')
  writeFileSync(bp.post, header + markdown)
  writeFileSync(bp.meta, JSON.stringify(meta, null, 2) + '\n')
  if (!existsSync(bp.log)) writeFileSync(bp.log, `# 네이버 블로그 등록 기록 — ${script.title}\n\n아직 등록하지 않았어요. \`npm run blog:publish -- ${slug}\`로 임시저장해요.\n`)

  const issues = checkBlogPost(markdown, meta, images.map((i) => i.file))
  const plain = parsed.blocks.map((b) => ('text' in b ? b.text : b.type === 'image' ? b.caption : '')).join('\n')
  console.log(`✔ 원고 완료 · 제목 "${meta.title}" · 본문 ${bodyCharCount(parsed.blocks).toLocaleString()}자 · 소제목 ${parsed.blocks.filter((b) => b.type === 'heading').length}개 · 이미지 ${meta.images.length}장 · 태그 ${meta.tags.length}개 · 메인 키워드 ${countKeyword(`${meta.title}\n${plain}`, kw.main)}번`)
  const notes = Array.from(new Set([...draft.notes.filter((n) => n.startsWith("자동 수정 못 함")), ...issues.map((i) => `${i.level === "error" ? "✖" : "⚠"} ${i.message}`)]))
  if (notes.length) console.log(`  확인할 점:\n${notes.map((n) => `   - ${n}`).join('\n')}`)
  console.log(`  ${rel(bp.keywords)}\n  ${rel(bp.post)}  ← 검토·수정\n  ${rel(bp.meta)}  ← 제목·태그·카테고리\n  ${rel(bp.images)}/`)
}
