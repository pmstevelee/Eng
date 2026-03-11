'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types'

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchProfile = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }

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

  return { user, loading }
}
