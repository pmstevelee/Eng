'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  saveWordStudySession,
  clearWordStudySession,
} from '@/app/(dashboard)/student/words/_actions/study-session'
import {
  parseStudySessionState,
  pickLatestStudySession,
  type StudySessionState,
  type StudyStage,
} from '@/lib/words/study-session'
import { todayKst } from '@/lib/attendance/time'

// 서버 저장은 답안 기록 요청에 실려 순서대로 나가므로, 답하자마자 화면을 떠나면
// 마지막 진행이 서버에 닿기 전일 수 있다 → 브라우저에도 즉시 백업해 두고
// 다시 들어올 때 서버 기록과 비교해 더 최근 것을 쓴다.

const localKey = (setId: string, stage: StudyStage) => `word-study:${setId}:${stage}`

function readLocal(setId: string, stage: StudyStage): StudySessionState | null {
  try {
    const raw = window.localStorage.getItem(localKey(setId, stage))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { date?: unknown; state?: unknown }
    if (parsed.date !== todayKst()) return null
    return parseStudySessionState(parsed.state)
  } catch {
    return null
  }
}

function writeLocal(setId: string, stage: StudyStage, state: StudySessionState | null) {
  try {
    if (state) {
      window.localStorage.setItem(localKey(setId, stage), JSON.stringify({ date: todayKst(), state }))
    } else {
      window.localStorage.removeItem(localKey(setId, stage))
    }
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)은 서버 기록만 사용
  }
}

/**
 * 이어서 학습할 진행 상태 (서버 기록 vs 브라우저 백업 중 최신).
 * 브라우저 저장소는 마운트 후에만 읽을 수 있어, 확인 전에는 undefined를 돌려준다.
 */
export function useSavedStudySession(
  setId: string,
  stage: StudyStage,
  server: StudySessionState | null,
): StudySessionState | null | undefined {
  const [saved, setSaved] = useState<StudySessionState | null | undefined>(undefined)
  useEffect(() => {
    const local = readLocal(setId, stage)
    const latest = pickLatestStudySession(server, local)
    // 서버에 닿지 못한 최신 진행은 서버에도 올려 다른 기기·세트 화면과 맞춘다
    if (latest && latest === local) {
      void saveWordStudySession({ setId, stage, state: latest }).catch(() => undefined)
    }
    setSaved(latest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return saved
}

/**
 * 단어 학습 단계 진행 상태 저장기.
 * - backup: 답안 기록 요청에 실어 보낸 진행을 브라우저에도 즉시 백업
 * - save/clear: 서버 저장·삭제 요청을 순서대로 이어 붙여 이전 요청이 최신 상태를 덮어쓰지 않게 한다
 */
export function useStudySessionSaver(setId: string, stage: StudyStage) {
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())

  const enqueue = useCallback((task: () => Promise<unknown>) => {
    chainRef.current = chainRef.current.then(task).catch(() => undefined)
  }, [])

  const backup = useCallback(
    (state: StudySessionState) => writeLocal(setId, stage, state),
    [setId, stage],
  )

  const save = useCallback(
    (state: StudySessionState) => {
      writeLocal(setId, stage, state)
      enqueue(() => saveWordStudySession({ setId, stage, state }))
    },
    [enqueue, setId, stage],
  )

  const clear = useCallback(() => {
    writeLocal(setId, stage, null)
    enqueue(() => clearWordStudySession({ setId, stage }))
  }, [enqueue, setId, stage])

  return { backup, save, clear }
}
