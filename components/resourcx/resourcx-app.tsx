'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  type Booking,
  type InspectionSet,
  type Mode,
  type Resource,
  type UserProfile,
  type WaitlistEntry,
  AUTH_PROFILE_CACHE_KEY,
  PENDING_AUTH_PROFILE_KEY,
  isUserProfile,
} from '@/lib/resources'

import { api, ApiError, type NotificationItem } from '@/lib/api'

import { About } from './about'
import { AdminModal } from './admin-modal'
import { AgreementModal } from './agreement-modal'
import { BookingConfirmationModal } from './booking-confirmation-modal'
import { FeaturedResources } from './featured-resources'
import { Hero } from './hero'
import { InspectionModal } from './inspection-modal'
import { NotificationsModal } from './notifications-modal'

import { ResourceModal } from './resource-modal'
import { SearchSection } from './search-section'
import { SiteNav } from './site-nav'
import { SiteFooter } from './site-footer'


const scrollToDashboard = () =>
  setTimeout(() => {
    document
      .getElementById('dashboard')
      ?.scrollIntoView({ behavior: 'smooth' })
  }, 50)

export function ResourcXApp() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [mode, setMode] = useState<Mode>('user')
  const [resources, setResources] = useState<Resource[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loginNotice, setLoginNotice] = useState('')

  // Modals state
  const [adminOpen, setAdminOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [bookingConfirmationOpen, setBookingConfirmationOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [inspection, setInspection] = useState<{
    id: string
    phase: 'pre' | 'post'
  } | null>(null)

  // Data loader
  const loadAppData = async (
    lat?: number | null,
    lng?: number | null
  ) => {
    const loadResourcesAndBookings = async () => {
      try {
        const [fetchedResources, fetchedBookings] = await Promise.all([
          api.resources.list({ lat, lng }),
          api.bookings.list().catch(() => []),
        ])

        setResources(fetchedResources)
        setBookings(fetchedBookings)
      } catch (err) {
        console.error('Error loading initial ResourcX data:', err)
      }
    }

    const loadCurrentUser = async () => {
      try {
        const me = await api.auth.getMe()
        setUser(me)
        try {
          sessionStorage.setItem(AUTH_PROFILE_CACHE_KEY, JSON.stringify(me))
        } catch (error) {
          console.error('Unable to cache the authenticated profile:', error)
        }
        setNotifications(
          me ? await api.notifications.list().catch(() => []) : []
        )
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          try {
            sessionStorage.removeItem(AUTH_PROFILE_CACHE_KEY)
          } catch (storageError) {
            console.error('Unable to clear the expired profile cache:', storageError)
          }
          setUser(null)
          setNotifications([])
        } else {
          console.error('Unable to refresh the current user session:', error)
        }
      }
    }

    try {
      await Promise.all([loadResourcesAndBookings(), loadCurrentUser()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let noticeTimeout: number | undefined
    try {
      const pendingProfile = sessionStorage.getItem(PENDING_AUTH_PROFILE_KEY)
      const cachedProfile = sessionStorage.getItem(AUTH_PROFILE_CACHE_KEY)
      if (pendingProfile) {
        sessionStorage.removeItem(PENDING_AUTH_PROFILE_KEY)
      }
      if (cachedProfile || pendingProfile) {
        const parsedProfile: unknown = JSON.parse(cachedProfile || pendingProfile || '')
        if (isUserProfile(parsedProfile)) {
          setUser(parsedProfile)
          if (pendingProfile) {
            setLoginNotice(`Signed in successfully. Welcome back, ${parsedProfile.fullName}.`)
            noticeTimeout = window.setTimeout(() => setLoginNotice(''), 5000)
          }
        } else {
          sessionStorage.removeItem(AUTH_PROFILE_CACHE_KEY)
          console.error('The saved sign-in profile is invalid.')
        }
      }
    } catch (error) {
      console.error('Unable to restore the signed-in profile:', error)
    }

    void loadAppData()
    return () => {
      if (noticeTimeout !== undefined) window.clearTimeout(noticeTimeout)
    }
  }, [])

  useEffect(() => {
    const handleAuthChange = (event: WindowEventMap['resourcx:auth-changed']) => {
      setUser(event.detail)
      try {
        sessionStorage.setItem(AUTH_PROFILE_CACHE_KEY, JSON.stringify(event.detail))
      } catch (error) {
        console.error('Unable to cache the authenticated profile:', error)
      }
      void loadAppData()
    }

    const handleSessionExpired = () => {
      setUser(null)
      setNotifications([])
    }

    window.addEventListener('resourcx:auth-changed', handleAuthChange)
    window.addEventListener('resourcx:session-expired', handleSessionExpired)
    return () => {
      window.removeEventListener('resourcx:auth-changed', handleAuthChange)
      window.removeEventListener('resourcx:session-expired', handleSessionExpired)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return

    let active = true
    const refreshNotifications = async () => {
      try {
        const latest = await api.notifications.list()
        if (active) setNotifications(latest)
      } catch (err) {
        console.error('Unable to refresh notifications:', err)
      }
    }

    const refresh = () => void refreshNotifications()
    const intervalId = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
    }
  }, [user?.id])

  const detail =
    resources.find((resource) => resource.id === detailId) ?? null

  const agreement =
    bookings.find((booking) => booking.id === agreementId) ?? null

  const inspected =
    bookings.find((booking) => booking.id === inspection?.id) ?? null

  const resourceOf = (booking: Booking | null) =>
    booking
      ? resources.find(
          (resource) => resource.id === booking.resourceId
        ) ?? null
      : null

  const mine = bookings.filter((booking) => booking.isMine)

  const openResource = (resource: Resource) => {
    if (!user) {
      router.push('/sign-in')
      return
    }

    setDetailId(resource.id)
  }

  const submitRequest = async (
    resource: Resource,
    input: {
      startDate: string
      endDate: string
      purpose: string
      proofFiles: File[]
    }
  ) => {
    if (!user) return

    try {
      const uploadedProofs = await Promise.all(
        input.proofFiles.map((file) => api.bookings.uploadProof(file))
      )
      const result = await api.bookings.create({
        resource_id: resource.id,
        start_date: `${input.startDate}T09:00:00Z`,
        end_date: `${input.endDate}T17:00:00Z`,
        purpose: input.purpose,
        proof_files: uploadedProofs.map((proof) => proof.path),
      })

      if (result.status === 'waitlisted') {
        alert(
          result.message ||
            'Slot busy. You have been placed on the FIFO waitlist.'
        )
      } else {
        setBookingConfirmationOpen(true)
      }

      setDetailId(null)
      void loadAppData()
      if (result.status === 'waitlisted') scrollToDashboard()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'

      alert(`Booking request failed: ${message}`)
    }
  }

  const approve = async (id: string) => {
    try {
      await api.bookings.updateStatus(id, 'approved')
      setAgreementId(id)
      void loadAppData()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'

      alert(`Approval error: ${message}`)
    }
  }

  const reject = async (id: string, reason: string) => {
    try {
      await api.bookings.updateStatus(id, 'rejected', reason)
      void loadAppData()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'

      alert(`Rejection error: ${message}`)
    }
  }

  const sign = async (
    party: 'user' | 'owner',
    dataUrl: string,
    hash: string
  ) => {
    if (!agreement) return

    try {
      await api.bookings.sign(agreement.id, {
        signer_role: party,
        signature_data: dataUrl,
        document_hash: hash,
      })

      void loadAppData()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'

      alert(`Signing error: ${message}`)
      throw err
    }
  }

  const completeInspection = (_set: InspectionSet) => {
    if (!inspection) return

    void loadAppData()
  }

  const changeMode = (nextMode: Mode) => {
    // Only allow mode switching for owners and administrators.
    if (
      nextMode === 'owner' &&
      user &&
      !['owner', 'admin', 'manager'].includes(
        user.systemRole || ''
      )
    ) {
      alert(
        'Access restricted: Only facility owners and administrators can access Owner Mode.'
      )
      return
    }

    setMode(nextMode)
    scrollToDashboard()
  }

  const unreadNotifsCount = notifications.filter(
    (notification) => !notification.is_read
  ).length

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav
        user={user}
        mode={mode}
        onMode={changeMode}
        unreadCount={unreadNotifsCount}
        onToggleNotifications={() => {
          setNotifsOpen(true)
          void api.notifications.list()
            .then(setNotifications)
            .catch((err: unknown) => {
              console.error('Unable to refresh notifications:', err)
            })
        }}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      {loginNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-lg border border-cream/30 bg-ink px-5 py-3 text-sm text-cream shadow-xl"
        >
          {loginNotice}
        </div>
      )}

      <main>
        <Hero />

        <SearchSection
          resources={resources}
          onPick={openResource}
        />

        <FeaturedResources
          resources={resources}
          loading={loading}
          onView={openResource}
        />

        <About />

        
      </main>

      <SiteFooter />

      {/* Resource details and booking modal */}
      {detail && user && (
        <ResourceModal
          key={detail.id}
          resource={detail}
          user={user}
          activeBooking={mine.find(
            (booking) =>
              booking.resourceId === detail.id &&
              !['completed', 'rejected', 'cancelled'].includes(
                booking.status
              )
          )}
          waitEntry={waitlist.find(
            (entry) => entry.resourceId === detail.id
          )}
          onClose={() => setDetailId(null)}
          onSubmit={(input) => submitRequest(detail, input)}
          onJoinWaitlist={() => {}}
        />
      )}

      {/* Agreement modal */}
      <AgreementModal
        booking={agreement}
        resource={resourceOf(agreement)}
        viewer={mode}
        onClose={() => setAgreementId(null)}
        onSign={sign}
        onProceed={() => {
          if (!agreement) return

          setAgreementId(null)
          setInspection({
            id: agreement.id,
            phase: 'pre',
          })
        }}
      />

      {/* Inspection modal */}
      <InspectionModal
        key={
          inspection
            ? `${inspection.id}-${inspection.phase}`
            : 'none'
        }
        booking={inspected}
        resource={resourceOf(inspected)}
        phase={inspection?.phase ?? 'pre'}
        onClose={() => setInspection(null)}
        onComplete={completeInspection}
      />

      {/* Notifications modal */}
      <NotificationsModal
        open={notifsOpen}
        notifications={notifications}
        onClose={() => setNotifsOpen(false)}
        onRefresh={loadAppData}
      />

      <BookingConfirmationModal
        open={bookingConfirmationOpen}
        onClose={() => setBookingConfirmationOpen(false)}
      />

      {/* Admin modal */}
      <AdminModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
      />
    </div>
  )
}