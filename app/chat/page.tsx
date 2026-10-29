'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { api, type NotificationItem } from '@/lib/api'
import type { Booking, Resource, UserProfile } from '@/lib/resources'
import { ChatModal } from '@/components/resourcx/chat-modal'
import { NotificationsModal } from '@/components/resourcx/notifications-modal'
import { SiteNav } from '@/components/resourcx/site-nav'

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async () => {
    setNotifications(await api.notifications.list().catch(() => []))
  }, [])

  useEffect(() => {
    let active = true

    const loadChatContext = async () => {
      try {
        const currentUser = await api.auth.getMe()
        if (!active) return

        if (!currentUser) {
          router.replace('/sign-in')
          return
        }

        setUser(currentUser)
        setLoading(false)
        void api.bookings.list().then((items) => {
          if (active) setBookings(items)
        }).catch(() => {})
        void api.resources.list().then((items) => {
          if (active) setResources(items)
        }).catch(() => {})
        void loadNotifications()
      } catch (cause) {
        if (active) {
          const message = cause instanceof Error ? cause.message : 'Could not load chat.'
          if (/authentication required|invalid or expired session token|user account no longer exists/i.test(message)) {
            router.replace('/sign-in')
            return
          }
          setError(message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadChatContext()
    return () => {
      active = false
    }
  }, [loadNotifications, router])

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav
        user={user}
        authLoading={loading}
        unreadCount={unreadCount}
        onToggleNotifications={() => setNotificationsOpen(true)}
        onProfile={() => router.push('/account')}
      />

      <main className="mx-auto flex min-h-screen max-w-7xl items-center px-4 pb-6 pt-20 sm:px-6">
        {loading ? (
          <div className="h-[min(720px,calc(100dvh-6.5rem))] min-h-96 w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
        ) : error ? (
          <p role="alert" className="text-sm text-red-200">{error}</p>
        ) : user ? (
          <ChatModal
            open
            user={user}
            mode="user"
            bookings={bookings}
            resources={resources}
            presentation="page"
            onClose={() => router.push('/')}
          />
        ) : null}
      </main>

      <NotificationsModal
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onRefresh={() => void loadNotifications()}
      />
    </div>
  )
}