import { scoreToLevel, getLevelInfo } from '@/lib/constants/levels'

export { scoreToLevel }

export function calcLevelFromScore(avgScore: number): number {
  return scoreToLevel(avgScore)
}

export function levelLabel(level: number): string {
  return getLevelInfo(level).nameKo
}
