'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { api } from '@/lib/api'
import type { Booking, Resource, UserProfile } from '@/lib/resources'

import { SiteNav } from '@/components/resourcx/site-nav'
import { SiteFooter } from '@/components/resourcx/site-footer'
import { StatusBadge } from '@/components/resourcx/ui'

const HISTORY_STATUSES = [
  'completed',
  'rejected',
  'cancelled',
  'overdue',
] as const

function formatBookingDate(value?: string | null) {
  if (!value) return 'Not specified'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Not specified'

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function AccountPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  // These settings are currently local UI preferences only.
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [bookingNotifications, setBookingNotifications] = useState(true)

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const currentUser = await api.auth.getMe()

      if (!currentUser) {
        router.replace('/sign-in')
        return
      }

      setUser(currentUser)

      const [allBookings, allResources] = await Promise.all([
        api.bookings.list(),
        api.resources.list(),
      ])

      setBookings(allBookings.filter((booking) => booking.isMine))
      setResources(allResources)
    } catch (err: unknown) {
      console.error('Failed to load account:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your account. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  const activeBookings = bookings.filter(
    (booking) => !HISTORY_STATUSES.includes(
      booking.status as (typeof HISTORY_STATUSES)[number]
    )
  )

  const bookingHistory = bookings.filter((booking) =>
    HISTORY_STATUSES.includes(
      booking.status as (typeof HISTORY_STATUSES)[number]
    )
  )

  const getResourceName = (booking: Booking) =>
    resources.find((resource) => resource.id === booking.resourceId)?.name ??
    booking.resource_name ??
    'Shared resource'

  const handleSignOut = async () => {
    if (signingOut) return

    setSigningOut(true)
    setError('')

    try {
      await api.auth.logout()
      router.replace('/sign-in')
      router.refresh()
    } catch (err: unknown) {
      console.error('Sign out failed:', err)

      setError(
        err instanceof Error
          ? `Sign out failed: ${err.message}`
          : 'Sign out failed. Please try again.'
      )

      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink text-white">
        <SiteNav user={user} />

        <main className="mx-auto max-w-6xl px-5 pb-24 pt-36 sm:px-6">
          <div className="animate-pulse">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="mt-5 h-10 w-64 rounded bg-white/10" />
            <div className="mt-8 h-40 rounded-3xl bg-white/[0.04]" />
            <div className="mt-6 h-56 rounded-3xl bg-white/[0.04]" />
          </div>
        </main>

        <SiteFooter />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ink text-white">
        <SiteNav user={null} />

        <main className="mx-auto max-w-6xl px-5 pb-24 pt-36 sm:px-6">
          <p className="text-sm text-stone">
            Your account could not be loaded. Please sign in to continue.
          </p>

          <Link
            href="/sign-in"
            className="mt-4 inline-flex rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white"
          >
            Go to sign in
          </Link>
        </main>

        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav user={user} />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-36 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-stone transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to home
        </Link>

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone">
            Account and activity
          </p>

          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-6xl">
            My account<span className="text-cream">.</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
            Manage your profile, review your resource bookings, and
            access your account preferences.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={() => void loadAccount()}
              className="shrink-0 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* Profile */}
        <section
          aria-labelledby="profile-heading"
          className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-cream/20 bg-cream/10 font-display text-2xl text-cream">
              {getInitials(user.fullName || user.username || 'User')}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-stone">
                Your profile
              </p>

              <h2
                id="profile-heading"
                className="mt-2 break-words font-display text-2xl font-medium sm:text-3xl"
              >
                {user.fullName || user.username}
              </h2>

              <p className="mt-1 break-all text-sm text-white/60">
                {user.email}
              </p>

              <p className="mt-1 text-sm text-stone">
                {user.department || 'Department not specified'}
                {' · '}
                {user.role || 'Role not specified'}
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 text-xs text-emerald-200">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                {user.isVerified ? 'Verified account' : 'Registered account'}
                {' · '}
                {user.systemRole || 'user'}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="inline-flex items-center justify-center rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white"
              >
                Browse resources
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-red-300/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section
          aria-label="Booking summary"
          className="mt-6 grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-stone">
              <CalendarDays className="size-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wider">
                Total bookings
              </span>
            </div>

            <p className="mt-4 font-display text-4xl">
              {bookings.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-stone">
              <Clock3 className="size-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wider">
                Active bookings
              </span>
            </div>

            <p className="mt-4 font-display text-4xl">
              {activeBookings.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-stone">
              <UserRound className="size-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wider">
                Account role
              </span>
            </div>

            <p className="mt-4 font-display text-2xl capitalize">
              {user.systemRole || 'user'}
            </p>
          </div>
        </section>

        {/* Active bookings */}
        <section
          aria-labelledby="active-bookings-heading"
          className="mt-14"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-stone">
                Current activity
              </p>

              <h2
                id="active-bookings-heading"
                className="mt-2 font-display text-3xl font-medium sm:text-4xl"
              >
                Active bookings
              </h2>
            </div>

            <span className="text-xs text-stone">
              {activeBookings.length} booking
              {activeBookings.length === 1 ? '' : 's'}
            </span>
          </div>

          {activeBookings.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center">
              <CalendarDays
                className="mx-auto size-7 text-stone"
                aria-hidden="true"
              />

              <h3 className="mt-4 text-lg font-medium">
                Nothing booked right now
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone">
                When you request a shared space or a piece of equipment,
                your booking activity will appear here.
              </p>

              <Link
                href="/explore"
                className="mt-5 inline-flex rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white"
              >
                Explore the catalog
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {activeBookings.map((booking) => (
                <article
                  key={booking.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-medium">
                        {getResourceName(booking)}
                      </h3>

                      <p className="mt-2 break-all text-xs text-stone">
                        Booking reference: {booking.id}
                      </p>
                    </div>

                    <StatusBadge status={booking.status} />
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                    <p>
                      <span className="text-stone">Start: </span>
                      {formatBookingDate(booking.startDate)}
                    </p>

                    <p>
                      <span className="text-stone">End: </span>
                      {formatBookingDate(booking.endDate)}
                    </p>
                  </div>

                  {booking.purpose && (
                    <p className="mt-4 text-sm leading-relaxed text-white/70">
                      <span className="text-stone">Purpose: </span>
                      {booking.purpose}
                    </p>
                  )}

                  {booking.rejectionReason && (
                    <p className="mt-3 text-sm text-red-200">
                      <span className="text-red-300">Reason: </span>
                      {booking.rejectionReason}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Booking history */}
        <section
          aria-labelledby="booking-history-heading"
          className="mt-14"
        >
          <p className="text-xs uppercase tracking-widest text-stone">
            Past activity
          </p>

          <h2
            id="booking-history-heading"
            className="mt-2 font-display text-3xl font-medium sm:text-4xl"
          >
            Booking history
          </h2>

          {bookingHistory.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-8">
              <p className="text-sm text-stone">
                Your completed, rejected, cancelled, or overdue bookings
                will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="divide-y divide-white/10">
                {bookingHistory.map((booking) => (
                  <article
                    key={booking.id}
                    className="flex flex-col gap-3 bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-medium">
                        {getResourceName(booking)}
                      </h3>

                      <p className="mt-1 text-xs text-stone">
                        {formatBookingDate(booking.startDate)}
                        {' – '}
                        {formatBookingDate(booking.endDate)}
                      </p>

                      {booking.rejectionReason && (
                        <p className="mt-2 text-xs text-red-200">
                          {booking.rejectionReason}
                        </p>
                      )}
                    </div>

                    <StatusBadge status={booking.status} />
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Settings */}
        <section
          aria-labelledby="settings-heading"
          className="mt-14 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5">
              <Settings
                className="size-4 text-cream"
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-stone">
                Preferences
              </p>

              <h2
                id="settings-heading"
                className="mt-1 font-display text-2xl font-medium"
              >
                Account settings
              </h2>
            </div>
          </div>

          <div className="mt-6 divide-y divide-white/10">
            <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
              <span>
                <span className="block text-sm font-medium">
                  Email notifications
                </span>

                <span className="mt-1 block text-xs leading-relaxed text-stone">
                  Receive updates about your account and resource activity.
                </span>
              </span>

              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(event) =>
                  setEmailNotifications(event.target.checked)
                }
                className="size-4 accent-cream"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
              <span>
                <span className="block text-sm font-medium">
                  Booking notifications
                </span>

                <span className="mt-1 block text-xs leading-relaxed text-stone">
                  Receive updates about approvals, booking status, and
                  return checks.
                </span>
              </span>

              <input
                type="checkbox"
                checked={bookingNotifications}
                onChange={(event) =>
                  setBookingNotifications(event.target.checked)
                }
                className="size-4 accent-cream"
              />
            </label>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-stone">
            These preferences currently apply only to this page's
            interface. They are not saved to your account or database.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}