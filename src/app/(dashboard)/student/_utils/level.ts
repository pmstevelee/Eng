export function calcLevelFromScore(avgScore: number): number {
  if (avgScore >= 95) return 7
  if (avgScore >= 85) return 6
  if (avgScore >= 75) return 5
  if (avgScore >= 65) return 4
  if (avgScore >= 55) return 3
  if (avgScore >= 40) return 2
  return 1
}

export function levelLabel(level: number): string {
  const labels = ['', 'A1 초급', 'A2 기초', 'B1 중하', 'B1 중급', 'B2 중상', 'C1 고급', 'C2 마스터']
  return labels[level] ?? `Level ${level}`
}
