'use client'

import { useState, useEffect } from 'react'
import {
  addDays,
  type Booking,
  type InspectionSet,
  type Mode,
  type Resource,
  type UserProfile,
  type WaitlistEntry,
} from '@/lib/resources'
import { AgreementModal } from './agreement-modal'
import { AuthModal } from './auth-modal'
import { Catalogue } from './catalogue'
import { Hero } from './hero'
import { InspectionModal } from './inspection-modal'
import { Mission } from './mission'
import { OwnerDashboard } from './owner-dashboard'
import { ResourceModal } from './resource-modal'
import { SiteNav } from './site-nav'
import { SectionHeading } from './ui'
import { UserDashboard } from './user-dashboard'
import { AdminModal } from './admin-modal'
import { NotificationsModal } from './notifications-modal'
import { api, type NotificationItem } from '@/lib/api'

const scrollToDashboard = () =>
  setTimeout(() => document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' }), 50)

export function ResourcXApp() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [mode, setMode] = useState<Mode>('user')
  const [query, setQuery] = useState('')
  const [resources, setResources] = useState<Resource[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [authOpen, setAuthOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [pendingResourceId, setPendingResourceId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [inspection, setInspection] = useState<{ id: string; phase: 'pre' | 'post' } | null>(null)

  // Data loader
  const loadAppData = async (lat?: number | null, lng?: number | null) => {
    try {
      const [fetchedResources, fetchedBookings] = await Promise.all([
        api.resources.list({ lat, lng }),
        api.bookings.list().catch(() => []),
      ])
      setResources(fetchedResources)
      setBookings(fetchedBookings)

      // Fetch user profile session
      try {
        const me = await api.auth.getMe()
        if (me) {
          setUser(me)
          const myNotifs = await api.notifications.list().catch(() => [])
          setNotifications(myNotifs)
        }
      } catch {
        // Not authenticated yet
      }
    } catch (err) {
      console.error('Error loading initial ResourcX data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppData()
  }, [])

  const detail = resources.find((r) => r.id === detailId) ?? null
  const agreement = bookings.find((b) => b.id === agreementId) ?? null
  const inspected = bookings.find((b) => b.id === inspection?.id) ?? null
  const resourceOf = (b: Booking | null) =>
    b ? resources.find((r) => r.id === b.resourceId) ?? null : null
  const mine = bookings.filter((b) => b.isMine)

  const openResource = (r: Resource) => {
    if (!user) {
      setPendingResourceId(r.id)
      setAuthOpen(true)
      return
    }
    setDetailId(r.id)
  }

  const handleAuthSuccess = (u: UserProfile) => {
    setUser(u)
    setAuthOpen(false)
    loadAppData()
    if (pendingResourceId) setDetailId(pendingResourceId)
    setPendingResourceId(null)
  }

  const submitRequest = async (
    r: Resource,
    input: { startDate: string; endDate: string; purpose: string; proofFiles: string[] }
  ) => {
    if (!user) return
    try {
      const result = await api.bookings.create({
        resource_id: r.id,
        start_date: `${input.startDate}T09:00:00Z`,
        end_date: `${input.endDate}T17:00:00Z`,
        purpose: input.purpose,
        proof_files: input.proofFiles,
      })

      if (result.status === 'waitlisted') {
        alert(result.message || 'Slot busy. You have been placed on the FIFO waitlist.')
      }

      setDetailId(null)
      loadAppData()
      scrollToDashboard()
    } catch (err: any) {
      alert(`Booking request failed: ${err.message}`)
    }
  }

  const approve = async (id: string) => {
    try {
      await api.bookings.updateStatus(id, 'approved')
      setAgreementId(id)
      loadAppData()
    } catch (err: any) {
      alert(`Approval error: ${err.message}`)
    }
  }

  const reject = async (id: string, reason: string) => {
    try {
      await api.bookings.updateStatus(id, 'rejected', reason)
      loadAppData()
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`)
    }
  }

  const sign = async (party: 'user' | 'owner', dataUrl: string, hash: string) => {
    if (!agreement) return
    try {
      await api.bookings.sign(agreement.id, {
        signer_role: party,
        signature_data: dataUrl,
        document_hash: hash,
      })
      loadAppData()
    } catch (err: any) {
      alert(`Signing error: ${err.message}`)
      throw err
    }
  }

  const completeInspection = (set: InspectionSet) => {
    if (!inspection) return
    loadAppData()
  }

  const changeMode = (m: Mode) => {
    // Only allow mode switch if user has owner or higher role
    if (m === 'owner' && user && !['owner', 'admin', 'manager'].includes(user.systemRole || '')) {
      alert('Access restricted: Only facility owners and administrators can access Owner Mode.')
      return
    }
    setMode(m)
    scrollToDashboard()
  }

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav
        query={query}
        onQuery={setQuery}
        mode={mode}
        onMode={changeMode}
        user={user}
        onPick={openResource}
        resourcesList={resources}
        unreadCount={unreadNotifsCount}
        onToggleNotifications={() => setNotifsOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onProfile={() => {
          if (!user) return setAuthOpen(true)
          setMode('user')
          scrollToDashboard()
        }}
      />

      <main>
        <Hero />
        <Mission />
        <Catalogue
          resources={resources}
          query={query}
          onClearQuery={() => setQuery('')}
          onView={openResource}
          onBook={openResource}
          onLocationSort={(lat, lng) => loadAppData(lat, lng)}
        />

        <section id="dashboard" aria-labelledby="dashboard-title" className="scroll-mt-28 mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6">
          <SectionHeading
            index="03"
            eyebrow={mode === 'user' ? 'Borrower Hub' : 'Facility Management'}
            title={mode === 'user' ? 'Everything you’ve borrowed, in one ledger.' : 'Review, approve, sign, and verify.'}
            id="dashboard-title"
          />
          <div className="mt-10">
            {mode === 'user' ? (
              <UserDashboard
                user={user}
                bookings={mine}
                waitlist={waitlist}
                resources={resources}
                onRegister={() => setAuthOpen(true)}
                onOpenAgreement={setAgreementId}
                onInspect={(id, phase) => setInspection({ id, phase })}
                onRefreshUser={loadAppData}
              />
            ) : (
              <OwnerDashboard
                bookings={bookings}
                resources={resources}
                onApprove={approve}
                onReject={reject}
                onOpenAgreement={setAgreementId}
                onVerify={async (id) => {
                  await api.bookings.updateStatus(id, 'completed')
                  loadAppData()
                }}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-stone sm:flex-row sm:justify-between sm:px-6">
          <p>ResourcX — Intra-institutional asset sharing. No payments, full accountability.</p>
          <p>Connected to FastAPI & Supabase</p>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onRegister={handleAuthSuccess}
      />

      {detail && user && (
        <ResourceModal
          key={detail.id}
          resource={detail}
          user={user}
          activeBooking={mine.find((b) => b.resourceId === detail.id && !['completed', 'rejected', 'cancelled'].includes(b.status))}
          waitEntry={waitlist.find((w) => w.resourceId === detail.id)}
          onClose={() => setDetailId(null)}
          onSubmit={(input) => submitRequest(detail, input)}
          onJoinWaitlist={() => {}}
        />
      )}

      {/* Split Agreement Modal: viewer enforces borrower vs owner perspective */}
      <AgreementModal
        booking={agreement}
        resource={resourceOf(agreement)}
        viewer={mode}
        onClose={() => setAgreementId(null)}
        onSign={sign}
        onProceed={() => {
          if (!agreement) return
          setAgreementId(null)
          setInspection({ id: agreement.id, phase: 'pre' })
        }}
      />

      <InspectionModal
        key={inspection ? `${inspection.id}-${inspection.phase}` : 'none'}
        booking={inspected}
        resource={resourceOf(inspected)}
        phase={inspection?.phase ?? 'pre'}
        onClose={() => setInspection(null)}
        onComplete={completeInspection}
      />

      <NotificationsModal
        open={notifsOpen}
        notifications={notifications}
        onClose={() => setNotifsOpen(false)}
        onRefresh={loadAppData}
      />

      <AdminModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
      />
    </div>
  )
}
