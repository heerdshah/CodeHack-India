'use client'

import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, X, User } from 'lucide-react'
import { api } from '@/lib/api'

interface ChatModalProps {
  bookingId: string
  resourceName?: string
  currentUserId?: string
  open: boolean
  onClose: () => void
}

export function ChatModal({
  bookingId,
  resourceName = 'Booking',
  currentUserId,
  open,
  onClose,
}: ChatModalProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    if (!bookingId || bookingId === 'undefined') return
    try {
      const data = await api.chat.getMessages(bookingId)
      setMessages(data || [])
    } catch (err) {
      // Keep UI clean without unhandled throwing
      setMessages([])
    }
  }

  useEffect(() => {
    if (!open || !bookingId) return
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [open, bookingId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || loading) return

    const pendingText = content
    setContent('')
    setLoading(true)

    try {
      const newMsg = await api.chat.sendMessage(bookingId, pendingText)
      setMessages((prev) => [...prev, newMsg])
    } catch (err: any) {
      alert(`Could not send message: ${err.message}`)
      setContent(pendingText)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[560px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#171717] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-xl bg-blue-500/15 text-blue-400">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Direct Chat</h3>
              <p className="text-xs text-stone">{resourceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-stone hover:bg-white/10 hover:text-white transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-stone">
              <MessageSquare className="mb-2 size-8 stroke-1 text-stone/40" />
              <p>No messages yet.</p>
              <p className="text-[11px] text-stone/70">Send a note to coordinate handover, setup, or access.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = currentUserId ? m.sender_id === currentUserId : m.sender_name !== 'Dr. Mira Okafor'
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-stone/80 mb-1 px-1">{m.sender_name || 'Participant'}</span>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      isMe
                        ? 'bg-cream text-ink font-medium rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm border border-white/10'
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-[10px] text-stone/60 mt-1 px-1">
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="flex gap-2 border-t border-white/10 p-3 bg-white/[0.02]">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type message to coordinate..."
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3.5 py-2 text-xs text-white placeholder:text-stone focus:border-cream/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-cream px-4 py-2 text-xs font-semibold text-ink transition hover:bg-cream/90 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  )
}
