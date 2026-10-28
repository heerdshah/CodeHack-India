'use client'

import { BadgeCheck, FileText } from 'lucide-react'
import { RESOURCES, formatDate, type Booking, type UserProfile, type WaitlistEntry } from '@/lib/resources'
import { AccessPass } from './inspection-modal'
import { QueueWidget } from './resource-modal'
import { StatusBadge, btnGhost, btnPrimary } from './ui'

type Props = {
  user: UserProfile | null
  bookings: Booking[]
  waitlist: WaitlistEntry[]
  onRegister: () => void
  onOpenAgreement: (id: string) => void
  onInspect: (id: string, phase: 'pre' | 'post') => void
}

const res = (id: string) => RESOURCES.find((r) => r.id === id)!

export function UserDashboard({ user, bookings, waitlist, onRegister, onOpenAgreement, onInspect }: Props) {
  if (!user)
    return (
      <div className="rounded-3xl border border-white/10 bg-panel p-6 text-center sm:p-10">
        <p className="font-display text-2xl font-medium">Your profile lives here.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone">
          Register with your institutional email to track reservations, agreements, queue positions, and inspections.
        </p>
        <button onClick={onRegister} className={`${btnPrimary} mt-6`}>Create verified account</button>
      </div>
    )

  const signed = bookings.filter((b) => b.userSignature && b.ownerSignature)
  const inspected = bookings.filter((b) => b.pre || b.post)

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-white/10 bg-panel p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-cream font-display font-semibold text-ink">
              {user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-stone">{user.email}</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-wider text-stone">Job badges</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            <li className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-ink">
              <BadgeCheck className="size-3.5" aria-hidden /> Verified {user.role}
            </li>
            <li className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/10">{user.department}</li>
            {user.credentials.map((c) => (
              <li key={c} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/10">{c}</li>
            ))}
          </ul>
          <p className="mt-5 text-[11px] uppercase tracking-wider text-stone">Verification files</p>
          <ul className="mt-2 space-y-1.5">
            {user.verificationFiles.map((f) => (
              <li key={f} className="flex items-center gap-2 truncate text-sm text-white/80">
                <FileText className="size-4 shrink-0 text-stone" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>

        {waitlist.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-stone">Waiting list rankings</p>
            {waitlist.map((w) => <QueueWidget key={w.id} entry={w} resourceName={res(w.resourceId).name} />)}
          </div>
        )}
      </aside>

      <div className="space-y-5">
        <Panel title="Active reservations">
          {bookings.length === 0 ? (
            <p className="text-sm text-stone">No reservations yet. Book a resource from the catalogue.</p>
          ) : (
            <ul className="space-y-3">
              {bookings.map((b) => {
                const r = res(b.resourceId)
                return (
                  <li key={b.id} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-stone">
                          {formatDate(b.startDate)} – {formatDate(b.endDate)} · {r.owner}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <BookingAction booking={b} onOpenAgreement={onOpenAgreement} onInspect={onInspect} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Signed agreements">
            {signed.length === 0 ? (
              <p className="text-sm text-stone">Executed agreements appear here.</p>
            ) : (
              <ul className="space-y-2">
                {signed.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => onOpenAgreement(b.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-white/5">
                      <FileText className="size-4 text-cream" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">RX-{b.id.slice(-6).toUpperCase()} · {res(b.resourceId).name}</span>
                      <span className="text-xs text-stone">PDF</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Inspection history">
            {inspected.length === 0 ? (
              <p className="text-sm text-stone">Six-angle inspections appear here.</p>
            ) : (
              <ul className="space-y-3">
                {inspected.map((b) => (
                  <li key={b.id}>
                    <p className="text-sm">{res(b.resourceId).name}</p>
                    {(['pre', 'post'] as const).map((p) => b[p] && <InspectionStrip key={p} label={p === 'pre' ? 'Check-in' : 'Return'} set={b[p]!} />)}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function BookingAction({ booking: b, onOpenAgreement, onInspect }: { booking: Booking; onOpenAgreement: (id: string) => void; onInspect: (id: string, phase: 'pre' | 'post') => void }) {
  const r = res(b.resourceId)
  switch (b.status) {
    case 'pending':
      return <p className="mt-3 text-sm text-white/70">Awaiting {r.owner}&apos;s review of your credentials and request.</p>
    case 'rejected':
      return (
        <div className="mt-3 rounded-xl bg-red-400/10 p-3 ring-1 ring-red-400/25">
          <p className="text-xs uppercase tracking-wider text-red-300">Owner&apos;s explanation</p>
          <p className="mt-1 text-sm text-white/85">{b.rejectionReason}</p>
        </div>
      )
    case 'approved':
      return (
        <button onClick={() => onOpenAgreement(b.id)} className={`${btnPrimary} mt-3 w-full sm:w-auto`}>
          {b.userSignature ? 'View agreement — awaiting owner' : 'Review & sign agreement'}
        </button>
      )
    case 'signed':
      return <button onClick={() => onInspect(b.id, 'pre')} className={`${btnPrimary} mt-3 w-full sm:w-auto`}>Start pre-checkin inspection</button>
    case 'active':
      return (
        <div className="mt-3 space-y-3">
          {b.otp && <AccessPass otp={b.otp} resource={r} />}
          <button onClick={() => onInspect(b.id, 'post')} className={`${btnGhost} w-full sm:w-auto`}>Return & upload post-inspection</button>
        </div>
      )
    case 'returned':
      return <p className="mt-3 text-sm text-white/70">AI scan complete. {r.owner} is manually verifying condition.</p>
    case 'completed':
      return <p className="mt-3 text-sm text-stone">Closed. Thank you for returning the asset in good standing.</p>
  }
}

export function InspectionStrip({ label, set }: { label: string; set: NonNullable<Booking['pre']> }) {
  return (
    <div className="mt-2">
      <p className={`text-xs ${set.flagged ? 'text-amber-200' : 'text-stone'}`}>
        {label} · {formatDate(set.completedAt)} · {set.findings[0]}
      </p>
      <ul className="mt-1.5 grid grid-cols-6 gap-1">
        {Object.entries(set.photos).map(([angle, src]) => (
          <li key={angle} className="relative aspect-square overflow-hidden rounded-md ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded previews */}
            <img src={src} alt={`${label} ${angle}`} className="size-full object-cover" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-panel p-5">
      <h3 className="mb-4 text-[11px] font-medium uppercase tracking-wider text-stone">{title}</h3>
      {children}
    </section>
  )
}
