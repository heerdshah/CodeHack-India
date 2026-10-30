'use client'

import { Check, CheckCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Modal, btnGhost } from './ui'
import { api, type NotificationItem } from '@/lib/api'

type Props = {
  open: boolean
  notifications: NotificationItem[]
  error?: string
  onClose: () => void
  onRefresh: () => void
}

export function NotificationsModal({ open, notifications, error, onClose, onRefresh }: Props) {
  const router = useRouter()
  const [actionError, setActionError] = useState('')

  const markRead = async (id: string) => {
    setActionError('')
    try {
      await api.notifications.markAsRead(id)
      onRefresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to mark the notification as read.')
    }
  }

  const getDestination = (notification: NotificationItem) => {
    if (notification.type === 'booking_signature') {
      return notification.data?.recipient_role === 'owner'
        ? '/account#managed-bookings-heading'
        : '/account#active-bookings-heading'
    }

    if (notification.type === 'booking_approved' || notification.type === 'booking_submitted') {
      return '/account#active-bookings-heading'
    }

    if (notification.type === 'booking_request') {
      const text = `${notification.title} ${notification.message}`.toLowerCase()
      return text.includes('submitted')
        ? '/account#active-bookings-heading'
        : '/account#managed-bookings-heading'
    }

    return null
  }

  const openNotification = async (notification: NotificationItem) => {
    const destination = getDestination(notification)
    if (!destination) return

    onClose()
    if (!notification.is_read) {
      try {
        await api.notifications.markAsRead(notification.id)
        onRefresh()
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : 'Unable to mark the notification as read.')
      }
    }
    router.push(destination)
  }

  const markAllRead = async () => {
    setActionError('')
    try {
      await api.notifications.markAllAsRead()
      onRefresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to mark notifications as read.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Activity & Alerts" title="Notifications">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-stone">{notifications.length} total messages</span>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1 text-xs text-cream hover:underline"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
      </div>

      {(error || actionError) && (
        <p role="alert" className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {actionError || error}
        </p>
      )}

      <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
        {notifications.length === 0 ? (
          <p className="text-sm text-stone py-6 text-center">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              role={getDestination(n) ? 'link' : undefined}
              tabIndex={getDestination(n) ? 0 : undefined}
              onClick={() => void openNotification(n)}
              onKeyDown={(event) => {
                if (getDestination(n) && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  void openNotification(n)
                }
              }}
              className={`rounded-2xl border p-3.5 transition ${
                n.is_read
                  ? 'border-white/5 bg-white/[0.01] text-stone'
                  : 'border-cream/20 bg-cream/[0.04] text-white'
              } ${getDestination(n) ? 'cursor-pointer hover:border-cream/40 focus:outline-none focus:ring-2 focus:ring-cream/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm text-cream">{n.title}</h4>
                {!n.is_read && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      void markRead(n.id)
                    }}
                    title="Mark as read"
                    className="shrink-0 text-stone hover:text-white"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed">{n.message}</p>
              <span className="mt-2 block text-[10px] text-stone/70">
                {n.created_at?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className={btnGhost}>Close</button>
      </div>
    </Modal>
  )
}
