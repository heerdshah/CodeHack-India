'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MessageCircle, Send, X } from 'lucide-react'
import type { Booking, Mode, Resource, UserProfile } from '@/lib/resources'
import { api, type ChatConversation, type ChatMessage } from '@/lib/api'
import { btnPrimary } from './ui'

type Props = {
  open: boolean
  user: UserProfile
  mode: Mode
  bookings: Booking[]
  resources: Resource[]
  onClose: () => void
  presentation?: 'modal' | 'page'
}

const terminalStatuses = new Set(['rejected', 'cancelled'])

export function ChatModal({
  open,
  user,
  mode,
  bookings,
  resources,
  onClose,
  presentation = 'modal',
}: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [conversationsLoaded, setConversationsLoaded] = useState(false)
  const [selected, setSelected] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const selectedRef = useRef<ChatConversation | null>(null)
  const messageCache = useRef(new Map<string, ChatMessage[]>())
  const openRef = useRef(open)
  openRef.current = open

  const addMessage = useCallback((message: ChatMessage) => {
    const cached = messageCache.current.get(message.conversation_id) ?? []
    const updated = cached.some((existing) => existing.id === message.id)
      ? cached
      : [...cached, message].sort((a, b) => a.created_at.localeCompare(b.created_at))
    messageCache.current.set(message.conversation_id, updated)

    if (selectedRef.current?.id === message.conversation_id) {
      setMessages(updated)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    setError('')
    try {
      const fetched = await api.chat.listConversations()
      setConversations((current) =>
        fetched.map((conversation) => ({
          ...conversation,
          unread_count: Math.max(
            conversation.unread_count,
            current.find((item) => item.id === conversation.id)?.unread_count ?? 0
          ),
        }))
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load conversations.')
    } finally {
      setConversationsLoaded(true)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations, user.id])

  useEffect(() => {
    const refreshInbox = () => {
      if (document.visibilityState === 'visible') void loadConversations()
    }

    const intervalId = window.setInterval(refreshInbox, 10_000)
    window.addEventListener('focus', refreshInbox)
    document.addEventListener('visibilitychange', refreshInbox)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshInbox)
      document.removeEventListener('visibilitychange', refreshInbox)
    }
  }, [loadConversations])

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      setError('Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable live chat updates.')
      return
    }

    let active = true
    let client: SupabaseClient | null = null
    let refreshTimer: ReturnType<typeof setInterval> | undefined

    const connect = async () => {
      try {
        const token = await api.chat.getRealtimeToken()
        if (!active) return

        client = createClient(url, anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
        client.realtime.setAuth(token)
        const channel = client
          .channel(`chat-user-${user.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const incoming = payload.new as ChatMessage
              if (!incoming.id || incoming.sender_id === user.id) return

              void loadConversations()

              setConversations((current) =>
                current.map((conversation) =>
                  conversation.id === incoming.conversation_id
                    ? {
                        ...conversation,
                        unread_count:
                          openRef.current && selectedRef.current?.id === conversation.id
                            ? conversation.unread_count
                            : conversation.unread_count + 1,
                      }
                    : conversation
                )
              )

              if (openRef.current && selectedRef.current?.id === incoming.conversation_id) {
                addMessage(incoming)
                void api.chat.markRead(incoming.conversation_id).catch((cause) => {
                  setError(cause instanceof Error ? cause.message : 'Could not mark messages read.')
                })
              }
            }
          )
          .subscribe((status, cause) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setError(cause?.message || 'Live chat connection failed.')
            }
          })

        refreshTimer = setInterval(() => {
          void api.chat.getRealtimeToken()
            .then((freshToken) => client?.realtime.setAuth(freshToken))
            .catch((cause) => {
              setError(cause instanceof Error ? cause.message : 'Could not refresh chat connection.')
            })
        }, 10 * 60 * 1000)

        return () => {
          void client?.removeChannel(channel)
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not connect live chat.')
      }
    }

    let cleanupChannel: (() => void) | undefined
    void connect().then((cleanup) => {
      cleanupChannel = cleanup
      if (!active) cleanupChannel?.()
    })

    return () => {
      active = false
      if (refreshTimer) clearInterval(refreshTimer)
      cleanupChannel?.()
      if (client) void client.removeAllChannels()
    }
  }, [addMessage, loadConversations, user.id])

  useEffect(() => {
    selectedRef.current = selected
    if (!open || !selected) {
      setMessages([])
      setLoading(false)
      return
    }

    let active = true
    const cachedMessages = messageCache.current.get(selected.id) ?? []
    setMessages(cachedMessages)
    setLoading(cachedMessages.length === 0)
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selected.id ? { ...conversation, unread_count: 0 } : conversation
      )
    )

    void Promise.all([
      api.chat.markRead(selected.id),
      api.chat.listMessages(selected.id),
    ])
      .then(([, history]) => {
        const latestById = new Map(
          [...(messageCache.current.get(selected.id) ?? []), ...history].map((message) => [
            message.id,
            message,
          ])
        )
        const latest = [...latestById.values()].sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        )
        messageCache.current.set(selected.id, latest)
        if (active) setMessages(latest)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load chat history.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, selected])

  if (!open) return null

  const visibleBookings = bookings.filter((booking) =>
    !terminalStatuses.has(booking.status) && (mode === 'user' ? booking.isMine : !booking.isMine)
  )

  const startConversation = async (bookingId: string) => {
    setError('')
    try {
      const conversation = await api.chat.createConversation(bookingId)
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ])
      setSelected(conversation)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start this conversation.')
    }
  }

  const startDirectConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const targetUsername = username.trim().replace(/^@/, '')
    if (!targetUsername || starting) return

    setStarting(true)
    setError('')
    try {
      const conversation = await api.chat.createDirectConversation(targetUsername)
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ])
      setUsername('')
      setSelected(conversation)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start this conversation.')
    } finally {
      setStarting(false)
    }
  }

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = messageText.trim()
    if (!selected || !content || sending) return

    setSending(true)
    setError('')
    try {
      const sent = await api.chat.sendMessage(selected.id, content)
      addMessage(sent)
      setMessageText('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  const resourceName = (bookingId: string | null) => {
    if (!bookingId) return undefined
    const booking = bookings.find((item) => item.id === bookingId)
    return booking ? resources.find((resource) => resource.id === booking.resourceId)?.name : undefined
  }

  const isPage = presentation === 'page'

  return (
    <div
      className={isPage ? 'w-full' : 'fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm'}
      role={isPage ? undefined : 'presentation'}
    >
      <section
        role={isPage ? undefined : 'dialog'}
        aria-modal={isPage ? undefined : true}
        aria-labelledby="chat-title"
        className={isPage
          ? 'relative flex h-[calc(100dvh-6.5rem)] min-h-[24rem] w-full overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl'
          : 'relative flex h-[min(720px,92vh)] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-panel shadow-2xl'}
      >
        <aside className={`${selected ? 'hidden sm:flex' : 'flex'} w-full shrink-0 flex-col border-r border-white/10 sm:w-80`}>
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <h2 id="chat-title" className="font-display text-xl font-medium">Messages</h2>
              <p className="text-xs text-stone">Signed in as @{user.username}</p>
            </div>
            <button onClick={onClose} aria-label={isPage ? 'Back to ResourcX' : 'Close chat'} className="rounded-full p-2 text-stone hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone">Conversations</p>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelected(conversation)}
                className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left transition ${
                  selected?.id === conversation.id ? 'bg-cream/10 text-cream' : 'text-white hover:bg-white/5'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">@{conversation.other_user.username}</span>
                  <span className="block truncate text-xs text-stone">{conversation.booking_id ? resourceName(conversation.booking_id) || `Booking ${conversation.booking_id}` : 'Direct message'}</span>
                </span>
                {conversation.unread_count > 0 && (
                  <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                    (+{conversation.unread_count})
                  </span>
                )}
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="px-2 py-3 text-sm text-stone">
                {conversationsLoaded ? 'No conversations yet.' : 'Loading conversations…'}
              </p>
            )}

            <form onSubmit={startDirectConversation} className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
              <label htmlFor="chat-username" className="block text-[11px] font-semibold uppercase tracking-wider text-stone">
                Message anyone by username
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="chat-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={80}
                  placeholder="@username"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cream/50"
                />
                <button type="submit" disabled={!username.trim() || starting} className={`${btnPrimary} px-3 text-xs disabled:opacity-50`}>
                  {starting ? 'Opening…' : 'Message'}
                </button>
              </div>
            </form>

            {visibleBookings.length > 0 && (
              <>
                <p className="mt-5 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone">Start from a booking</p>
                {visibleBookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => void startConversation(booking.id)}
                    className="mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-white transition hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{resourceName(booking.id) || 'Booking conversation'}</span>
                      <span className="block truncate text-xs text-stone">{booking.status} · {booking.id}</span>
                    </span>
                    <MessageCircle className="size-4 shrink-0 text-cream" />
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        <div className={`${selected ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <button onClick={() => setSelected(null)} className="rounded-full px-2 py-1 text-xs text-stone hover:bg-white/10 sm:hidden">
                  Back
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium">@{selected.other_user.username}</h3>
                  <p className="truncate text-xs text-stone">{selected.booking_id ? resourceName(selected.booking_id) || `Booking ${selected.booking_id}` : 'Direct message'}</p>
                </div>
                <button onClick={onClose} aria-label={isPage ? 'Back to ResourcX' : 'Close chat'} className="rounded-full p-2 text-stone hover:bg-white/10 hover:text-white">
                  <X className="size-4" />
                </button>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {loading && messages.length === 0 && <p className="text-sm text-stone">Loading messages…</p>}
                {!loading && messages.length === 0 && <p className="mt-8 text-center text-sm text-stone">No messages yet. Say hello.</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                    <article className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      message.sender_id === user.id ? 'bg-cream text-ink' : 'bg-white/10 text-white'
                    }`}>
                      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      <time className="mt-1 block text-right text-[10px] opacity-60" dateTime={message.created_at}>
                        {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </time>
                    </article>
                  </div>
                ))}
              </div>

              <form onSubmit={submitMessage} className="flex gap-2 border-t border-white/10 p-3">
                <label className="sr-only" htmlFor="chat-message">Message</label>
                <input
                  id="chat-message"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  maxLength={4000}
                  placeholder="Write a message…"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none focus:border-cream/50"
                />
                <button type="submit" disabled={!messageText.trim() || sending} aria-label="Send message" className={`${btnPrimary} px-4 disabled:opacity-50`}>
                  <Send className="size-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-stone sm:flex">
              <MessageCircle className="size-9 opacity-50" />
              <p className="text-sm">Select a conversation to view its messages.</p>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="absolute inset-x-4 bottom-4 rounded-xl border border-red-400/30 bg-red-950/90 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
