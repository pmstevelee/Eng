'use client'

// AI 태깅 실행 — 서버 시간 제한 때문에 50개씩 나눠 반복 호출하고, 남은 문항이 0이 되거나 멈추면 끝낸다.
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Loader2, Sparkles, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { acceptHighConfidenceSuggestions, runGrammarTaggingBatch } from '../../question-actions'

type Message = { kind: 'ok' | 'error'; text: string } | null

export function TaggingRunner({ remaining, highCount, highPercent }: { remaining: number; highCount: number; highPercent: number }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ processed: number; suggested: number; remaining: number } | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [accepting, startAccept] = useTransition()
  const stopRef = useRef(false)

  async function run() {
    stopRef.current = false
    setRunning(true)
    setMessage(null)
    let processed = 0
    let suggested = 0
    let left = remaining
    try {
      while (!stopRef.current) {
        const res = await runGrammarTaggingBatch()
        if (!res.ok) {
          setMessage({ kind: 'error', text: res.error })
          break
        }
        processed += res.processed
        suggested += res.suggested
        left = res.remaining
        setProgress({ processed, suggested, remaining: left })
        if (res.processed === 0 || left === 0) break
      }
      if (processed > 0) {
        setMessage({
          kind: 'ok',
          text: `${processed.toLocaleString()}개 문항을 분류했습니다 (포인트 제안 ${suggested.toLocaleString()}개).${left > 0 ? ` 남은 문항 ${left.toLocaleString()}개.` : ''}`,
        })
      }
    } catch {
      setMessage({ kind: 'error', text: '태깅 중 연결이 끊겼습니다. 다시 시작하면 남은 문항부터 이어서 처리합니다.' })
    } finally {
      setRunning(false)
      router.refresh()
    }
  }

  function acceptHigh() {
    if (!window.confirm(`확신도 ${highPercent}% 이상 제안 ${highCount.toLocaleString()}개를 모두 확정할까요?`)) return
    setMessage(null)
    startAccept(async () => {
      const res = await acceptHighConfidenceSuggestions()
      setMessage(res.ok ? { kind: 'ok', text: `${res.count.toLocaleString()}개 문항을 포인트에 연결했습니다.` } : { kind: 'error', text: res.error })
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => (stopRef.current = true)}>
            <Square className="mr-1.5 h-4 w-4" />
            이번 묶음 끝나면 멈추기
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-[44px] bg-[#1865F2] hover:bg-[#1453c8]"
            disabled={remaining === 0 || accepting}
            onClick={run}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {remaining === 0 ? '태깅할 문항 없음' : `AI 태깅 시작 (남은 ${remaining.toLocaleString()}개)`}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={highCount === 0 || running || accepting}
          onClick={acceptHigh}
        >
          {accepting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
          확신도 {highPercent}% 이상 {highCount.toLocaleString()}개 일괄 확정
        </Button>
      </div>

      {running && (
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-[#1865F2]" />
          50개씩 분류하는 중…
          {progress && ` ${progress.processed.toLocaleString()}개 완료, 남은 ${progress.remaining.toLocaleString()}개`}
        </p>
      )}
      {message && (
        <p className={message.kind === 'ok' ? 'text-sm text-[#15803D]' : 'text-sm text-[#D92916]'} role="status">
          {message.text}
        </p>
      )}
      <p className="text-xs text-gray-500">
        AI 제안은 바로 저장되지 않고 아래 목록에서 확정해야 문항에 연결됩니다. 문법 문항이 아니거나 맞는 포인트가 없으면
        &ldquo;해당 없음&rdquo;으로 처리하세요 (다시 태깅하지 않습니다).
      </p>
    </div>
  )
}
