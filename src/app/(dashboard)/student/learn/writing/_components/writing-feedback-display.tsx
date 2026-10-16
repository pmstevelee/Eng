'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Target,
  BarChart2,
  Zap,
  Flag,
} from 'lucide-react'
import type { WritingEvaluationResult } from '@/app/api/ai/evaluate-writing/route'
import type { DomainLevels } from '@/lib/ai/domain-level-calculator'
import type { WritingGradingReport } from '@/lib/ai/writing-grading'
import { WritingGradingReportCard } from '@/components/shared/writing-grading-report-card'

// AI 피드백 결과 화면. 작성 직후 결과와 이력 화면이 같은 저장 데이터를 똑같이 보여주도록 공용으로 사용한다.

const DOMAIN_COLORS: Record<string, string> = {
  grammar: '#1865F2',
  vocabulary: '#7854F7',
  reading: '#0FBFAD',
  listening: '#E91E8A',
  writing: '#E35C20',
}

const DOMAIN_LABELS: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  reading: '읽기',
  listening: '듣기',
  writing: '쓰기',
}

const AREA_LABELS: Record<string, string> = {
  grammarInWriting: '쓰기 문법',
  organization: '쓰기 구성',
  vocabularyInWriting: '쓰기 어휘',
  expression: '표현력',
}

const AREA_COLORS: Record<string, string> = {
  grammarInWriting: '#1865F2',
  organization: '#0FBFAD',
  vocabularyInWriting: '#7854F7',
  expression: '#E35C20',
}

// ── 가로 레벨 바 ───────────────────────────────────────────────────────────────

function LevelBar({
  label,
  level,
  score,
  cefr,
  color,
  hasGap,
  gapBadge,
}: {
  label: string
  level: number
  score: number
  cefr: string
  color: string
  hasGap?: boolean
  gapBadge?: string
}) {
  const filledBars = level
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-gray-600">{label}</span>
        <div className="flex flex-1 gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-3 flex-1 rounded-sm transition-all"
              style={{
                backgroundColor: i < filledBars ? color : '#E5E7EB',
                opacity: i < filledBars ? 1 : 0.4,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <span className="text-xs font-bold" style={{ color }}>
            Lv.{level}
          </span>
          <span className="text-xs text-gray-400">{cefr}</span>
          <span className="w-10 text-right text-xs text-gray-400">({score}점)</span>
          {gapBadge && (
            <span className="shrink-0 text-xs">{gapBadge}</span>
          )}
        </div>
      </div>
      {hasGap && (
        <div className="ml-16 mb-0.5 text-xs text-gray-400">{''}</div>
      )}
    </div>
  )
}

// ── 피드백 결과 화면 ───────────────────────────────────────────────────────────

export function WritingFeedbackDisplay({
  feedback,
  domainLevels,
  essay,
  onReset,
  onRetry,
}: {
  feedback: WritingEvaluationResult
  domainLevels: DomainLevels | null
  essay: string
  /** 없으면 하단 버튼(다른 주제/다시 쓰기/레벨업 연습)을 숨긴다 (이력 화면) */
  onReset?: () => void
  onRetry?: () => void
}) {
  const [showModelEssay, setShowModelEssay] = useState(false)
  const { writingLevelAssessment, detailedScores, crossDomainAnalysis, corrections, levelUpStrategy, modelEssay } = feedback

  const assessedLevel = writingLevelAssessment.assessedLevel
  const maxGap = domainLevels?.gaps.maxGap ?? 0

  // 평가항목별 채점 + 6영역 상세 오류분석 카드용 어댑터 (교사 채점 리포트와 공통 컴포넌트 재사용)
  const detailedGradingReport: WritingGradingReport = {
    detectedTaskFormat: feedback.detectedTaskFormat,
    overallScore: feedback.overallEvaluation?.totalPoints ?? detailedScores.totalScore,
    cefrEstimate: writingLevelAssessment.assessedCefr,
    categoryScores: feedback.categoryScores,
    rubricItems: feedback.rubricItems,
    overallEvaluation: feedback.overallEvaluation,
    essayAnalysis: feedback.essayAnalysis,
    wordCount: essay.trim().split(/\s+/).filter(Boolean).length,
    strengths: feedback.strengths,
    errors: feedback.errors,
    spellingErrorSummary: feedback.spellingErrorSummary,
    grammarErrorSummary: feedback.grammarErrorSummary,
    improvedVersion: feedback.improvedVersion,
    teacherNote: '',
    nextStepRecommendation: feedback.nextStepRecommendation,
  }

  // 쓰기 레벨 판정 색상
  const levelColor =
    assessedLevel >= 8 ? '#1FAF54' : assessedLevel >= 5 ? '#FFB100' : '#D92916'

  return (
    <div className="space-y-4">

      {/* ① 쓰기 레벨 독립 판정 */}
      <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: levelColor }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: levelColor }} />
            <h3 className="text-sm font-bold text-gray-900">쓰기 레벨 판정</h3>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: levelColor }}>
              {writingLevelAssessment.confidence === 'high' ? '신뢰도 높음' : writingLevelAssessment.confidence === 'medium' ? '신뢰도 보통' : '신뢰도 낮음'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center rounded-xl px-5 py-3"
            style={{ backgroundColor: levelColor + '15' }}>
            <span className="text-3xl font-black" style={{ color: levelColor }}>
              Lv.{assessedLevel}
            </span>
            <span className="text-xs font-bold" style={{ color: levelColor }}>
              {writingLevelAssessment.assessedCefr}
            </span>
            <span className="text-xs text-gray-500">{writingLevelAssessment.assessedLevelName}</span>
          </div>
          <p className="flex-1 text-sm leading-relaxed text-gray-700">
            {writingLevelAssessment.summary}
          </p>
        </div>
      </div>

      {/* ② 5영역 레벨 비교 바 차트 (듣기 데이터 있는 경우 포함) */}
      {domainLevels && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">
              5영역 레벨 비교 (10단계)
            </h3>
          </div>
          <div className="space-y-2.5">
            {(
              [
                { key: 'grammar', level: domainLevels.grammar.level, score: domainLevels.grammar.score, cefr: domainLevels.grammar.cefr },
                { key: 'vocabulary', level: domainLevels.vocabulary.level, score: domainLevels.vocabulary.score, cefr: domainLevels.vocabulary.cefr },
                { key: 'reading', level: domainLevels.reading.level, score: domainLevels.reading.score, cefr: domainLevels.reading.cefr },
                ...(domainLevels.listening ? [{ key: 'listening', level: domainLevels.listening.level, score: domainLevels.listening.score, cefr: domainLevels.listening.cefr }] : []),
                { key: 'writing', level: assessedLevel, score: detailedScores.totalScore, cefr: writingLevelAssessment.assessedCefr },
              ] as { key: string; level: number; score: number; cefr: string }[]
            ).map(({ key, level, score, cefr }) => {
              const isWriting = key === 'writing'
              const gap = isWriting ? 0 : level - assessedLevel
              const gapBadge = isWriting ? undefined : gap >= 3 ? '🔴' : gap >= 1 ? '⚠️' : undefined
              return (
                <LevelBar
                  key={key}
                  label={DOMAIN_LABELS[key]}
                  level={level}
                  score={score}
                  cefr={cefr}
                  color={DOMAIN_COLORS[key]}
                  gapBadge={gapBadge}
                />
              )
            })}
          </div>
          {maxGap >= 2 && (
            <div className="mt-3 rounded-lg border border-[#FCA5A5] bg-[#FFF5F5] px-3 py-2">
              <p className="text-xs font-medium text-[#D92916]">
                ⚠️ 쓰기가 다른 영역보다{' '}
                {crossDomainAnalysis.levelMap.grammar.gap ?? 0}~{maxGap}단계 낮습니다!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ③ 쓰기 내부 4항목 레벨 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">쓰기 세부 레벨 분석</h3>
        </div>
        <div className="space-y-3">
          {(
            [
              { key: 'grammarInWriting', data: detailedScores.grammarInWriting },
              { key: 'organization', data: detailedScores.organization },
              { key: 'vocabularyInWriting', data: detailedScores.vocabularyInWriting },
              { key: 'expression', data: detailedScores.expression },
            ] as { key: string; data: typeof detailedScores.grammarInWriting }[]
          ).map(({ key, data }) => {
            const color = AREA_COLORS[key]
            const gap = data.gapFromTest?.gap ?? null
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">{AREA_LABELS[key]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color }}>
                      Lv.{data.level}
                    </span>
                    {gap !== null && gap > 0 && (
                      <span className="text-xs text-gray-400">
                        ({gap >= 3 ? '🔴' : '⚠️'} 시험 Lv.{data.gapFromTest!.testLevel}과 {gap}단계 차이)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-2.5 flex-1 rounded-sm"
                      style={{
                        backgroundColor: i < data.level ? color : '#E5E7EB',
                        opacity: i < data.level ? 1 : 0.35,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{data.detail}</p>
                {data.gapFromTest?.gapAnalysis && (
                  <p className="mt-0.5 text-xs text-[#7854F7]">{data.gapFromTest.gapAnalysis}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ④ 종합 진단 */}
      <div
        className="rounded-xl border px-4 py-4"
        style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
      >
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#1865F2]" />
          <h3 className="text-sm font-semibold text-[#1865F2]">종합 진단</h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          {crossDomainAnalysis.overallDiagnosis}
        </p>
        {crossDomainAnalysis.biggestGap && (
          <div className="mt-3 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2">
            <p className="text-xs font-semibold text-[#D92916]">
              가장 큰 격차: {crossDomainAnalysis.biggestGap.area}
            </p>
            <p className="text-xs text-gray-600">{crossDomainAnalysis.biggestGap.detail}</p>
          </div>
        )}
      </div>

      {/* ⑤ 상세 오류 분석 (문법/철자/어휘/문장구조/응집성/과제수행도) */}
      <WritingGradingReportCard report={detailedGradingReport} />

      {/* ⑥ 교정 사항 */}
      {corrections.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#D92916]" />
            <h3 className="text-sm font-semibold text-gray-700">교정 사항</h3>
          </div>
          <div className="space-y-3">
            {corrections.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 space-y-1">
                  <p className="text-xs leading-relaxed text-[#D92916] line-through">{c.original}</p>
                  <p className="text-xs font-medium leading-relaxed text-[#1FAF54]">→ {c.corrected}</p>
                </div>
                <p className="mb-1.5 text-xs leading-relaxed text-gray-500">{c.explanation}</p>
                {c.relatedStrength && (
                  <p className="text-xs text-[#1865F2]">
                    💡 {c.relatedStrength}
                  </p>
                )}
                {c.levelImpact && (
                  <p className="mt-0.5 text-xs font-medium" style={{ color: '#7854F7' }}>
                    📈 {c.levelImpact}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⑥ 레벨업 로드맵 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#7854F7]" />
          <h3 className="text-sm font-semibold text-gray-700">
            Level {levelUpStrategy.currentWritingLevel} → Level {levelUpStrategy.targetWritingLevel} 로드맵
          </h3>
        </div>

        {/* 핵심 메시지 */}
        <div
          className="mb-4 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#F5F3FF' }}
        >
          <p className="text-xs leading-relaxed font-medium" style={{ color: '#7854F7' }}>
            {levelUpStrategy.keyMessage}
          </p>
        </div>

        {/* 마일스톤 */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-gray-500">레벨업 경로</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {/* 현재 */}
            <div className="flex shrink-0 flex-col items-center">
              <div
                className="flex h-10 w-16 items-center justify-center rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: '#D92916' }}
              >
                Lv.{levelUpStrategy.currentWritingLevel}
              </div>
              <span className="mt-1 text-xs text-gray-400">현재</span>
            </div>
            {levelUpStrategy.milestones.map((ms, i) => (
              <>
                <div key={`arrow-${i}`} className="shrink-0 text-gray-300">→</div>
                <div key={`ms-${i}`} className="flex shrink-0 flex-col items-center">
                  <div
                    className="flex h-10 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed px-2 py-1 text-center"
                    style={{ borderColor: '#7854F7' }}
                  >
                    <span className="text-xs font-bold" style={{ color: '#7854F7' }}>
                      {ms.target.split(' ')[0]} {ms.target.split(' ')[1]}
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-gray-400">{ms.week}주 후</span>
                  <span className="text-xs text-gray-400">{ms.sign.slice(0, 10)}...</span>
                </div>
              </>
            ))}
          </div>
        </div>

        {/* 전략 3가지 */}
        <div className="space-y-2.5 mb-3">
          {levelUpStrategy.strategies.map((strategy) => (
            <div key={strategy.priority} className="rounded-lg border border-gray-100 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: '#7854F7' }}
                >
                  {strategy.priority}
                </span>
                <span className="text-xs font-semibold text-gray-800">{strategy.title}</span>
                {strategy.bridgingFrom && (
                  <span className="text-xs text-gray-400">({strategy.bridgingFrom})</span>
                )}
              </div>
              <p className="mb-1.5 text-xs leading-relaxed text-gray-600">{strategy.action}</p>
              {strategy.example && (
                <div className="mb-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 space-y-1">
                  <p className="text-xs text-gray-400 line-through">{strategy.example.before}</p>
                  <p className="text-xs font-medium text-[#1FAF54]">→ {strategy.example.after}</p>
                </div>
              )}
              <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#F5F3FF' }}>
                <p className="text-xs font-medium" style={{ color: '#7854F7' }}>
                  <Target className="mr-1 inline h-3 w-3" />
                  이번 주 목표: {strategy.weeklyGoal}
                </p>
              </div>
              {strategy.expectedLevelGain && (
                <p className="mt-1 text-xs font-medium text-[#1FAF54]">
                  📈 {strategy.expectedLevelGain}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 격려 메시지 */}
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#ECFDF5', borderLeft: '3px solid #1FAF54' }}
        >
          <p className="text-xs leading-relaxed text-gray-700">{levelUpStrategy.encouragement}</p>
        </div>
      </div>

      {/* ⑦ 모범 답안 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          onClick={() => setShowModelEssay((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">{modelEssay.targetLevelName}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {modelEssay.wordCount}단어
            </span>
          </div>
          {showModelEssay ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        {showModelEssay && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {modelEssay.text}
            </p>
            {modelEssay.levelFeatures.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-500">이 레벨의 핵심 특징</p>
                <ul className="space-y-1">
                  {modelEssay.levelFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#7854F7' }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 내가 쓴 글 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">내가 작성한 에세이</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{essay}</p>
      </div>

      {/* 하단 버튼 */}
      {onReset && onRetry && (
      <div className="space-y-2">
        <button
          onClick={onReset}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: '#E35C20' }}
        >
          <RotateCcw className="h-4 w-4" />
          다른 주제로 연습하기
        </button>
        <button
          onClick={onRetry}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          같은 주제로 다시 쓰기
        </button>
        <Link
          href="/student/learn/domain/WRITING"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7854F7] text-sm font-medium text-[#7854F7] hover:bg-[#F5F3FF]"
        >
          <Sparkles className="h-4 w-4" />
          레벨업 연습 시작
        </Link>
      </div>
      )}
    </div>
  )
}
