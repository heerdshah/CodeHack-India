'use client'

import { FileText } from 'lucide-react'
import { useState } from 'react'
import { RESOURCES, formatDate, type Booking } from '@/lib/resources'
import { InspectionStrip, Panel } from './user-dashboard'
import { StatusBadge, btnGhost, btnPrimary, inputCls } from './ui'

const REASONS = [
  'Lab undergoing maintenance during the requested window.',
  'Submitted credentials do not satisfy the safety certification requirement.',
  'Schedule conflict with a departmental teaching block.',
]

type Props = {
  bookings: Booking[]
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  onOpenAgreement: (id: string) => void
  onVerify: (id: string) => void
}

const res = (id: string) => RESOURCES.find((r) => r.id === id)!

export function OwnerDashboard({ bookings, onApprove, onReject, onOpenAgreement, onVerify }: Props) {
  const pending = bookings.filter((b) => b.status === 'pending')
  const toSign = bookings.filter((b) => b.status === 'approved' && !b.ownerSignature)
  const inspections = bookings.filter((b) => b.pre || b.post)

  const stats = [
    ['Listed assets', RESOURCES.length],
    ['Pending review', pending.length],
    ['Active access', bookings.filter((b) => b.status === 'active').length],
    ['Awaiting verification', bookings.filter((b) => b.status === 'returned').length],
  ] as const

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-panel p-4">
            <dd className="font-display text-3xl font-medium text-cream">{v}</dd>
            <dt className="mt-1 text-xs text-stone">{k}</dt>
          </div>
        ))}
      </dl>

      <Panel title={`Pending applicants (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-sm text-stone">No requests awaiting review.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => <ApplicantCard key={b.id} booking={b} onApprove={onApprove} onReject={onReject} />)}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Agreements awaiting owner signature">
          {toSign.length === 0 ? (
            <p className="text-sm text-stone">Nothing to sign.</p>
          ) : (
            <ul className="space-y-2">
              {toSign.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate">{res(b.resourceId).name}</span>
                    <span className="block truncate text-xs text-stone">{b.applicant.name}</span>
                  </span>
                  <button onClick={() => onOpenAgreement(b.id)} className={`${btnPrimary} shrink-0 px-4 py-2`}>Sign</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Managed equipment">
          <ul className="divide-y divide-white/5">
            {RESOURCES.map((r) => {
              const live = bookings.filter((b) => b.resourceId === r.id && !['completed', 'rejected'].includes(b.status)).length
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{r.name}</span>
                    <span className="block truncate text-xs text-stone">{r.location}</span>
                  </span>
                  <span className="shrink-0 text-xs text-stone">
                    {live} live · {r.queue} queued
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Pre / post inspection uploads">
        {inspections.length === 0 ? (
          <p className="text-sm text-stone">No inspections submitted yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {inspections.map((b) => (
              <li key={b.id} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{res(b.resourceId).name}</p>
                    <p className="truncate text-xs text-stone">{b.applicant.name}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                {b.pre && <InspectionStrip label="Check-in" set={b.pre} />}
                {b.post && <InspectionStrip label="Return" set={b.post} />}
                {b.status === 'returned' && (
                  <button onClick={() => onVerify(b.id)} className={`${btnPrimary} mt-3 w-full`}>
                    Manually verify condition & close
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function ApplicantCard({ booking: b, onApprove, onReject }: { booking: Booking; onApprove: (id: string) => void; onReject: (id: string, reason: string) => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const r = res(b.resourceId)

  return (
    <li className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {b.applicant.name} {b.isMine && <span className="text-xs text-cream">(you)</span>}
          </p>
          <p className="text-xs text-stone">
            {b.applicant.role} · {b.applicant.department}
          </p>
        </div>
        <span className="text-xs text-stone">
          {formatDate(b.startDate)} – {formatDate(b.endDate)}
        </span>
      </div>
      <p className="mt-3 text-sm">
        <span className="text-stone">Requesting</span> {r.name}
      </p>
      <p className="mt-1 text-sm text-white/70">&ldquo;{b.purpose}&rdquo;</p>
      <p className="mt-3 text-xs text-stone">Rules: {r.criteria.join(' · ')}</p>
      {b.proofFiles.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {b.proofFiles.map((f) => (
            <li key={f} className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-white/5 px-2.5 py-1 text-xs text-cream ring-1 ring-white/10">
              <FileText className="size-3" aria-hidden /> {f}
            </li>
          ))}
        </ul>
      )}
      {b.proofFiles.length === 0 && <p className="mt-2 text-xs text-emerald-300">All criteria matched on verified profile.</p>}

      {rejecting ? (
        <div className="mt-4 space-y-2">
          <label htmlFor={`reason-${b.id}`} className="text-xs text-stone">Transparent explanation for the applicant</label>
          <select id={`reason-${b.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} [color-scheme:dark]`}>
            {REASONS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setRejecting(false)} className={`${btnGhost} flex-1`}>Back</button>
            <button onClick={() => onReject(b.id, reason)} className={`${btnGhost} flex-1 border-red-400/40 text-red-200 hover:bg-red-400/10`}>Confirm rejection</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button onClick={() => setRejecting(true)} className={`${btnGhost} flex-1`}>Reject</button>
          <button onClick={() => onApprove(b.id)} className={`${btnPrimary} flex-1`}>Approve</button>
        </div>
      )}
    </li>
  )
}
