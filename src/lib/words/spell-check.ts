import 'server-only'

export interface SpellCheckResult {
  correct: boolean
  nearlyCorrect: boolean // 편집거리 1 (질 4)
  normalized: {
    answer: string
    term: string
  }
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\W]/g, '')
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function checkSpelling(term: string, userAnswer: string): SpellCheckResult {
  const normAnswer = normalize(userAnswer)
  const normTerm = normalize(term)
  const correct = normAnswer === normTerm
  const nearlyCorrect = !correct && editDistance(normAnswer, normTerm) === 1

  return { correct, nearlyCorrect, normalized: { answer: normAnswer, term: normTerm } }
}
