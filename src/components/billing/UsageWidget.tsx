'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface UsageItem {
  used: number
  limit: number
  remainingFree: number
  creditBalance: number
  isOverLimit: boolean
}

interface StorageItem {
  usedMb: number
  limitMb: number
  percent: number
}

interface UsageData {
  aiWriting: UsageItem
  aiQuestion: UsageItem
  storage: StorageItem
  students: { count: number; limit: number }
  periodStart: string
  periodEnd: string
}

function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-[#D92916]'
  if (percent >= 90) return 'bg-[#E35C20]'
  if (percent >= 70) return 'bg-[#FFB100]'
  return 'bg-[#1865F2]'
}

function UsageBar({
  label,
  used,
  limit,
  creditBalance,
  isOverLimit,
  unit = '회',
}: {
  label: string
  used: number
  limit: number
  creditBalance: number
  isOverLimit: boolean
  unit?: string
}) {
  const percent = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0
  const barColor = getBarColor(isOverLimit ? 100 : percent)
  const limitText = limit === -1 ? '무제한' : `${limit.toLocaleString()}${unit}`

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="text-gray-500">
          {used.toLocaleString()} / {limitText}
          {creditBalance > 0 && (
            <span className="ml-1 text-[#7854F7]">+{creditBalance.toLocaleString()} 크레딧</span>
          )}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {limit !== -1 && (
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        )}
        {limit === -1 && <div className="h-full rounded-full bg-[#1865F2] w-full opacity-20" />}
      </div>
      {isOverLimit && (
        <p className="text-xs text-[#D92916]">한도 초과 — 초과 사용량이 청구됩니다</p>
      )}
    </div>
  )
}

export function UsageWidget() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/usage/check')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && !json.error) setData(json as UsageData)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-24" />
        <div className="h-2 bg-gray-100 rounded" />
        <div className="h-2 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!data) return null

  const writingPercent =
    data.aiWriting.limit > 0
      ? Math.round((data.aiWriting.used / data.aiWriting.limit) * 100)
      : 0
  const questionPercent =
    data.aiQuestion.limit > 0
      ? Math.round((data.aiQuestion.used / data.aiQuestion.limit) * 100)
      : 0

  const anyOverLimit = data.aiWriting.isOverLimit || data.aiQuestion.isOverLimit
  const anyNearLimit = writingPercent >= 90 || questionPercent >= 90

  const periodEnd = new Date(data.periodEnd)
  const periodEndStr = `${periodEnd.getMonth() + 1}월 ${periodEnd.getDate()}일`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">이번 달 AI 사용량</h3>
        <span className="text-xs text-gray-400">{periodEndStr} 초기화</span>
      </div>

      <div className="space-y-3">
        <UsageBar
          label="AI 쓰기 평가"
          used={data.aiWriting.used}
          limit={data.aiWriting.limit}
          creditBalance={data.aiWriting.creditBalance}
          isOverLimit={data.aiWriting.isOverLimit}
        />
        <UsageBar
          label="AI 문제 생성"
          used={data.aiQuestion.used}
          limit={data.aiQuestion.limit}
          creditBalance={data.aiQuestion.creditBalance}
          isOverLimit={data.aiQuestion.isOverLimit}
        />
        <UsageBar
          label="스토리지"
          used={data.storage.usedMb}
          limit={data.storage.limitMb}
          creditBalance={0}
          isOverLimit={data.storage.percent >= 100}
          unit="MB"
        />
      </div>

      {(anyOverLimit || anyNearLimit) && (
        <div className="flex gap-2 pt-1">
          <Link
            href="/owner/billing/credits"
            className="flex-1 text-center py-2 rounded-lg text-sm font-medium bg-[#7854F7] text-white hover:bg-[#6644e6] transition-colors"
          >
            크레딧 충전
          </Link>
          <Link
            href="/owner/billing"
            className="flex-1 text-center py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            업그레이드
          </Link>
        </div>
      )}
    </div>
  )
}
