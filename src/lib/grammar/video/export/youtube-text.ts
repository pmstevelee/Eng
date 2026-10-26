// YouTube 업로드용 글 — 파일 이름, 설명문(.txt), 스크립트(.txt). 순수 함수.

import { VIDEO_TEMPLATE_LABELS, type VideoScene } from '../../../../types/grammar-video'
import { formatChapterTime, toYoutubeChapters, type Timeline } from '../timeline'
import { VIDEO_BRAND } from '../constants'

/** YouTube 제목 최대 길이 */
export const YOUTUBE_TITLE_MAX = 100

export interface ExportPointInfo {
  code: string
  title: string
  summary: string | null
  categoryName: string | null
}

/** {code}-{제목} — 파일 이름에 못 쓰는 글자·공백은 '-'로 */
export function exportFileBase(code: string, title: string): string {
  const clean = `${code}-${title}`
    .replace(/[\\/:*?"<>|#%&{}$!'@`=+]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return Array.from(clean).slice(0, 80).join('') || code
}

function openingOf(scenes: VideoScene[]) {
  const s = scenes.find((x) => x.template === 'opening')
  return s && s.template === 'opening' ? s.data : null
}

function cut(text: string, max: number): string {
  const chars = Array.from(text.trim())
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('')}…`
}

/** 제목 후보 3개 (오프닝 장면 기준, 100자 이내, 중복 없음) */
export function titleCandidates(scenes: VideoScene[], point: ExportPointInfo): string[] {
  const o = openingOf(scenes)
  const ko = o?.titleKo.trim() || point.title
  const en = o?.titleEn.trim()
  const hook = o?.hook.trim()
  const series = o?.seriesLabel.trim()
  const raw = [
    `${ko}${en ? ` (${en})` : ''} 한 번에 정리 | 영문법`,
    hook ? `${hook} — ${ko}` : `${ko} 핵심 규칙과 예문 | 영문법`,
    `${ko} 예문으로 쉽게 이해하기 | ${series || VIDEO_BRAND}`,
  ]
  const out: string[] = []
  for (const r of raw) {
    const t = cut(r, YOUTUBE_TITLE_MAX)
    if (!out.includes(t)) out.push(t)
  }
  return out
}

/** 해시태그용 — 공백·기호 제거 */
function tag(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/[\s!-/:-@[-`{-~·•…—–]+/g, '')
  return t ? `#${t}` : null
}

export function hashtags(scenes: VideoScene[], point: ExportPointInfo): string[] {
  const o = openingOf(scenes)
  const list = ['#영문법', '#중학영어', tag(o?.titleKo ?? point.title), tag(o?.titleEn), tag(point.categoryName), tag(VIDEO_BRAND)]
  return Array.from(new Set(list.filter((x): x is string => Boolean(x))))
}

/** YouTube 설명문: 제목 후보 → 소개·요약 → 챕터 → 해시태그 */
export function buildYoutubeDescription(scenes: VideoScene[], timeline: Timeline, point: ExportPointInfo): string {
  const o = openingOf(scenes)
  const chapters = toYoutubeChapters(timeline)
  const lines: string[] = []
  lines.push('[제목 후보 — 하나를 골라 YouTube 제목에 넣고, 이 부분은 지우고 붙여 넣으세요]')
  titleCandidates(scenes, point).forEach((t, i) => lines.push(`${i + 1}. ${t}`))
  lines.push('', '────────────────', '')
  const heading = o ? `${o.titleKo}${o.titleEn ? ` (${o.titleEn})` : ''}` : point.title
  lines.push(heading)
  if (o?.hook) lines.push(o.hook)
  if (point.summary?.trim()) lines.push('', point.summary.trim())
  lines.push('')
  if (chapters.length > 0) {
    lines.push('⏱ 챕터')
    chapters.forEach((c) => lines.push(c.line))
  } else {
    lines.push('(영상이 짧아 YouTube 챕터 조건 — 3개 이상, 각 10초 이상 — 을 채우지 못해 챕터를 넣지 않았습니다)')
  }
  lines.push('', hashtags(scenes, point).join(' '))
  return `${lines.join('\n')}\n`
}

/** 스크립트 .txt — 장면별 시작 시각과 나레이션 */
export function buildScriptText(scenes: VideoScene[], timeline: Timeline, title: string, point: ExportPointInfo): string {
  const lines: string[] = []
  lines.push(title === point.title ? `${title} (${point.code})` : `${title} (${point.code} ${point.title})`)
  lines.push(`길이 ${formatChapterTime(timeline.duration / 1000)} · 장면 ${scenes.length}개`, '')
  scenes.forEach((scene, i) => {
    const ts = timeline.scenes[i]
    lines.push(`[${i + 1}] ${scene.name} · ${VIDEO_TEMPLATE_LABELS[scene.template]} · ${formatChapterTime((ts?.start ?? 0) / 1000)}`)
    for (const seg of scene.segments) {
      if (seg.waitMs) lines.push(`  (대기 ${Math.round(seg.waitMs / 100) / 10}초)`)
      else lines.push(`  ${seg.lang === 'en' ? 'EN' : 'KO'}  ${seg.text}`)
    }
    lines.push('')
  })
  return lines.join('\n')
}
