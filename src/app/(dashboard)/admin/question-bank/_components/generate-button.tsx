'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateQuestionsForGaps } from '../actions'

type GeneratedResult = {
  domain: string
  difficulty: number
  generated: number
  error?: string
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

export default function GenerateButton() {
  const [pending, startTransition] = useTransition()
  const [results, setResults] = useState<GeneratedResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleGenerate() {
    setResults(null)
    setError(null)
    startTransition(async () => {
      const res = await generateQuestionsForGaps(10)
      if (res.error) {
        setError(res.error)
      } else {
        setResults(res.results)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={handleGenerate}
        disabled={pending}
        className="h-11 bg-[#7854F7] hover:bg-[#6644e6] text-white gap-2"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            AI 문제 생성 중...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            부족한 영역 문제 자동 생성
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-green-700 mb-1.5">생성 완료</p>
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-green-700">
              {r.error ? (
                <AlertCircle size={12} className="text-red-500 shrink-0" />
              ) : (
                <CheckCircle size={12} className="shrink-0" />
              )}
              <span>
                {DOMAIN_LABEL[r.domain] ?? r.domain} Lv{r.difficulty}:
                {r.error ? ` 오류 (${r.error})` : ` +${r.generated}개 추가`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
