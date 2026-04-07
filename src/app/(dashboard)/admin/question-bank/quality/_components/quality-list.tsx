'use client'

import { useState, useTransition } from 'react'
import { Loader2, EyeOff, Wand2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deactivateLowQuality, autoCorrectDifficulties } from '../actions'
import type { LowQualityQuestion } from '../actions'

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const RECOMMENDATION_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  increase_difficulty: { text: '난이도 상향 권고', color: '#FFB100', bg: '#FFF8E6' },
  decrease_difficulty: { text: '난이도 하향 권고', color: '#1865F2', bg: '#EEF4FF' },
  low_quality: { text: '비활성화 권고', color: '#D92916', bg: '#FEF2F0' },
}

type CorrectionResult = {
  id: string
  domain: string
  oldDifficulty: number
  newDifficulty: number
}

export default function QualityList({ questions }: { questions: LowQualityQuestion[] }) {
  const [list, setList] = useState(questions)
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<CorrectionResult[] | null>(null)
  const [correcting, startCorrecting] = useTransition()

  function handleDeactivate(id: string) {
    setActionId(id)
    startTransition(async () => {
      const res = await deactivateLowQuality(id)
      if (!res.error) {
        setList((prev) => prev.filter((q) => q.id !== id))
      }
      setActionId(null)
    })
  }

  function handleAutoCorrect() {
    setCorrections(null)
    startCorrecting(async () => {
      const res = await autoCorrectDifficulties()
      if (!res.error) {
        setCorrections(res.corrections)
        // 보정된 난이도 반영
        setList((prev) =>
          prev.map((q) => {
            const fix = res.corrections.find((c) => c.id === q.id)
            return fix ? { ...q, difficulty: fix.newDifficulty } : q
          }),
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* 자동 보정 버튼 */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleAutoCorrect}
          disabled={correcting}
          variant="outline"
          className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          {correcting ? (
            <><Loader2 size={15} className="animate-spin" /> 보정 실행 중...</>
          ) : (
            <><Wand2 size={15} /> 난이도 자동 보정 실행</>
          )}
        </Button>
        <span className="text-xs text-gray-400">
          정답률이 극단적인 문제(5% 이하 또는 95% 이상)의 난이도를 ±1 자동 보정합니다.
        </span>
      </div>

      {corrections !== null && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-700 mb-2">
            <CheckCircle size={14} />
            {corrections.length}개 문제 난이도 보정 완료
          </div>
          {corrections.slice(0, 5).map((c, i) => (
            <p key={i} className="text-xs text-purple-600">
              {DOMAIN_LABEL[c.domain] ?? c.domain} — Lv{c.oldDifficulty} → Lv{c.newDifficulty}
            </p>
          ))}
          {corrections.length > 5 && (
            <p className="text-xs text-purple-400 mt-1">외 {corrections.length - 5}개...</p>
          )}
        </div>
      )}

      {/* 문제 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          품질 개선 필요 문제 ({list.length}개)
        </div>

        {list.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">모든 문제가 양호합니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((q) => {
              const rec = RECOMMENDATION_LABEL[q.recommendation ?? 'low_quality']
              const isLoading = actionId === q.id && pending

              return (
                <div key={q.id} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: DOMAIN_COLOR[q.domain] }}
                      >
                        {DOMAIN_LABEL[q.domain]}
                      </span>
                      <span className="text-xs text-gray-500">Lv{q.difficulty}</span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: rec.bg, color: rec.color }}
                      >
                        {rec.text}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{q.questionText}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {q.qualityScore !== null && (
                        <span>품질 {q.qualityScore.toFixed(2)}</span>
                      )}
                      {q.correctRate !== null && (
                        <span>정답률 {(q.correctRate * 100).toFixed(1)}%</span>
                      )}
                      <span>사용 {q.usageCount}회</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isLoading ? (
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    ) : (
                      <button
                        onClick={() => handleDeactivate(q.id)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <EyeOff size={12} />
                        비활성화
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
