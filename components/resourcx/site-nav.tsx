'use client'

import { Search, UserRound, Bell, Shield, LogOut, User, MessageSquare } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { matchesQuery, type Mode, type Resource, type UserProfile } from '@/lib/resources'

type Props = {
  query: string
  onQuery: (q: string) => void
  mode: Mode
  onMode: (m: Mode) => void
  user: UserProfile | null
  onProfile: () => void
  onPick: (r: Resource) => void
  resourcesList?: Resource[]
  unreadCount?: number
  onToggleNotifications?: () => void
  onOpenAdmin?: () => void
  onOpenChat?: () => void
  onSignOut?: () => void
}

export function SiteNav({
  query,
  onQuery,
  mode,
  onMode,
  user,
  onProfile,
  onPick,
  resourcesList = [],
  unreadCount = 0,
  onToggleNotifications,
  onOpenAdmin,
  onOpenChat,
  onSignOut,
}: Props) {
  const [focused, setFocused] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const matches = query.trim()
    ? resourcesList.filter((r) => matchesQuery(r, query)).slice(0, 5)
    : []

  const isOwnerOrAdmin =
    user && (user.systemRole === 'owner' || user.systemRole === 'admin' || user.systemRole === 'manager')
  const isAdmin = user && user.systemRole === 'admin'

  const search = (
    <div className="relative w-full">
      <label htmlFor="global-search" className="sr-only">
        Search assets by keyword, department, or category
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/60" aria-hidden />
      <input
        id="global-search"
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' })
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="Search CNC, Chemistry, studios…"
        className="w-full rounded-full border border-white/15 bg-black/30 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur-md transition focus:border-cream/60"
      />
      {focused && query.trim() && (
        <div className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl border border-white/10 bg-panel/95 shadow-2xl backdrop-blur-xl">
          {matches.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone">No assets match &ldquo;{query}&rdquo;</p>
          ) : (
            <ul>
              {matches.map((r) => (
                <li key={r.id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(r)
                      setFocused(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">{r.name}</span>
                      <span className="block truncate text-xs text-stone">{r.department}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-stone">{r.category.split(' ')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/40 backdrop-blur-xl">
      <nav aria-label="Primary" className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center justify-between gap-3 md:contents">
          <a href="#top" className="flex shrink-0 items-center gap-2.5">
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              Resourc<span className="text-cream">X</span>
            </span>
            <span className="hidden rounded-full border border-cream/30 bg-cream/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cream sm:inline">
              Intra-Institutional Hub
            </span>
          </a>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-md">{search}</div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <a href="#catalogue" className="hidden text-sm text-white/80 transition hover:text-white lg:inline">
              Browse Catalogue
            </a>

            {/* Admin shortcut button */}
            {isAdmin && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                title="Admin Control Panel"
                className="flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 hover:bg-purple-500/20"
              >
                <Shield className="size-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            {/* Mode toggle available for everyone so users can switch between Borrower & Owner perspective */}
            <div role="radiogroup" aria-label="Interface mode" className="flex rounded-full border border-white/15 bg-black/30 p-0.5 text-xs">
              {(['user', 'owner'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => onMode(m)}
                  className={`rounded-full px-2.5 py-1.5 font-medium capitalize transition sm:px-3 ${
                    mode === m ? 'bg-cream text-ink' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {m === 'user' ? 'Borrower' : 'Facility Owner'}
                  <span className="hidden sm:inline"> Mode</span>
                </button>
              ))}
            </div>

            {/* Chat Icon Button */}
            {user && onOpenChat && (
              <button
                onClick={onOpenChat}
                aria-label="Direct Chat"
                title="Direct Chat"
                className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white transition hover:border-cream/60 hover:text-blue-300"
              >
                <MessageSquare className="size-4" />
              </button>
            )}

            {/* Notification Bell */}
            {user && onToggleNotifications && (
              <button
                onClick={onToggleNotifications}
                aria-label="View notifications"
                className="relative grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white transition hover:border-cream/60"
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Profile Avatar / Login Button & Dropdown */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileOpen((prev) => !prev)}
                  aria-expanded={profileOpen}
                  aria-label={`Account menu for ${user.fullName}`}
                  className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-xs font-semibold text-white transition hover:border-cream/60 focus:outline-none focus:ring-2 focus:ring-cream/50"
                >
                  {user.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-white/15 bg-[#171717]/95 p-1.5 shadow-2xl backdrop-blur-xl z-50">
                    <div className="border-b border-white/10 px-3 py-2.5">
                      <p className="truncate text-xs font-semibold text-white">{user.fullName}</p>
                      <p className="truncate text-[11px] text-white/50">{user.email}</p>
                      <span className="mt-1 inline-block rounded bg-cream/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cream">
                        {user.systemRole || 'user'} • {user.role}
                      </span>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          onProfile()
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        <User className="size-3.5 text-stone" />
                        <span>My Dashboard & Profile</span>
                      </button>

                      {onOpenChat && (
                        <button
                          onClick={() => {
                            setProfileOpen(false)
                            onOpenChat()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-blue-400 transition hover:bg-blue-500/10 hover:text-blue-300"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Messages & Chat</span>
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          setProfileOpen(false)
                          if (onSignOut) {
                            onSignOut()
                          } else {
                            try {
                              const { api } = await import('@/lib/api')
                              await api.auth.logout()
                            } catch (e) {
                              console.error(e)
                            }
                            window.location.reload()
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        <LogOut className="size-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onProfile}
                aria-label="Create account or sign in"
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-cream/60"
              >
                <UserRound className="size-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
        <div className="md:hidden">{search}</div>
      </nav>
    </header>
  )
}
