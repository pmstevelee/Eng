'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types'

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // /api/profile 이 서버에서 인증(캐시 적용)을 확인하므로
    // 클라이언트에서 auth.getUser() 네트워크 왕복을 한 번 더 할 필요가 없다.
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const profile = await res.json()
          setUser(profile)
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setLoading(true)
      fetchProfile()
    })

    return () => subscription.unsubscribe()
  }, [])

  const businessName = user?.academy?.businessName ?? null

  return { user, loading, businessName }
}
