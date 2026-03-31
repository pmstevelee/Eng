import Link from 'next/link'
import { Target, CheckCircle2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MissionItemStatus = 'AVAILABLE' | 'LOCKED' | 'COMPLETED' | 'IN_PROGRESS'

type MissionItem = {
  id: string
  type: string
  title: string
  domain: string | null
  questionIds: string[]
  questionCount: number
  xpReward: number
  order: number
  reason: string
  status: MissionItemStatus
  correctCount: number
  completedAt: string | null
}

type MissionData = {
  id: string
  status: string
  missionsJson: unknown
  totalMissions: number
  completedMissions: number
  xpEarned: number
  isCompleted: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, { label: string; color: string }> = {
  GRAMMAR: { label: 'Grammar', color: '#1865F2' },
  VOCABULARY: { label: 'Vocabulary', color: '#7854F7' },
  READING: { label: 'Reading', color: '#0FBFAD' },
  WRITING: { label: 'Writing', color: '#E35C20' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DailyMissionCard({ mission }: { mission: MissionData }) {
  const items = Array.isArray(mission.missionsJson)
    ? (mission.missionsJson as MissionItem[])
    : []

  const isAllDone =
    mission.isCompleted ||
    (mission.totalMissions > 0 && mission.completedMissions >= mission.totalMissions)

  if (isAllDone) {
    return (
      <div className="rounded-xl border-2 border-[#1FAF54] bg-green-50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1FAF54]">
            <CheckCircle2 size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900">오늘의 학습 미션</span>
          <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-[#7854F7]">
            AI 추천
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#1FAF54] bg-white/70 p-4">
          <span className="text-2xl">🎉</span>
          <div className="flex-1">
            <p className="font-bold text-[#1FAF54]">오늘의 미션 완료!</p>
            <p className="text-sm text-gray-600">총 +{mission.xpEarned} XP 획득</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/student/missions"
              className="rounded-lg bg-[#1FAF54] px-3 py-2 text-xs font-bold text-white hover:bg-[#179045]"
            >
              추가 학습하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-[#7854F7] bg-purple-50/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#7854F7]">
            <Target size={16} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">오늘의 학습 미션</span>
            <span className="ml-2 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-[#7854F7]">
              AI 추천
            </span>
          </div>
        </div>
        {mission.totalMissions > 0 && (
          <span className="text-xs text-gray-500">
            {mission.completedMissions}/{mission.totalMissions} 완료
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const domainCfg = item.domain ? DOMAIN_CONFIG[item.domain] : null
            return <MissionItemRow key={item.id} item={item} idx={idx} domainCfg={domainCfg} missionId={mission.id} />
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-white/70 p-4">
          <p className="text-sm text-gray-500">미션 정보를 불러오는 중...</p>
        </div>
      )}
    </div>
  )
}

// ─── Row sub-component ────────────────────────────────────────────────────────

function MissionItemRow({
  item,
  idx,
  domainCfg,
  missionId,
}: {
  item: MissionItem
  idx: number
  domainCfg: { label: string; color: string } | null
  missionId: string
}) {
  if (item.status === 'COMPLETED') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-green-100 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">✅</span>
          <span className="text-sm font-medium text-gray-400 line-through">
            {idx + 1}. {item.title}
          </span>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          <span className="text-xs font-bold text-[#1FAF54]">✓ +{item.xpReward} XP 획득</span>
          <span className="text-[10px] text-gray-400">
            {item.correctCount}/{item.questionCount} 정답
          </span>
        </div>
      </div>
    )
  }

  if (item.status === 'LOCKED') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/60 px-4 py-3 opacity-60">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">🔒</span>
          <span className="text-sm font-medium text-gray-400">
            {idx + 1}. {item.title}
          </span>
          {domainCfg && (
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: domainCfg.color }}
            >
              {domainCfg.label}
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-[10px] text-gray-400">이전 미션을 완료하면 열립니다</span>
      </div>
    )
  }

  if (item.status === 'IN_PROGRESS') {
    return (
      <div className="rounded-xl border border-[#7854F7]/30 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-base">◐</span>
            <span className="text-sm font-bold text-gray-800">
              {idx + 1}. {item.title}
            </span>
          </div>
          <Link
            href={`/student/missions/${missionId}?m=${idx}`}
            className="flex min-h-[32px] flex-shrink-0 items-center gap-1 rounded-lg bg-[#7854F7] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6644e0]"
          >
            계속하기 →
          </Link>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {item.questionCount}문제 진행 중
        </p>
      </div>
    )
  }

  // AVAILABLE
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex-shrink-0 text-xs font-medium text-gray-400">{idx + 1}.</span>
          <span className="truncate text-sm font-bold text-gray-800">{item.title}</span>
          {domainCfg && (
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: domainCfg.color }}
            >
              {domainCfg.label}
            </span>
          )}
        </div>
        <Link
          href={`/student/missions/${missionId}?m=${idx}`}
          className="flex min-h-[32px] flex-shrink-0 items-center gap-1 rounded-lg bg-[#7854F7] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6644e0]"
        >
          풀기 →
        </Link>
      </div>
      {item.reason && (
        <p className="mt-1 truncate text-xs text-gray-500">"{item.reason}"</p>
      )}
      <p className="mt-1 text-xs text-gray-400">
        문제 {item.questionCount}개 · +{item.xpReward} XP
      </p>
    </div>
  )
}
