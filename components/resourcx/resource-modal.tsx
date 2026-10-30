'use client'

import { AlertTriangle, Check, Clock, ShieldCheck, X } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { formatDate, formatHourlyRate, missingCriteria, type Booking, type Resource, type UserProfile, type WaitlistEntry } from '@/lib/resources'
import { FileDrop, Modal, StatusBadge, btnGhost, btnPrimary, inputCls, labelCls } from './ui'

type Props = {
  resource: Resource
  user: UserProfile
  activeBooking?: Booking
  waitEntry?: WaitlistEntry
  onClose: () => void
  onSubmit: (input: { startDate: string; endDate: string; purpose: string; proofFiles: File[] }) => void
  onJoinWaitlist: (startDate: string) => void
}

export function ResourceModal({ resource, user, activeBooking, waitEntry, onClose, onSubmit, onJoinWaitlist }: Props) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [purpose, setPurpose] = useState('')
  const [proofs, setProofs] = useState<Record<string, string[]>>({})
  const [proofFiles, setProofFiles] = useState<Record<string, File[]>>({})

  const missing = missingCriteria(user, resource)
  const unresolved = missing.filter((c) => !proofs[c]?.length)
  const conflict = Boolean(resource.bookedUntil && start && start <= resource.bookedUntil)
  const datesValid = Boolean(start && end && end >= start)
  const canSubmit = datesValid && purpose.trim().length > 4 && unresolved.length === 0 && !conflict

  return (
    <Modal open onClose={onClose} wide eyebrow={resource.category} title={resource.name}>
      <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src={resource.image} alt={resource.name} fill sizes="(min-width:768px) 40vw, 100vw" className="object-cover" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/75">{resource.description}</p>
          {resource.hourlyRate != null && (
            <section aria-label="Pricing and assistance" className="mt-4 rounded-2xl bg-cream/[0.06] p-4 ring-1 ring-cream/10">
              <p className="text-xs uppercase tracking-wider text-stone">Indicative use price</p>
              <p className="mt-1 font-display text-xl font-medium text-cream">
                {formatHourlyRate(resource.hourlyRate)}
              </p>
              {resource.assistance ? (
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Optional help from {resource.assistance.name} ({resource.assistance.qualification}) is
                  {' '}+{formatHourlyRate(resource.assistance.hourlyRate)} extra.
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/70">Listed for independent use.</p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-stone">
                Sample listing only. Confirm final pricing and staff availability with the facility owner.
              </p>
            </section>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {[
              ['Owner', resource.owner],
              ['Department', resource.department],
              ['Location', resource.location],
              ['Condition', resource.condition],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-stone">{k}</dt>
                <dd className="mt-0.5 text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-4">
          <section aria-labelledby="elig-title" className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
            <h3 id="elig-title" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-stone">
              <ShieldCheck className="size-3.5 text-cream" aria-hidden /> Automatic eligibility check
            </h3>
            <ul className="mt-3 space-y-2">
              {resource.criteria.map((c) => {
                const held = !missing.includes(c)
                const proofed = Boolean(proofs[c]?.length)
                return (
                  <li key={c} className="flex items-start gap-2 text-sm">
                    {held ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-label="Met" />
                    ) : proofed ? (
                      <Clock className="mt-0.5 size-4 shrink-0 text-amber-200" aria-label="Proof submitted" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-red-300" aria-label="Not met" />
                    )}
                    <span className={held ? 'text-white' : 'text-white/75'}>
                      {c}
                      {proofed && <span className="block text-xs text-amber-200/80">Proof attached — owner will verify</span>}
                    </span>
                  </li>
                )
              })}
            </ul>

            {missing.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                {unresolved.length > 0 && (
                  <p role="alert" className="flex items-start gap-2 text-sm text-amber-200">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Eligibility criteria not met. Upload required credential proof below to apply.
                  </p>
                )}
                {missing.map((c) => (
                  <FileDrop
                    key={c}
                    compact
                    label={`Upload proof: ${c}`}
                    accept=".pdf,application/pdf"
                    files={proofs[c] ?? []}
                    onFiles={(names) => setProofs((p) => ({ ...p, [c]: names }))}
                    onSelectFiles={(files) => setProofFiles((p) => ({ ...p, [c]: files }))}
                  />
                ))}
              </div>
            )}
          </section>

          {activeBooking ? (
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10" aria-live="polite">
              <StatusBadge status={activeBooking.status} />
              <p className="mt-3 text-sm text-white/75">
                {activeBooking.status === 'pending'
                  ? `Your request for ${formatDate(activeBooking.startDate)} – ${formatDate(activeBooking.endDate)} is with ${resource.owner}. Requests are never auto-approved.`
                  : 'Track this booking from your profile dashboard.'}
              </p>
            </div>
          ) : (
            <section aria-labelledby="book-title" className="space-y-3">
              <h3 id="book-title" className="text-xs font-medium uppercase tracking-wider text-stone">Request access</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="b-start" className={labelCls}>From</label>
                  <input id="b-start" type="date" min="2026-10-28" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                </div>
                <div>
                  <label htmlFor="b-end" className={labelCls}>To</label>
                  <input id="b-end" type="date" min={start || '2026-10-28'} value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>

              {conflict && resource.bookedUntil && (
                <QueueNotice resource={resource} waitEntry={waitEntry} onJoin={() => onJoinWaitlist(start)} />
              )}

              <div>
                <label htmlFor="b-purpose" className={labelCls}>Purpose of use</label>
                <textarea id="b-purpose" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Describe the project and procedure." className={inputCls} />
              </div>
              <p className="text-xs leading-relaxed text-stone">
                ResourcX does not collect payment. Listed rates are indicative samples; access is governed by institutional accountability and a dual-signed liability agreement.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button onClick={onClose} className={btnGhost}>Cancel</button>
                <button
                  disabled={!canSubmit}
                  onClick={() => onSubmit({ startDate: start, endDate: end, purpose: purpose.trim(), proofFiles: Object.values(proofFiles).flat() })}
                  className={btnPrimary}
                >
                  Submit for owner review
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </Modal>
  )
}

function QueueNotice({ resource, waitEntry, onJoin }: { resource: Resource; waitEntry?: WaitlistEntry; onJoin: () => void }) {
  if (waitEntry) return <QueueWidget entry={waitEntry} resourceName={resource.name} />
  return (
    <div className="rounded-2xl bg-amber-300/10 p-4 ring-1 ring-amber-300/30">
      <p className="text-sm text-amber-100">
        Booked until {formatDate(resource.bookedUntil!)}. {resource.queue} {resource.queue === 1 ? 'person is' : 'people are'} already waiting.
      </p>
      <button onClick={onJoin} className={`${btnPrimary} mt-3 w-full`}>
        Join Transparent Waiting List
      </button>
    </div>
  )
}

export function QueueWidget({ entry, resourceName }: { entry: WaitlistEntry; resourceName: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-cream p-4 text-ink">
      <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-ink text-cream">
        <span className="font-display text-xl font-semibold">#{entry.position}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Position #{entry.position} in Queue</p>
        <p className="truncate text-xs text-ink/70">{resourceName}</p>
        <p className="mt-0.5 text-xs text-ink/70">Estimated access: {formatDate(entry.eta)}</p>
      </div>
    </div>
  )
}
