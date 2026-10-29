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
import { AgreementModal } from './agreement-modal'
import { Hero } from './hero'
import { InspectionModal } from './inspection-modal'
import { OwnerDashboard } from './owner-dashboard'
import { ResourceModal } from './resource-modal'
import { SiteNav } from './site-nav'
import { AdminModal } from './admin-modal'
import { NotificationsModal } from './notifications-modal'
import { ChatModal } from './chat-modal'
import { api, type NotificationItem } from '@/lib/api'
import { About } from './about'
import { FeaturedResources } from './featured-resources'
import { SearchSection } from './search-section'
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
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadChatsCount, setUnreadChatsCount] = useState(0)
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
      proofFiles: string[]
    }
  ) => {
    if (!user) return

    try {
      const result = await api.bookings.create({
        resource_id: resource.id,
        start_date: `${input.startDate}T09:00:00Z`,
        end_date: `${input.endDate}T17:00:00Z`,
        purpose: input.purpose,
        proof_files: input.proofFiles,
      })

      if (result.status === 'waitlisted') {
        alert(
          result.message ||
            'Slot busy. You have been placed on the FIFO waitlist.'
        )
      }

      setDetailId(null)
      void loadAppData()
      scrollToDashboard()
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
        chatUnreadCount={unreadChatsCount}
        onToggleChat={() => setChatOpen(true)}
        onToggleNotifications={() => setNotifsOpen(true)}
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

      {user && (
        <ChatModal
          open={chatOpen}
          user={user}
          mode={mode}
          bookings={bookings}
          resources={resources}
          onClose={() => setChatOpen(false)}
          onUnreadCountChange={setUnreadChatsCount}
        />
      )}

      {/* Admin modal */}
      <AdminModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
      />
    </div>
  )
}