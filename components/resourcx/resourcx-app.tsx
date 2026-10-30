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
} from '@/lib/resources'

import { api, type NotificationItem } from '@/lib/api'

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
    try {
      const [fetchedResources, fetchedBookings] = await Promise.all([
        api.resources.list({ lat, lng }),
        api.bookings.list().catch(() => []),
      ])

      setResources(fetchedResources)
      setBookings(fetchedBookings)

      // Fetch the current user session
      try {
        const me = await api.auth.getMe()

        if (me) {
          setUser(me)

          const myNotifs = await api.notifications
            .list()
            .catch(() => [])

          setNotifications(myNotifs)
        } else {
          setUser(null)
          setNotifications([])
        }
      } catch {
        // The visitor is not authenticated.
        setUser(null)
        setNotifications([])
      }
    } catch (err) {
      console.error('Error loading initial ResourcX data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAppData()
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
        onProfile={() => router.push('/account')}
      />

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