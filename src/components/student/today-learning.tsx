import Link from 'next/link'
import {
  RotateCcw,
  Layers,
  PenLine,
  CheckCircle2,
  ChevronRight,
  Target,
  Trophy,
  Lock,
  Sparkles,
} from 'lucide-react'
import { getLevelInfo } from '@/lib/constants/levels'
import type { TodayLearningSummary, WordPlanStep } from '@/lib/words/daily-plan'

// 오늘의 단어학습 — 복습 → 새 단어 → 문법 3단계 진행 화면 (홈 카드 / 허브 페이지 공용)

const STEP_PATH: Record<WordPlanStep, string> = {
  FLASHCARD: 'flashcard',
  RECALL: 'recall',
  SPELL: 'spell',
}

type StudyChoice = {
  step: WordPlanStep
  label: string
  description: string
  href: string
  done: boolean
  color: string
}

type StepKey = 'review' | 'words' | 'grammar'

type StepView = {
  key: StepKey
  title: string
  detail: string
  done: boolean
  href: string | null
  cta: string
  color: string
  icon: typeof RotateCcw
  progress: { value: number; total: number } | null
  /** 학습자가 고를 수 있는 학습 방식 (허브 페이지에서만 표시) */
  choices?: StudyChoice[]
}

function pct(value: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.round((value / total) * 100))
}

function buildSteps(summary: TodayLearningSummary): StepView[] {
  const steps: StepView[] = []
  const { plan, grammar } = summary

  if (plan) {
    steps.push({
      key: 'review',
      title: '복습',
      detail:
        plan.reviewTarget === 0
          ? '오늘 복습할 단어가 없어요'
          : `오늘 복습 ${Math.min(plan.reviewedCount, plan.reviewTarget)} / ${plan.reviewTarget}개 · 어려운 단어 먼저`,
      done: plan.reviewDone,
      href: plan.reviewRemaining > 0 ? '/student/words/review?from=daily' : null,
      cta: plan.reviewDone ? '더 복습하기' : '복습하기',
      color: '#7854F7',
      icon: RotateCcw,
      progress: plan.reviewTarget > 0 ? { value: plan.reviewedCount, total: plan.reviewTarget } : null,
    })

    // 플래시카드로 뜻을 익힌 뒤, 리콜(뜻 고르기)·스펠(철자 입력) 중 원하는 방식을 골라 학습한다.
    const setHref = (step: WordPlanStep) =>
      plan.setId ? `/student/words/${plan.setId}/${STEP_PATH[step]}?from=daily` : null
    const choices: StudyChoice[] = plan.setId
      ? [
          { step: 'FLASHCARD', label: '플래시카드', description: '뜻 먼저 익히기', href: setHref('FLASHCARD') ?? '', done: plan.flashcardDone, color: '#7854F7' },
          { step: 'RECALL', label: '리콜 학습', description: '뜻 고르기', href: setHref('RECALL') ?? '', done: plan.recallDone, color: '#1865F2' },
          { step: 'SPELL', label: '스펠 학습', description: '철자 입력하기', href: setHref('SPELL') ?? '', done: plan.spellDone, color: '#1FAF54' },
        ]
      : []
    const choosing = plan.flashcardDone && !plan.recallDone && !plan.spellDone
    steps.push({
      key: 'words',
      title: '새 단어',
      detail:
        plan.newTarget === 0
          ? '이 레벨의 단어를 모두 학습했어요'
          : `${plan.learnedCount} / ${plan.newTarget}개 학습 완료 · ${
              !plan.flashcardDone ? '다음: 플래시카드' : choosing ? '리콜 또는 스펠을 골라 학습하세요' : '학습 완료'
            }`,
      done: plan.newDone,
      // 홈 카드(compact)에서는 다음 단계로 바로 가고, 리콜/스펠 선택이 필요하면 허브에서 고르게 한다.
      href: plan.setId
        ? choosing
          ? '/student/daily-mission'
          : setHref(plan.newDone ? 'FLASHCARD' : (plan.nextStep ?? 'FLASHCARD'))
        : null,
      cta: plan.newDone ? '다시 보기' : !plan.flashcardDone ? '시작하기' : '방식 선택',
      color: '#7854F7',
      icon: Layers,
      progress: plan.newTarget > 0 ? { value: plan.learnedCount, total: plan.newTarget } : null,
      choices,
    })
  }

  if (grammar && grammar.questionCount > 0) {
    steps.push({
      key: 'grammar',
      title: '문법 미션',
      detail: `${grammar.completedMissions} / ${grammar.totalMissions}개 미션 · ${grammar.questionCount}문제`,
      done: grammar.isCompleted,
      href: `/student/missions/${grammar.missionId}`,
      cta: grammar.isCompleted ? '결과 보기' : grammar.completedMissions > 0 ? '이어서 풀기' : '시작하기',
      color: '#1865F2',
      icon: PenLine,
      progress: { value: grammar.completedMissions, total: grammar.totalMissions },
    })
  }

  return steps
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct(value, total)}%`, backgroundColor: color }} />
    </div>
  )
}

function StepRow({ step, index, compact }: { step: StepView; index: number; compact?: boolean }) {
  const Icon = step.icon
  const hasChoices = !compact && !!step.choices && step.choices.length > 0
  const content = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: step.done ? '#1FAF5419' : `${step.color}19` }}
      >
        {step.done ? (
          <CheckCircle2 className="h-5 w-5 text-[#1FAF54]" />
        ) : (
          <Icon className="h-5 w-5" style={{ color: step.color }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">{index + 1}단계</span>
          <p className="truncate text-sm font-bold text-gray-900">{step.title}</p>
          {step.done && (
            <span className="rounded-full bg-[#1FAF54]/10 px-2 py-0.5 text-[10px] font-bold text-[#1FAF54]">완료</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{step.detail}</p>
        {!compact && step.progress && (
          <div className="mt-2">
            <ProgressBar value={step.progress.value} total={step.progress.total} color={step.done ? '#1FAF54' : step.color} />
          </div>
        )}
      </div>
      {step.href && !hasChoices && (
        <span
          className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-bold"
          style={
            step.done
              ? { color: '#21242C', backgroundColor: '#F7F8F9' }
              : { color: '#fff', backgroundColor: step.color }
          }
        >
          {compact ? <ChevronRight className="h-4 w-4" /> : (
            <>
              {step.cta}
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      )}
    </div>
  )

  if (hasChoices && step.choices) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        {content}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {step.choices.map((c) => (
            <Link
              key={c.step}
              href={c.href}
              className="flex min-h-[56px] flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors hover:bg-gray-50"
              style={{ borderColor: c.done ? '#1FAF5466' : `${c.color}40` }}
            >
              <span className="flex items-center gap-1 text-xs font-bold" style={{ color: c.done ? '#1FAF54' : c.color }}>
                {c.done && <CheckCircle2 className="h-3.5 w-3.5" />}
                {c.label}
              </span>
              <span className="mt-0.5 text-[11px] text-gray-500">{c.description}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return step.href ? (
    <Link href={step.href} className="block rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
      {content}
    </Link>
  ) : (
    <div className="rounded-xl border border-gray-200 bg-white p-3">{content}</div>
  )
}

function overallProgress(steps: StepView[]): number {
  if (steps.length === 0) return 0
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100)
}

/** 홈 화면용 요약 카드 */
export function TodayLearningCard({ summary }: { summary: TodayLearningSummary }) {
  const steps = buildSteps(summary)
  if (steps.length === 0) return null
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7854F7]">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">오늘의 단어학습</p>
            <p className="text-xs text-gray-500">
              {summary.isAllComplete ? '오늘 학습을 모두 마쳤어요!' : `${steps.length}단계 중 ${doneCount}단계 완료`}
              {summary.todayPoints > 0 && ` · 오늘 ${summary.todayPoints}P`}
            </p>
          </div>
        </div>
        <Link href="/student/daily-mission" className="flex min-h-[44px] items-center gap-1 text-xs font-semibold text-[#1865F2]">
          전체 보기
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mb-4">
        <ProgressBar value={overallProgress(steps)} total={100} color={summary.isAllComplete ? '#1FAF54' : '#7854F7'} />
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <StepRow key={step.key} step={step} index={i} compact />
        ))}
      </div>
    </div>
  )
}

/** 오늘의 단어학습 허브 페이지 본문 */
export function TodayLearningHub({
  summary,
  canUseWords,
  bonusXp,
}: {
  summary: TodayLearningSummary
  canUseWords: boolean
  bonusXp: number
}) {
  const steps = buildSteps(summary)
  const goal = summary.levelGoal
  const bandInfo = goal ? getLevelInfo(goal.band) : null

  return (
    <div className="space-y-5">
      {/* 오늘 진행 요약 */}
      <div
        className="rounded-xl border p-5"
        style={
          summary.isAllComplete
            ? { borderColor: '#1FAF5440', backgroundColor: '#1FAF540D' }
            : { borderColor: '#DDD6FE', backgroundColor: '#F3F0FF' }
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {summary.isAllComplete ? '🎉 오늘의 학습 완료!' : '오늘의 목표를 끝까지 달성해요'}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {summary.isAllComplete
                ? '내일도 새로운 단어와 문법이 준비돼요'
                : `모두 마치면 보너스 ${bonusXp}P와 연속 학습일이 올라가요`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900">{summary.todayPoints}P</p>
            <p className="text-[11px] text-gray-500">오늘 획득</p>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={overallProgress(steps)} total={100} color={summary.isAllComplete ? '#1FAF54' : '#7854F7'} />
        </div>
      </div>

      {/* 3단계 */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <StepRow key={step.key} step={step} index={i} />
        ))}
      </div>

      {!canUseWords && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">단어학습은 구독 학원에서 이용할 수 있어요</p>
            <p className="mt-0.5 text-xs text-gray-500">학원 원장님께 문의하세요. 문법 미션은 지금 바로 풀 수 있어요.</p>
          </div>
        </div>
      )}

      {/* 레벨 단어 목표 */}
      {goal && bandInfo && goal.totalWords > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7854F7]" />
            <p className="text-sm font-bold text-gray-900">
              {bandInfo.cefr} 레벨 단어 목표
            </p>
          </div>
          <div className="mb-2 flex items-end justify-between">
            <p className="text-2xl font-black text-gray-900">
              {goal.learnedWords.toLocaleString()}
              <span className="text-sm font-semibold text-gray-500"> / {goal.totalWords.toLocaleString()}개</span>
            </p>
            <p className="text-xs text-gray-500">마스터 {goal.masteredWords.toLocaleString()}개</p>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#7854F7]/40" style={{ width: `${pct(goal.learnedWords, goal.totalWords)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#1FAF54]" style={{ width: `${pct(goal.masteredWords, goal.totalWords)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#7854F7]/40" />학습 완료</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#1FAF54]" />마스터 (3번 이상 복습 정답)</span>
            {goal.daysToGoal !== null && goal.daysToGoal > 0 && <span>매일 학습하면 약 {goal.daysToGoal}일 후 목표 달성</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/student/ranking"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 hover:border-gray-300"
        >
          <Trophy className="h-4 w-4 text-[#FFB100]" />
          랭킹 보기
        </Link>
        <Link
          href="/student/words/report"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 hover:border-gray-300"
        >
          <Layers className="h-4 w-4 text-[#7854F7]" />
          내 학습 리포트
        </Link>
      </div>
    </div>
  )
}
