'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MessageSquare, Search, Send, UserRound } from 'lucide-react'

import { api, type ChatConversation, type ChatMessage, type ChatUser } from '@/lib/api'
import type { UserProfile } from '@/lib/resources'

type Props = {
  open: boolean
  user: UserProfile
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export function ChatModal({ open, user, onClose, onUnreadCountChange }: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ChatUser[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [startingConversation, setStartingConversation] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [messageError, setMessageError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  const loadConversations = useCallback(async () => {
    try {
      const result = await api.chat.listConversations()
      setConversations(result)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load conversations.')
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadConversations()

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadConversations()
    }, 10_000)
    return () => window.clearInterval(intervalId)
  }, [loadConversations, open, user.id])

  useEffect(() => {
    onUnreadCountChange?.(
      conversations.reduce((total, conversation) => total + conversation.unread_count, 0)
    )
  }, [conversations, onUnreadCountChange])

  useEffect(() => {
    const trimmed = query.trim().replace(/^@/, '')
    if (trimmed.length < 2) {
      setSearchResults([])
      setSearchError('')
      setSearching(false)
      return
    }

    let active = true
    setSearching(true)
    const timeoutId = window.setTimeout(() => {
      api.chat.searchUsers(trimmed)
        .then((results) => {
          if (active) {
            setSearchResults(results)
            setSearchError('')
          }
        })
        .catch((cause: unknown) => {
          if (active) {
            setSearchError(cause instanceof Error ? cause.message : 'Could not search usernames.')
          }
        })
        .finally(() => {
          if (active) setSearching(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [query])

  useEffect(() => {
    if (!open || !selectedId) {
      setMessages([])
      return
    }

    let active = true
    const loadMessages = async () => {
      try {
        const result = await api.chat.getMessages(selectedId)
        if (!active) return
        setMessages(result)
        setMessageError('')
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedId
              ? { ...conversation, unread_count: 0 }
              : conversation
          )
        )
      } catch (cause) {
        if (active) {
          setMessageError(cause instanceof Error ? cause.message : 'Could not load messages.')
        }
      } finally {
        if (active) setLoadingMessages(false)
      }
    }

    setMessages([])
    setMessageError('')
    setLoadingMessages(true)
    void loadMessages()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages()
    }, 3_000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [open, selectedId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openConversation = async (target: ChatUser) => {
    setStartingConversation(true)
    setSearchError('')
    try {
      const conversation = await api.chat.startDirect(target.username)
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ])
      setSelectedId(conversation.id)
      setQuery('')
      setSearchResults([])
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : 'Could not start this conversation.')
    } finally {
      setStartingConversation(false)
    }
  }

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = messageText.trim()
    if (!content || !selected || sending) return

    setSending(true)
    setMessageError('')
    try {
      const message = await api.chat.sendMessage(selected.id, content)
      setMessages((current) => [...current, message])
      setMessageText('')
      void loadConversations()
    } catch (cause) {
      setMessageError(cause instanceof Error ? cause.message : 'Could not send this message.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <section className="flex h-[min(760px,calc(100dvh-7rem))] min-h-[480px] w-full overflow-hidden rounded-3xl border border-white/10 bg-[#151515] shadow-2xl">
      <aside className={`${selected ? 'hidden sm:flex' : 'flex'} w-full shrink-0 flex-col border-r border-white/10 bg-white/[0.02] sm:w-72 lg:w-80`}>
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone">ResourcX</p>
              <h1 className="mt-1 font-display text-xl text-cream">Messages</h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full text-stone transition hover:bg-white/10 hover:text-white"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
            <Search className="size-4 shrink-0 text-stone" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search usernames"
              aria-label="Search usernames"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-stone/70"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {(searching || searchResults.length > 0 || searchError) && (
            <div className="mb-3">
              <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-stone">
                Usernames
              </p>
              {searchError && <p role="alert" className="px-3 py-2 text-xs text-red-200">{searchError}</p>}
              {searching && <p className="px-3 py-2 text-xs text-stone">Searching…</p>}
              {!searching && query.trim().length >= 2 && searchResults.length === 0 && !searchError && (
                <p className="px-3 py-2 text-xs text-stone">No matching usernames.</p>
              )}
              {searchResults.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => void openConversation(result)}
                  disabled={startingConversation}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream/10 text-cream">
                    <UserRound className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white">{result.name}</span>
                    <span className="block truncate text-xs text-stone">@{result.username}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-stone">
            Conversations
          </p>
          {loadingConversations ? (
            <p className="px-3 py-4 text-xs text-stone">Loading conversations…</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-4 text-xs leading-relaxed text-stone">
              No conversations yet. Search for a username to start one.
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  selectedId === conversation.id ? 'bg-cream/10' : 'hover:bg-white/[0.05]'
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-cream">
                  <UserRound className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {conversation.other_user.name}
                  </span>
                  <span className="block truncate text-xs text-stone">
                    @{conversation.other_user.username}
                  </span>
                </span>
                {conversation.unread_count > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                    {conversation.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
          {error && <p role="alert" className="px-3 py-3 text-xs text-red-200">{error}</p>}
        </div>
      </aside>

      <div className={`${selected ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-6">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-stone hover:bg-white/10 hover:text-white sm:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <span className="grid size-10 place-items-center rounded-full bg-cream/10 text-cream">
                <UserRound className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-white">{selected.other_user.name}</h2>
                <p className="truncate text-xs text-stone">@{selected.other_user.username}</p>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
              {loadingMessages && messages.length === 0 && (
                <p className="text-center text-xs text-stone">Loading messages…</p>
              )}
              {!loadingMessages && messages.length === 0 && !messageError && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageSquare className="size-8 text-stone/50" aria-hidden />
                  <p className="mt-3 text-sm text-stone">No messages yet</p>
                  <p className="mt-1 text-xs text-stone/70">Send a message to start the conversation.</p>
                </div>
              )}
              {messages.map((message) => {
                const isMine = message.sender_id === user.id
                return (
                  <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      isMine ? 'rounded-br-sm bg-cream text-ink' : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-white'
                    }`}>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                      <time className={`mt-1 block text-right text-[10px] ${isMine ? 'text-ink/60' : 'text-stone/70'}`}>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                )
              })}
              {messageError && <p role="alert" className="text-center text-xs text-red-200">{messageError}</p>}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/10 p-3 sm:p-4">
              <input
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                maxLength={4000}
                placeholder="Write a message…"
                aria-label="Message"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-stone/70 focus:border-cream/40"
              />
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-4" aria-hidden />
                <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <MessageSquare className="size-10 text-stone/50" aria-hidden />
            <p className="mt-4 font-display text-xl text-cream">Your conversations</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone">
              Select a conversation or search for a username to message someone.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
