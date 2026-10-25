// 단원 풀이 중간값 localStorage 백업 — 새로고침·중간 이탈 후 이어 풀기
//
// 문항 세트(id 목록)가 같을 때만 복원한다. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 조용히 넘어간다.

export interface BackupAnswer {
  answer: string
  /** 연습: 즉시 채점 결과 (확인 테스트는 채점 전이라 없음) */
  isCorrect?: boolean
  correctAnswer?: string
  explanation?: string | null
}

interface BackupData {
  ids: string[]
  answers: Record<string, BackupAnswer>
  savedAt: number
}

/** 백업 유지 기간 — 오래된 풀이는 버린다 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function backupKey(studentId: string, code: string, kind: 'practice' | 'check'): string {
  return `grammar-unit:${studentId}:${code}:${kind}`
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function readBackup(key: string, ids: string[]): Record<string, BackupAnswer> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const data = JSON.parse(raw) as Partial<BackupData>
    if (!Array.isArray(data.ids) || !data.answers || typeof data.answers !== 'object') return {}
    if (typeof data.savedAt !== 'number' || Date.now() - data.savedAt > MAX_AGE_MS) return {}
    if (!sameIds(data.ids, ids)) return {}
    return data.answers
  } catch {
    return {}
  }
}

export function writeBackup(key: string, ids: string[], answers: Record<string, BackupAnswer>): void {
  try {
    const data: BackupData = { ids, answers, savedAt: Date.now() }
    window.localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // 저장 공간 부족·차단 — 백업 없이 계속
  }
}

export function clearBackup(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 무시
  }
}
