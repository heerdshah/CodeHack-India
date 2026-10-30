'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { api } from '@/lib/api'
import type { Booking, Resource, UserProfile } from '@/lib/resources'

import { AgreementModal } from '@/components/resourcx/agreement-modal'
import { AccessPass, InspectionModal } from '@/components/resourcx/inspection-modal'
import { OwnerInspectionReview } from '@/components/resourcx/inspection-review'
import { SiteNav } from '@/components/resourcx/site-nav'
import { SiteFooter } from '@/components/resourcx/site-footer'
import { Modal, btnPrimary, StatusBadge } from '@/components/resourcx/ui'

const HISTORY_STATUSES = [
  'approved',
  'signed',
  'active',
  'overdue',
  'returned',
  'completed',
  'rejected',
  'cancelled',
] as const

const CLOSED_BOOKING_STATUSES = [
  'returned',
  'completed',
  'rejected',
  'cancelled',
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

function hasStoredProof(booking: Booking) {
  return booking.proofFiles.some(
    (proof) => proof.startsWith('local:') || proof.startsWith('supabase:')
  )
}

export default function AccountPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [approvingBooking, setApprovingBooking] = useState<string | null>(null)
  const [checkingInBooking, setCheckingInBooking] = useState<string | null>(null)
  const [noDamageConfirmationOpen, setNoDamageConfirmationOpen] = useState(false)
  const [openingProof, setOpeningProof] = useState<string | null>(null)
  const [proofDocument, setProofDocument] = useState<{ name: string; url: string } | null>(null)
  const [requestsError, setRequestsError] = useState('')
  const [activeBookingsError, setActiveBookingsError] = useState('')
  const [attachingProof, setAttachingProof] = useState<string | null>(null)
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [agreementViewer, setAgreementViewer] = useState<'user' | 'owner'>('user')
  const [inspection, setInspection] = useState<{
    bookingId: string
    phase: 'pre' | 'post'
  } | null>(null)
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

      setBookings(allBookings)
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

  const refreshBookings = useCallback(async () => {
    try {
      setBookings(await api.bookings.list())
      setActiveBookingsError('')
    } catch (err: unknown) {
      setActiveBookingsError(
        err instanceof Error
          ? `Unable to refresh booking updates: ${err.message}`
          : 'Unable to refresh booking updates.'
      )
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const refresh = () => void refreshBookings()
    const intervalId = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [refreshBookings, user?.id])

  useEffect(() => {
    return () => {
      if (proofDocument) URL.revokeObjectURL(proofDocument.url)
    }
  }, [proofDocument])

  const myBookings = bookings.filter((booking) => booking.isMine)
  const managedBookings = bookings.filter((booking) => !booking.isMine)
  const canManageBookings = ['owner', 'manager', 'admin'].includes(user?.systemRole || '')
  const activeManagedBookings = managedBookings.filter(
    (booking) => !CLOSED_BOOKING_STATUSES.includes(
      booking.status as (typeof CLOSED_BOOKING_STATUSES)[number]
    )
  )

  const activeBookings = myBookings.filter(
    (booking) => !CLOSED_BOOKING_STATUSES.includes(
      booking.status as (typeof CLOSED_BOOKING_STATUSES)[number]
    )
  )

  const bookingHistory = myBookings.filter((booking) =>
    HISTORY_STATUSES.includes(
      booking.status as (typeof HISTORY_STATUSES)[number]
    )
  )
  const managedBookingHistory = managedBookings.filter((booking) =>
    HISTORY_STATUSES.includes(
      booking.status as (typeof HISTORY_STATUSES)[number]
    )
  )

  const getResourceName = (booking: Booking) =>
    resources.find((resource) => resource.id === booking.resourceId)?.name ??
    booking.resource_name ??
    'Shared resource'

  const getResource = (booking: Booking) =>
    resources.find((resource) => resource.id === booking.resourceId) ?? null

  const isResourceOwner = (booking: Booking) =>
    Boolean(user?.id && getResource(booking)?.owner_id === user.id)

  const agreementBooking = bookings.find((booking) => booking.id === agreementId) ?? null
  const agreementResource = agreementBooking ? getResource(agreementBooking) : null
  const inspectionBooking = bookings.find((booking) => booking.id === inspection?.bookingId) ?? null
  const inspectionResource = inspectionBooking ? getResource(inspectionBooking) : null

  const openAgreement = (booking: Booking, viewer: 'user' | 'owner') => {
    setAgreementViewer(viewer)
    setAgreementId(booking.id)
  }

  const approveBooking = async (bookingId: string) => {
    setApprovingBooking(bookingId)
    setRequestsError('')
    try {
      await api.bookings.updateStatus(bookingId, 'approved')
      const refreshedBookings = await api.bookings.list()
      setBookings(refreshedBookings)
      const approvedBooking = refreshedBookings.find((booking) => booking.id === bookingId)
      if (approvedBooking && isResourceOwner(approvedBooking)) {
        openAgreement(approvedBooking, 'owner')
      }
    } catch (err: unknown) {
      setRequestsError(
        err instanceof Error
          ? `Unable to approve booking: ${err.message}`
          : 'Unable to approve booking. Please try again.'
      )
    } finally {
      setApprovingBooking(null)
    }
  }

  const viewProof = async (bookingId: string, index: number, isApplicant: boolean) => {
    const proofKey = `${bookingId}:${index}`
    setOpeningProof(proofKey)
    setRequestsError('')
    setActiveBookingsError('')
    try {
      const blob = await api.bookings.getProof(bookingId, index)
      if (blob.type !== 'application/pdf' || blob.size === 0) {
        throw new Error('The server did not return a readable PDF file.')
      }
      if (proofDocument) URL.revokeObjectURL(proofDocument.url)
      setProofDocument({
        name: `Booking proof ${index + 1}`,
        url: URL.createObjectURL(blob),
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? `Unable to open uploaded PDF: ${err.message}`
          : 'Unable to open uploaded PDF. Please try again.'
      if (isApplicant) setActiveBookingsError(message)
      else setRequestsError(message)
    } finally {
      setOpeningProof(null)
    }
  }

  const attachProof = async (bookingId: string, file?: File) => {
    if (!file) return
    setAttachingProof(bookingId)
    setActiveBookingsError('')
    try {
      await api.bookings.attachProof(bookingId, file)
      setBookings(await api.bookings.list())
    } catch (err: unknown) {
      setActiveBookingsError(
        err instanceof Error
          ? `Unable to attach PDF: ${err.message}`
          : 'Unable to attach PDF. Please try again.'
      )
    } finally {
      setAttachingProof(null)
    }
  }

  const checkInBooking = async (booking: Booking) => {
    setCheckingInBooking(booking.id)
    setActiveBookingsError('')
    try {
      const { otp } = await api.bookings.requestOtp(booking.id)
      await api.bookings.checkin(booking.id, otp)
      await refreshBookings()
    } catch (err: unknown) {
      setActiveBookingsError(
        err instanceof Error
          ? `Unable to check in: ${err.message}`
          : 'Unable to check in. Please try again.'
      )
    } finally {
      setCheckingInBooking(null)
    }
  }

  const signAgreement = async (
    party: 'user' | 'owner',
    signatureData: string,
    documentHash: string
  ) => {
    if (!agreementBooking) return
    await api.bookings.sign(agreementBooking.id, {
      signer_role: party,
      signature_data: signatureData,
      document_hash: documentHash,
    })
    setBookings(await api.bookings.list())
  }

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
              {myBookings.length}
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

        {canManageBookings && (
          <section aria-labelledby="managed-bookings-heading" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-stone">
                  Owner activity
                </p>
                <h2
                  id="managed-bookings-heading"
                  className="mt-2 font-display text-3xl font-medium sm:text-4xl"
                >
                  Requests for your resources
                </h2>
              </div>
              <span className="text-xs text-stone">
                {activeManagedBookings.length} active request
                {activeManagedBookings.length === 1 ? '' : 's'}
              </span>
            </div>

            {requestsError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
              >
                {requestsError}
              </p>
            )}

            {activeManagedBookings.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/15 px-6 py-10 text-center">
                <p className="text-sm text-stone">No active requests for your resources.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {activeManagedBookings.map((booking) => (
                  <article
                    key={booking.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-medium">
                          {getResourceName(booking)}
                        </h3>
                        <p className="mt-1 text-sm text-white/70">
                          Applicant: {booking.applicant.name} · {booking.applicant.email}
                        </p>
                        <p className="mt-2 text-sm text-white/70">
                          {formatBookingDate(booking.startDate)}
                          {' – '}
                          {formatBookingDate(booking.endDate)}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    {booking.purpose && (
                      <p className="mt-4 text-sm leading-relaxed text-white/70">
                        <span className="text-stone">Purpose: </span>
                        {booking.purpose}
                      </p>
                    )}

                    {booking.post && isResourceOwner(booking) && (
                      <OwnerInspectionReview
                        booking={booking}
                        resourceName={getResourceName(booking)}
                        onReviewed={(decision) => {
                          if (decision === 'no_damage') setNoDamageConfirmationOpen(true)
                          void refreshBookings()
                        }}
                      />
                    )}

                    {booking.userSignature && (
                      <p className="mt-4 text-sm text-emerald-200">
                        Borrower has signed the agreement
                        {booking.ownerSignature ? '; both signatures are recorded.' : '; your signature is pending.'}
                      </p>
                    )}

                    {booking.proofFiles.some((proof) => proof.startsWith('local:') || proof.startsWith('supabase:')) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {booking.proofFiles.map((proof, index) => ({ proof, index }))
                          .filter(({ proof }) => proof.startsWith('local:') || proof.startsWith('supabase:'))
                          .map(({ proof, index }) => (
                          <button
                            key={`${proof}-${index}`}
                            type="button"
                            onClick={() => void viewProof(booking.id, index, false)}
                            disabled={openingProof !== null}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-cream transition hover:border-cream/50 disabled:opacity-50"
                          >
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                            {openingProof === `${booking.id}:${index}` ? 'Opening PDF…' : `View uploaded PDF ${index + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {booking.status === 'pending' && (
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void approveBooking(booking.id)}
                          disabled={approvingBooking !== null}
                          className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check className="size-4" aria-hidden="true" />
                          {approvingBooking === booking.id ? 'Approving…' : 'Approve request'}
                        </button>
                      </div>
                    )}

                    {booking.status !== 'pending' &&
                      ['approved', 'signed', 'active'].includes(booking.status) &&
                      isResourceOwner(booking) && (
                        <div className="mt-5 flex justify-end">
                          <button
                            type="button"
                            onClick={() => openAgreement(booking, 'owner')}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-cream transition hover:border-cream/50"
                          >
                            {booking.ownerSignature ? 'View agreement' : 'Review & sign agreement'}
                          </button>
                        </div>
                      )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {canManageBookings && (
          <section aria-labelledby="managed-history-heading" className="mt-14">
            <p className="text-xs uppercase tracking-widest text-stone">Owner activity</p>
            <h2
              id="managed-history-heading"
              className="mt-2 font-display text-3xl font-medium sm:text-4xl"
            >
              Booking history for your resources
            </h2>

            {managedBookingHistory.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-8">
                <p className="text-sm text-stone">
                  Approved, used, and closed bookings for your resources will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <div className="divide-y divide-white/10">
                  {managedBookingHistory.map((booking) => (
                    <article
                      key={booking.id}
                      className="flex flex-col gap-3 bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-medium">{getResourceName(booking)}</h3>
                        <p className="mt-1 text-xs text-stone">
                          Borrower: {booking.applicant.name}
                        </p>
                        <p className="mt-1 text-xs text-stone">
                          {formatBookingDate(booking.startDate)}
                          {' – '}
                          {formatBookingDate(booking.endDate)}
                        </p>
                        {booking.post?.ownerDecision && (
                          <p className="mt-2 text-xs text-stone">
                            Owner review: {booking.post.ownerDecision === 'damage' ? 'Damage reported' : 'No damage reported'}.
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
        )}

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

          {activeBookingsError && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
            >
              {activeBookingsError}
            </p>
          )}

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

                  {booking.proofFiles.some((proof) => proof.startsWith('local:') || proof.startsWith('supabase:')) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {booking.proofFiles.map((proof, index) => ({ proof, index }))
                        .filter(({ proof }) => proof.startsWith('local:') || proof.startsWith('supabase:'))
                        .map(({ proof, index }) => (
                          <button
                            key={`${proof}-${index}`}
                            type="button"
                            onClick={() => void viewProof(booking.id, index, true)}
                            disabled={openingProof !== null}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-cream transition hover:border-cream/50 disabled:opacity-50"
                          >
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                            {openingProof === `${booking.id}:${index}` ? 'Opening PDF…' : `View uploaded PDF ${index + 1}`}
                          </button>
                        ))}
                    </div>
                  )}

                  {booking.isMine && booking.status === 'pending' && !hasStoredProof(booking) && (
                    <div className="mt-4">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-cream transition hover:border-cream/50">
                        {attachingProof === booking.id ? 'Uploading PDF…' : 'Attach PDF'}
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="sr-only"
                          disabled={attachingProof !== null}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            void attachProof(booking.id, file)
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {booking.isMine &&
                    ['approved', 'signed', 'active'].includes(booking.status) && (
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => openAgreement(booking, 'user')}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-cream transition hover:border-cream/50"
                        >
                          {booking.userSignature ? 'View agreement' : 'Review & sign agreement'}
                        </button>
                        {booking.status === 'signed' && booking.otp && getResource(booking) && (
                          <AccessPass otp={booking.otp} resource={getResource(booking)!} />
                        )}
                      </div>
                    )}

                  {booking.isMine && booking.status === 'signed' && !booking.pre && (
                    <div className="mt-4 rounded-xl border border-cream/15 bg-cream/[0.04] p-4">
                      <p className="text-sm font-medium text-cream">Next step: pre-use inspection</p>
                      <p className="mt-1 text-xs text-stone">
                        Before check-in, upload one photo for each of the six angles. The resource owner can review the baseline later.
                      </p>
                      <button
                        type="button"
                        onClick={() => setInspection({ bookingId: booking.id, phase: 'pre' })}
                        className="mt-3 inline-flex rounded-full bg-cream px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white"
                      >
                        Start pre-use inspection
                      </button>
                    </div>
                  )}

                  {booking.isMine && booking.status === 'signed' && booking.pre && (
                    <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
                      <p className="text-sm font-medium text-cream">Pre-use inspection complete</p>
                      <p className="mt-1 text-xs text-stone">
                        Check in with your digital access pass to begin the booking. After use, submit the six-photo return inspection for owner review.
                      </p>
                      <button
                        type="button"
                        onClick={() => void checkInBooking(booking)}
                        disabled={checkingInBooking !== null}
                        className="mt-3 inline-flex rounded-full bg-cream px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {checkingInBooking === booking.id ? 'Checking in…' : 'Check in & start booking'}
                      </button>
                    </div>
                  )}

                  {booking.isMine &&
                    ['active', 'overdue'].includes(booking.status) &&
                    !booking.post && (
                      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                        <p className="text-sm font-medium text-cream">Return inspection required</p>
                        <p className="mt-1 text-xs text-stone">
                          Upload six photos of the resource after use. The owner will compare them with your pre-use photos.
                        </p>
                        <button
                          type="button"
                          onClick={() => setInspection({ bookingId: booking.id, phase: 'post' })}
                          className="mt-3 inline-flex rounded-full bg-cream px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white"
                        >
                          Start return inspection
                        </button>
                      </div>
                    )}

                  {booking.isMine &&
                    ['active', 'overdue'].includes(booking.status) &&
                    booking.post && (
                      <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-cream">
                        Return inspection submitted. The owner is reviewing your photos and AI comparison.
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
                Your approved, used, returned, completed, rejected, and cancelled bookings will appear here.
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
                      {booking.post?.ownerDecision && (
                        <p className="mt-2 text-xs text-stone">
                          Owner review: {booking.post.ownerDecision === 'damage' ? 'Damage reported' : 'No damage reported'}.
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

      <AgreementModal
        booking={agreementBooking}
        resource={agreementResource}
        viewer={agreementViewer}
        onClose={() => setAgreementId(null)}
        onSign={signAgreement}
        onProceed={() => setAgreementId(null)}
      />

      <InspectionModal
        key={inspection ? `${inspection.bookingId}-${inspection.phase}` : 'no-inspection'}
        booking={inspectionBooking}
        resource={inspectionResource}
        phase={inspection?.phase ?? 'pre'}
        onClose={() => setInspection(null)}
        onComplete={() => void refreshBookings()}
      />

      <Modal
        open={noDamageConfirmationOpen}
        onClose={() => setNoDamageConfirmationOpen(false)}
        eyebrow="Return inspection"
        title="Owner reported no damage!"
      >
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            Thanks for using ResourcX!
          </p>
          <button
            type="button"
            onClick={() => setNoDamageConfirmationOpen(false)}
            className={`${btnPrimary} mt-6`}
          >
            Done
          </button>
        </div>
      </Modal>

      {proofDocument && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={proofDocument.name}
            className="flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-panel"
          >
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-medium text-white">{proofDocument.name}</h2>
              <button
                type="button"
                onClick={() => setProofDocument(null)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/10"
              >
                Close
              </button>
            </header>
            <object
              title={proofDocument.name}
              data={proofDocument.url}
              type="application/pdf"
              className="min-h-0 flex-1 bg-white"
            >
              <p className="p-4 text-sm text-ink">
                PDF preview is unavailable in this browser.{' '}
                <a href={proofDocument.url} download="booking-proof.pdf" className="underline">
                  Download the PDF
                </a>
                .
              </p>
            </object>
          </section>
        </div>
      )}

      <SiteFooter />
    </div>
  )
}