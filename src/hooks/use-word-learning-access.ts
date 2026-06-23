'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/hooks/use-user'

type AccessDeniedReason = 'FREE_TIER' | 'NO_SUBSCRIPTION' | null

interface WordLearningAccess {
  canAccess: boolean
  reason: AccessDeniedReason
  loading: boolean
}

export function useWordLearningAccess(): WordLearningAccess {
  const { user, loading: userLoading } = useUser()
  const [state, setState] = useState<WordLearningAccess>({
    canAccess: false,
    reason: null,
    loading: true,
  })

  useEffect(() => {
    if (userLoading) return

    if (!user?.academyId) {
      setState({ canAccess: false, reason: 'NO_SUBSCRIPTION', loading: false })
      return
    }

    fetch(`/api/words/access?academyId=${encodeURIComponent(user.academyId)}`)
      .then((res) => res.json())
      .then((data: { canAccess: boolean; reason: AccessDeniedReason }) => {
        setState({ canAccess: data.canAccess, reason: data.reason, loading: false })
      })
      .catch(() => {
        setState({ canAccess: false, reason: 'NO_SUBSCRIPTION', loading: false })
      })
  }, [user, userLoading])

  return state
}
