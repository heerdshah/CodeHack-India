'use client'

import { useState } from 'react'
import {
  RESOURCES,
  SEED_BOOKINGS,
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

const scrollToDashboard = () =>
  setTimeout(() => document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' }), 50)

export function ResourcXApp() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [mode, setMode] = useState<Mode>('user')
  const [query, setQuery] = useState('')
  const [bookings, setBookings] = useState<Booking[]>(SEED_BOOKINGS)
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingResourceId, setPendingResourceId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [inspection, setInspection] = useState<{ id: string; phase: 'pre' | 'post' } | null>(null)

  const detail = RESOURCES.find((r) => r.id === detailId) ?? null
  const agreement = bookings.find((b) => b.id === agreementId) ?? null
  const inspected = bookings.find((b) => b.id === inspection?.id) ?? null
  const resourceOf = (b: Booking | null) => (b ? RESOURCES.find((r) => r.id === b.resourceId) ?? null : null)
  const mine = bookings.filter((b) => b.isMine)

  const update = (id: string, patch: Partial<Booking>) =>
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const openResource = (r: Resource) => {
    if (!user) {
      setPendingResourceId(r.id)
      setAuthOpen(true)
      return
    }
    setDetailId(r.id)
  }

  const register = (u: UserProfile) => {
    setUser(u)
    setAuthOpen(false)
    if (pendingResourceId) setDetailId(pendingResourceId)
    setPendingResourceId(null)
  }

  const submitRequest = (r: Resource, input: Pick<Booking, 'startDate' | 'endDate' | 'purpose' | 'proofFiles'>) => {
    if (!user) return
    setBookings((bs) => [
      {
        id: `bk-${Date.now()}`,
        resourceId: r.id,
        applicant: { name: user.fullName, role: user.role, department: user.department, email: user.email },
        isMine: true,
        status: 'pending',
        ...input,
      },
      ...bs,
    ])
  }

  const joinWaitlist = (r: Resource, startDate: string) => {
    const ahead = r.queue + waitlist.filter((w) => w.resourceId === r.id).length
    const position = ahead + 1
    setWaitlist((w) => [
      ...w,
      { id: `wl-${Date.now()}`, resourceId: r.id, position, startDate, eta: addDays(r.bookedUntil ?? startDate, 1 + ahead * 3) },
    ])
  }

  const approve = (id: string) => {
    update(id, { status: 'approved' })
    setAgreementId(id)
  }

  const sign = (party: 'user' | 'owner', dataUrl: string) => {
    if (!agreement) return
    const next = { ...agreement, [party === 'user' ? 'userSignature' : 'ownerSignature']: dataUrl }
    update(agreement.id, {
      [party === 'user' ? 'userSignature' : 'ownerSignature']: dataUrl,
      ...(next.userSignature && next.ownerSignature ? { status: 'signed' as const } : {}),
    })
  }

  const completeInspection = (set: InspectionSet) => {
    if (!inspection) return
    if (inspection.phase === 'pre') {
      update(inspection.id, { pre: set, status: 'active', otp: String(Math.floor(100000 + Math.random() * 900000)) })
    } else {
      update(inspection.id, { post: set, status: 'returned' })
    }
  }

  const changeMode = (m: Mode) => {
    setMode(m)
    scrollToDashboard()
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav
        query={query}
        onQuery={setQuery}
        mode={mode}
        onMode={changeMode}
        user={user}
        onPick={openResource}
        onProfile={() => {
          if (!user) return setAuthOpen(true)
          setMode('user')
          scrollToDashboard()
        }}
      />

      <main>
        <Hero />
        <Mission />
        <Catalogue query={query} onClearQuery={() => setQuery('')} onView={openResource} onBook={openResource} />

        <section id="dashboard" aria-labelledby="dashboard-title" className="scroll-mt-28 mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6">
          <SectionHeading
            index="03"
            eyebrow={mode === 'user' ? 'User profile' : 'Owner management'}
            title={mode === 'user' ? 'Everything you’ve borrowed, in one ledger.' : 'Review, approve, sign, and verify.'}
            id="dashboard-title"
          />
          <div className="mt-10">
            {mode === 'user' ? (
              <UserDashboard
                user={user}
                bookings={mine}
                waitlist={waitlist}
                onRegister={() => setAuthOpen(true)}
                onOpenAgreement={setAgreementId}
                onInspect={(id, phase) => setInspection({ id, phase })}
              />
            ) : (
              <OwnerDashboard
                bookings={bookings}
                onApprove={approve}
                onReject={(id, reason) => update(id, { status: 'rejected', rejectionReason: reason })}
                onOpenAgreement={setAgreementId}
                onVerify={(id) => update(id, { status: 'completed', ownerVerified: true })}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-stone sm:flex-row sm:justify-between sm:px-6">
          <p>ResourcX — Intra-institutional asset sharing. No payments, full accountability.</p>
          <p>Demo build · state resets on reload</p>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onRegister={register} />

      {detail && user && (
        <ResourceModal
          key={detail.id}
          resource={detail}
          user={user}
          activeBooking={mine.find((b) => b.resourceId === detail.id && !['completed', 'rejected'].includes(b.status))}
          waitEntry={waitlist.find((w) => w.resourceId === detail.id)}
          onClose={() => setDetailId(null)}
          onSubmit={(input) => submitRequest(detail, input)}
          onJoinWaitlist={(start) => joinWaitlist(detail, start)}
        />
      )}

      <AgreementModal
        booking={agreement}
        resource={resourceOf(agreement)}
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
    </div>
  )
}
