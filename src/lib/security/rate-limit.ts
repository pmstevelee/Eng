// 인메모리 rate limiter — 단일 인스턴스(Vercel serverless)에서 동작
// 분산 환경이 필요하면 @upstash/ratelimit으로 교체

interface RateLimitStore {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitStore>()

interface RateLimitOptions {
  /** 윈도우 크기 (ms). 기본 60_000 (1분) */
  windowMs?: number
  /** 윈도우 내 최대 요청 수. 기본 30 */
  max?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 30
  const now = Date.now()

  let entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return { allowed: true, remaining: max - 1, resetAt: entry.resetAt }
  }

  entry.count++
  const allowed = entry.count <= max
  return { allowed, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt }
}

// 오래된 항목 주기적 정리 (메모리 누수 방지)
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of Array.from(store)) {
        if (entry.resetAt <= now) store.delete(key)
      }
    },
    5 * 60 * 1000,
  )
}
