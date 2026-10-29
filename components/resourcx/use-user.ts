'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { UserProfile } from '@/lib/resources'

/** Loads the signed-in user (if any) for pages outside the main app shell. */
export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const me = await api.auth.getMe()
        if (alive && me) setUser(me)
      } catch {
        // not signed in
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return user
}