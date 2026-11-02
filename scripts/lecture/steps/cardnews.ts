// 카드뉴스 단계 — 본 강의 대본 → 인스타그램·쓰레드 카드뉴스
// runCardnewsScript: AI 문구 → cardnews.json + cardnews-script.md + instagram-caption.md + threads-post.md (여기서 멈춤)
// runCardnewsRender: cardnews.json → card-01.png ~ card-10.png (1080×1350, Remotion still)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { renderStill, selectComposition } from '@remotion/renderer'
import { buildCardScriptMd, CARD_LABELS, parseCardNews, type CardNews } from '../../../src/lib/lecture-pipeline/cardnews'
import { CARD_STILL_ID, type CardStillProps } from '../../../src/components/lecture-video/props'
import { buildInstagramMd, buildThreadsMd, generateCardNews } from '../ai-social'
import { browserOptions, cardnewsPaths, readScript, rel } from '../common'
import { getBundle } from './render'

function readCardNews(slug: string): CardNews {
  const p = cardnewsPaths(slug)
  if (!existsSync(p.data)) throw new Error(`카드뉴스 문구가 없어요. 먼저 npm run cardnews -- ${slug}`)
  let json: unknown
  try {
    json = JSON.parse(readFileSync(p.data, 'utf8'))
  } catch (e) {
    throw new Error(`${rel(p.data)}의 JSON 형식이 깨졌어요: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { cardnews, issues } = parseCardNews(json)
  issues.filter((i) => i.level === 'warn').forEach((i) => console.log(`  ⚠ [${i.where}] ${i.message}`))
  if (!cardnews) throw new Error(`${rel(p.data)}에 고칠 곳이 있어요:\n${issues.filter((i) => i.level === 'error').map((i) => `✖ [${i.where}] ${i.message}`).join('\n')}`)
  return cardnews
}

export async function runCardnewsScript(slug: string, opts: { force?: boolean } = {}): Promise<void> {
  const p = cardnewsPaths(slug)
  const lecture = readScript(slug)
  if (existsSync(p.data) && !opts.force) {
    throw new Error(`이미 ${rel(p.data)}이 있어요 (고친 내용을 지키려고 멈춤). 새로 만들려면 --force`)
  }
  console.log(`▶ 카드뉴스 문구: ${lecture.title}`)
  const { cardnews, captions, notes } = await generateCardNews(lecture, (m) => console.log(m))
  mkdirSync(p.dir, { recursive: true })
  writeFileSync(p.data, JSON.stringify(cardnews, null, 2) + '\n')
  writeFileSync(p.script, buildCardScriptMd(cardnews, notes))
  writeFileSync(p.instagram, buildInstagramMd(lecture.title, captions.instagram))
  writeFileSync(p.threads, buildThreadsMd(lecture.title, captions.threads))
  console.log(`✔ 카드 ${cardnews.cards.length}장 문구${notes.length ? ` (확인할 점 ${notes.length}개)` : ''}`)
  console.log(`  ${rel(p.script)}  ← 검토\n  ${rel(p.data)}  ← 고칠 곳은 여기서\n  ${rel(p.instagram)}\n  ${rel(p.threads)}`)
}

export async function runCardnewsRender(slug: string, opts: { only?: number[] | null } = {}): Promise<void> {
  const p = cardnewsPaths(slug)
  const cn = readCardNews(slug)
  // 고친 cardnews.json을 검토 문서에도 반영
  writeFileSync(p.script, buildCardScriptMd(cn))
  const total = cn.cards.length
  const pages = cn.cards.map((_, i) => i + 1).filter((n) => !opts.only || opts.only.includes(n))
  console.log(`▶ 카드뉴스 렌더: ${cn.title} · ${pages.length}/${total}장 · 1080×1350 PNG`)
  const serveUrl = await getBundle()
  const browser = browserOptions()
  for (const page of pages) {
    const inputProps: CardStillProps = { card: cn.cards[page - 1], page, total }
    const composition = await selectComposition({ serveUrl, id: CARD_STILL_ID, inputProps, ...browser })
    await renderStill({ composition, serveUrl, output: p.card(page), inputProps, imageFormat: 'png', ...browser })
    console.log(`  ✔ ${rel(p.card(page))} (${CARD_LABELS[cn.cards[page - 1].type]})`)
  }
  console.log(`✔ 카드뉴스 완료 · 캡션: ${rel(p.instagram)} · ${rel(p.threads)}`)
}
