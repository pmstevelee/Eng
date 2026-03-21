'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Award, Lock, CheckCircle2 } from 'lucide-react'

type Badge = {
  id: string
  code: string | null
  name: string
  description: string | null
  iconUrl: string | null
  createdAt: Date
}

type BadgeEarning = {
  id: string
  badgeId: string
  earnedAt: Date
  badge: Badge
}

interface Props {
  allBadges: Badge[]
  badgeEarnings: BadgeEarning[]
}

// Badge category groups
const BADGE_GROUPS = [
  {
    label: '🔥 연속 학습',
    codes: ['STREAK_3', 'STREAK_7', 'STREAK_14', 'STREAK_30', 'STREAK_100'],
  },
  {
    label: '🏆 테스트 성취',
    codes: ['FIRST_TEST', 'PERFECT_SCORE', 'SPEED_DEMON'],
  },
  {
    label: '📈 성장',
    codes: ['LEVEL_UP', 'MASTER'],
  },
  {
    label: '🎯 미션 & 목표',
    codes: ['WEEKLY_GOAL', 'MISSION_COMPLETE'],
  },
]

const BADGE_BG: Record<string, string> = {
  STREAK_3: 'from-orange-400 to-red-400',
  STREAK_7: 'from-yellow-400 to-orange-400',
  STREAK_14: 'from-purple-400 to-pink-400',
  STREAK_30: 'from-blue-400 to-indigo-500',
  STREAK_100: 'from-amber-400 to-yellow-300',
  FIRST_TEST: 'from-teal-400 to-cyan-400',
  PERFECT_SCORE: 'from-green-400 to-emerald-500',
  SPEED_DEMON: 'from-blue-500 to-violet-500',
  LEVEL_UP: 'from-indigo-400 to-blue-500',
  MASTER: 'from-amber-500 to-yellow-400',
  WEEKLY_GOAL: 'from-pink-400 to-rose-400',
  MISSION_COMPLETE: 'from-green-500 to-teal-400',
}

export function BadgesClient({ allBadges, badgeEarnings }: Props) {
  const searchParams = useSearchParams()
  const newBadgeCode = searchParams.get('new')
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationBadge, setCelebrationBadge] = useState<Badge | null>(null)
  const confettiRef = useRef<HTMLDivElement>(null)

  const earnedMap = new Map(badgeEarnings.map((e) => [e.badge.code ?? '', e]))

  useEffect(() => {
    if (newBadgeCode) {
      const badge = allBadges.find((b) => b.code === newBadgeCode)
      if (badge) {
        setCelebrationBadge(badge)
        setShowCelebration(true)
        const t = setTimeout(() => setShowCelebration(false), 4000)
        return () => clearTimeout(t)
      }
    }
  }, [newBadgeCode, allBadges])

  const earned = badgeEarnings.length
  const total = allBadges.length

  return (
    <>
      {/* Celebration overlay */}
      {showCelebration && celebrationBadge && (
        <CelebrationOverlay badge={celebrationBadge} onClose={() => setShowCelebration(false)} />
      )}

      {/* Progress summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-[#FFB100]/10 flex items-center justify-center flex-shrink-0">
          <Award size={28} className="text-[#FFB100]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-1">총 배지 달성</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{earned}</span>
            <span className="text-gray-400">/ {total}</span>
          </div>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[#FFB100] transition-all duration-700"
              style={{ width: `${total > 0 ? (earned / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Badge groups */}
      <div className="space-y-6" ref={confettiRef}>
        {BADGE_GROUPS.map((group) => {
          const groupBadges = group.codes
            .map((code) => allBadges.find((b) => b.code === code))
            .filter(Boolean) as Badge[]

          if (groupBadges.length === 0) return null

          return (
            <div key={group.label}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupBadges.map((badge) => {
                  const earning = earnedMap.get(badge.code ?? '')
                  return (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      earning={earning}
                      isNew={badge.code === newBadgeCode}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Badge Card ───────────────────────────────────────────────────────────────

function BadgeCard({
  badge,
  earning,
  isNew,
}: {
  badge: Badge
  earning: BadgeEarning | undefined
  isNew: boolean
}) {
  const earned = !!earning
  const bgGradient = BADGE_BG[badge.code ?? ''] ?? 'from-gray-300 to-gray-400'

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col items-center gap-2.5 text-center transition-all ${
        earned
          ? 'border-transparent bg-white shadow-sm hover:shadow-md'
          : 'border-gray-200 bg-gray-50 opacity-60'
      } ${isNew ? 'ring-2 ring-[#FFB100] ring-offset-2' : ''}`}
    >
      {/* Badge icon */}
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
          earned ? `bg-gradient-to-br ${bgGradient}` : 'bg-gray-200'
        }`}
      >
        {earned ? (badge.iconUrl ?? '🏅') : <Lock size={20} className="text-gray-400" />}
      </div>

      {/* Info */}
      <div className="min-w-0 w-full">
        <p className={`text-sm font-bold truncate ${earned ? 'text-gray-900' : 'text-gray-400'}`}>
          {badge.name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
          {badge.description}
        </p>
      </div>

      {/* Earned date */}
      {earning && (
        <p className="text-xs text-[#1FAF54] font-medium">
          {new Date(earning.earnedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 획득
        </p>
      )}

      {/* NEW badge indicator */}
      {isNew && (
        <span className="absolute -top-2 -right-2 bg-[#FFB100] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          NEW
        </span>
      )}

      {/* Earned checkmark */}
      {earned && !isNew && (
        <CheckCircle2 size={14} className="absolute top-2 right-2 text-[#1FAF54]" />
      )}
    </div>
  )
}

// ─── Celebration overlay with confetti ───────────────────────────────────────

function CelebrationOverlay({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  const bgGradient = BADGE_BG[badge.code ?? ''] ?? 'from-blue-400 to-indigo-500'

  // Generate confetti pieces
  const confetti = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    duration: `${1.5 + Math.random() * 1.5}s`,
    color: ['#1865F2', '#FFB100', '#1FAF54', '#7854F7', '#E35C20', '#0FBFAD'][i % 6],
    size: `${6 + Math.random() * 8}px`,
    rotation: `${Math.random() * 360}deg`,
  }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute top-0"
            style={{
              left: c.left,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              transform: `rotate(${c.rotation})`,
              animation: `confettiFall ${c.duration} ${c.delay} ease-in forwards`,
            }}
          />
        ))}
      </div>

      {/* Badge celebration card */}
      <div
        className="relative bg-white rounded-2xl p-8 flex flex-col items-center gap-4 mx-6 max-w-xs w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl animate-bounce">🎉</div>

        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl bg-gradient-to-br ${bgGradient} shadow-lg`}
        >
          {badge.iconUrl ?? '🏅'}
        </div>

        <div className="text-center">
          <p className="text-xs font-medium text-[#FFB100] uppercase tracking-wider mb-1">
            새 배지 획득!
          </p>
          <h3 className="text-xl font-bold text-gray-900">{badge.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{badge.description}</p>
        </div>

        <button
          onClick={onClose}
          className="mt-2 px-6 py-2.5 bg-[#1865F2] text-white text-sm font-bold rounded-xl hover:bg-[#1558d6] transition-colors min-h-[44px] w-full"
        >
          확인
        </button>
      </div>

      {/* Confetti keyframes injected inline */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
