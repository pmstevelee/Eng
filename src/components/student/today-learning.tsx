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

const STEP_LABEL: Record<WordPlanStep, string> = {
  FLASHCARD: '플래시카드',
  RECALL: '뜻 고르기',
  SPELL: '스펠링',
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

    const nextStep = plan.nextStep ?? (plan.newDone ? 'FLASHCARD' : 'SPELL')
    steps.push({
      key: 'words',
      title: '새 단어',
      detail:
        plan.newTarget === 0
          ? '이 레벨의 단어를 모두 학습했어요'
          : `${plan.learnedCount} / ${plan.newTarget}개 학습 완료 · ${plan.nextStep ? `다음: ${STEP_LABEL[plan.nextStep]}` : '모든 단계 완료'}`,
      done: plan.newDone,
      href: plan.setId ? `/student/words/${plan.setId}/${STEP_PATH[nextStep]}?from=daily` : null,
      cta: plan.newDone ? '다시 보기' : plan.nextStep === 'FLASHCARD' ? '시작하기' : '이어서 학습',
      color: '#7854F7',
      icon: Layers,
      progress: plan.newTarget > 0 ? { value: plan.learnedCount, total: plan.newTarget } : null,
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
      {step.href && (
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
