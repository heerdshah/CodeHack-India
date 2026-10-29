'use client'

import { ArrowRight, Bell, Layers, Shield } from 'lucide-react'

import { useState } from 'react'
import { matchesQuery, type Mode, type Resource, type UserProfile } from '@/lib/resources'

import Link from 'next/link'


type Props = {
  user: UserProfile | null
  authLoading?: boolean
  mode?: Mode
  onMode?: (m: Mode) => void
  unreadCount?: number
  onToggleNotifications?: () => void
  onOpenAdmin?: () => void
  onProfile?: () => void
}

const LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/explore' },
  { label: 'Search', href: '/#search' },
  { label: 'About Us', href: '/#about' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Chat', href: '/chat' },
]
export function SiteNav({
  user,
  authLoading = false,
  mode,
  onMode,
  unreadCount = 0,
  onToggleNotifications,
  onOpenAdmin,
  onProfile,
}: Props) {
  const isOwnerOrAdmin =
    user &&
    ['owner', 'admin', 'manager'].includes(user.systemRole || '')

  const isAdmin = user && user.systemRole === 'admin'

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/60 backdrop-blur-xl">
      <nav
        aria-label="Primary"
        className="mx-auto max-w-7xl px-4 sm:px-6"
      >
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="ResourcX home"
          >
            <span className="grid size-8 place-items-center rounded-lg border border-cream/30 bg-cream/10 text-cream">
              <Layers className="size-4" aria-hidden="true" />
            </span>

            <span className="font-display text-lg font-semibold tracking-tight text-white">
              Resourc<span className="text-cream">X</span>
            </span>
          </Link>

          {/* Centre links */}
          <div className="hidden items-center gap-6 lg:flex xl:gap-8">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-white/75 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                title="Admin Control Panel"
                className="flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 transition hover:bg-purple-500/20"
              >
                <Shield className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            {isOwnerOrAdmin && onMode && mode && (
              <div
                role="radiogroup"
                aria-label="Interface mode"
                className="flex rounded-full border border-white/15 bg-black/30 p-0.5 text-xs"
              >
                {(['user', 'owner'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => onMode(m)}
                    className={`rounded-full px-2.5 py-1.5 font-medium capitalize transition sm:px-3 ${
                      mode === m
                        ? 'bg-cream text-ink'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {m}
                    <span className="hidden sm:inline"> Mode</span>
                  </button>
                ))}
              </div>
            )}

            {/* Notification Bell */}
            {(user || authLoading) && onToggleNotifications && (
              <button
                type="button"
                disabled={!user}
                onClick={onToggleNotifications}
                aria-label={`View notifications${
                  !user
                    ? ', loading'
                    : unreadCount > 0
                      ? `, ${unreadCount} unread`
                      : ''
                }`}
                className="relative grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white transition hover:border-cream/60 disabled:cursor-wait disabled:opacity-50"
              >
                <Bell className="size-4" aria-hidden="true" />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <Link
                href="/account"
                onClick={onProfile}
                aria-label={`Open account for ${user.fullName}`}
                title="My account"
                className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-xs font-semibold text-white transition hover:border-cream/60"
              >
                {user.fullName
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition hover:bg-white"
              >
                Sign In
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {/* Mobile links */}
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2.5 text-xs text-white/75 md:hidden [scrollbar-width:none]">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="shrink-0 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}