// AI 강의 스크립트 조회 (관리자 전용 화면·액션) — 캐시 없음
// 학생·교사 화면은 이 모듈을 쓰지 않는다 (학생은 GrammarLecture의 YouTube 링크만 본다).

import { prisma } from '@/lib/prisma/client'
import { levelLabel } from '@/lib/openai/grammar-point-draft'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'
import type { ScriptPointInfo } from '@/lib/grammar/video/script-prompt'

export interface AdminLectureScript {
  id: string
  title: string
  seriesNo: number | null
  status: string
  source: string
  sourceText: string | null
  /** 장면 JSON 원본 — 화면에서 parseVideoScenes로 검증해 쓴다 */
  scenesJson: unknown
  koVoiceId: string | null
  enVoiceId: string | null
  totalChars: number
  durationSec: number | null
  createdByName: string | null
  /** ISO */
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  audioReadyAt: string | null
  linkedAt: string | null
  /** 연결된 YouTube 강의 (본사 기본 강의) */
  lecture: { id: string; videoId: string; title: string; durationSec: number | null; completedCount: number } | null
}

/** 포인트의 강의 스크립트 (최근 순) */
export async function getPointLectureScripts(pointId: string): Promise<AdminLectureScript[]> {
  const rows = await prisma.grammarLectureScript.findMany({
    where: { grammarPointId: pointId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      seriesNo: true,
      status: true,
      source: true,
      sourceText: true,
      scenesJson: true,
      koVoiceId: true,
      enVoiceId: true,
      totalChars: true,
      durationSec: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      audioReadyAt: true,
      createdBy: { select: { name: true } },
      linkedAt: true,
      lecture: {
        select: {
          id: true,
          videoId: true,
          title: true,
          durationSec: true,
          _count: { select: { views: { where: { completedAt: { not: null } } } } },
        },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    seriesNo: r.seriesNo,
    status: r.status,
    source: r.source,
    sourceText: r.sourceText,
    scenesJson: r.scenesJson,
    koVoiceId: r.koVoiceId,
    enVoiceId: r.enVoiceId,
    totalChars: r.totalChars,
    durationSec: r.durationSec,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    approvedAt: r.approvedAt?.toISOString() ?? null,
    audioReadyAt: r.audioReadyAt?.toISOString() ?? null,
    linkedAt: r.linkedAt?.toISOString() ?? null,
    lecture: r.lecture
      ? {
          id: r.lecture.id,
          videoId: r.lecture.videoId,
          title: r.lecture.title,
          durationSec: r.lecture.durationSec,
          completedCount: r.lecture._count.views,
        }
      : null,
  }))
}

/** 트리 배지용 강의 제작 단계 */
export type LectureProduction = 'SCRIPT' | 'AUDIO_READY' | 'LINKED'

const PRODUCTION_RANK: Record<LectureProduction, number> = { SCRIPT: 1, AUDIO_READY: 2, LINKED: 3 }

/** 포인트별 가장 앞선 제작 단계 (스크립트가 없는 포인트는 없음) */
export async function getLectureProductionByPoint(): Promise<Map<string, LectureProduction>> {
  const rows = await prisma.grammarLectureScript.groupBy({ by: ['grammarPointId', 'status'], _count: { _all: true } })
  const out = new Map<string, LectureProduction>()
  for (const r of rows) {
    const stage: LectureProduction = r.status === 'LINKED' ? 'LINKED' : r.status === 'AUDIO_READY' ? 'AUDIO_READY' : 'SCRIPT'
    const prev = out.get(r.grammarPointId)
    if (!prev || PRODUCTION_RANK[stage] > PRODUCTION_RANK[prev]) out.set(r.grammarPointId, stage)
  }
  return out
}

/** AI 프롬프트용 포인트 정보 (본사 포인트만) */
export async function getScriptPointInfo(pointId: string): Promise<(ScriptPointInfo & { id: string }) | null> {
  const p = await prisma.grammarPoint.findFirst({
    where: { id: pointId, academyId: null },
    select: {
      id: true,
      code: true,
      title: true,
      levelMin: true,
      levelMax: true,
      summary: true,
      rulesJson: true,
      examplesJson: true,
      commonErrorsJson: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
    },
  })
  if (!p) return null
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    category: p.category.parent ? `${p.category.parent.name} > ${p.category.name}` : p.category.name,
    levelLabel: `${levelLabel(p.levelMin)} ~ ${levelLabel(p.levelMax)}`,
    summary: p.summary,
    rules: parseGrammarRules(p.rulesJson).map((r) => (r.formula ? `${r.text} (${r.formula})` : r.text)),
    examples: parseGrammarExamples(p.examplesJson).map((e) => `${e.en} — ${e.ko}`),
    commonErrors: parseGrammarCommonErrors(p.commonErrorsJson).map((e) => `✗ ${e.wrong} → ✓ ${e.correct} (${e.reason})`),
  }
}
