'use client'

import { Bell, Check, CheckCheck } from 'lucide-react'
import { Modal, btnGhost, btnPrimary } from './ui'
import { api, type NotificationItem } from '@/lib/api'

type Props = {
  open: boolean
  notifications: NotificationItem[]
  onClose: () => void
  onRefresh: () => void
}

export function NotificationsModal({ open, notifications, onClose, onRefresh }: Props) {
  const markRead = async (id: string) => {
    await api.notifications.markAsRead(id)
    onRefresh()
  }

  const markAllRead = async () => {
    await api.notifications.markAllAsRead()
    onRefresh()
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

      <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
        {notifications.length === 0 ? (
          <p className="text-sm text-stone py-6 text-center">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-3.5 transition ${
                n.is_read
                  ? 'border-white/5 bg-white/[0.01] text-stone'
                  : 'border-cream/20 bg-cream/[0.04] text-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm text-cream">{n.title}</h4>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
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

