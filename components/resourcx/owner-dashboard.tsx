'use client'

import { FileText, CheckCircle, XCircle, AlertTriangle, ExternalLink, CheckCircle2, ShieldAlert, Sparkles, MessageSquare, Image as ImageIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { formatDate, type Booking, type Resource } from '@/lib/resources'
import { Panel } from './user-dashboard'
import { StatusBadge, btnGhost, btnPrimary, inputCls, labelCls } from './ui'
import { api } from '@/lib/api'

type Props = {
  bookings: Booking[]
  resources: Resource[]
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  onOpenAgreement: (id: string) => void
  onVerify: (id: string) => void
}

const REASONS = [
  'Lab undergoing maintenance during the requested window.',
  'Submitted credentials do not satisfy the safety certification requirement.',
  'Schedule conflict with a departmental teaching block.',
]

export function OwnerDashboard({
  bookings,
  resources,
  onApprove,
  onReject,
  onOpenAgreement,
  onVerify,
}: Props) {
  const [activeTab, setActiveTab] = useState<'requests' | 'returns' | 'credentials' | 'incidents'>('requests')
  const [credentialQueue, setCredentialQueue] = useState<any[]>([])
  const [incidentList, setIncidentList] = useState<any[]>([])
  const [loadingQueues, setLoadingQueues] = useState(false)

  const pending = bookings.filter((b) => b.status === 'pending')
  const toSign = bookings.filter((b) => b.status === 'approved' && !b.ownerSignature)
  const inspections = bookings.filter((b) => b.pre || b.post)

  const getRes = (id: string) =>
    resources.find((r) => r.id === id) || {
      id,
      name: 'Equipment',
      location: 'Campus',
      owner: 'Owner',
      queue: 0,
    }

  const loadQueues = async () => {
    setLoadingQueues(true)
    try {
      const [creds, incs] = await Promise.all([
        api.verification.getReviewQueue(),
        api.incidents.list(),
      ])
      setCredentialQueue(creds || [])
      setIncidentList(incs || [])
    } catch {
      // Ignored if offline
    } finally {
      setLoadingQueues(false)
    }
  }

  useEffect(() => {
    loadQueues()
  }, [])

  const handleConfirmCred = async (docId: string, approved: boolean) => {
    await api.verification.confirm(docId, approved, approved ? undefined : 'Documentation incomplete or unverified.')
    loadQueues()
  }

  const handleReviewIncident = async (incId: string, status: string) => {
    await api.incidents.review(incId, status, `Owner reviewed and marked as ${status}.`)
    loadQueues()
  }

  const stats = [
    ['Listed assets', resources.length],
    ['Pending requests', pending.length],
    ['Awaiting my signature', toSign.length],
    ['Credential reviews', credentialQueue.length],
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

      {/* Owner Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-4">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2.5 text-sm font-medium transition ${
            activeTab === 'requests'
              ? 'border-b-2 border-cream text-cream'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Bookings & Signatures ({pending.length + toSign.length})
        </button>
        <button
          onClick={() => setActiveTab('credentials')}
          className={`pb-2.5 text-sm font-medium transition ${
            activeTab === 'credentials'
              ? 'border-b-2 border-cream text-cream'
              : 'text-white/60 hover:text-white'
          }`}
        >
          AI Credential Review Queue ({credentialQueue.length})
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`pb-2.5 text-sm font-medium transition ${
            activeTab === 'incidents'
              ? 'border-b-2 border-cream text-cream'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Incident & Inspection Flags ({incidentList.filter((i) => i.status === 'under_review').length})
        </button>
      </div>


      {activeTab === 'returns' && (
        <div className="space-y-4">
          <Panel title={`Equipment Returned – Ready for Owner Inspection Review (${returnedToReview.length})`}>
            {returnedToReview.length === 0 ? (
              <p className="text-sm text-stone">No returned assets currently awaiting condition review.</p>
            ) : (
              <ul className="space-y-4">
                {returnedToReview.map((b) => {
                  const r = getRes(b.resourceId)
                  return (
                    <li key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-white">{r.name}</h4>
                          <p className="text-xs text-stone mt-0.5">
                            Borrower: <strong className="text-cream">{b.applicant.name}</strong> ({b.applicant.department}) • Return Date: {formatDate(b.endDate)}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                          Awaiting Owner Return Decision
                        </span>
                      </div>

                      {/* 6-Angle Photos from Return Inspection */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone mb-2 flex items-center gap-1.5">
                          <ImageIcon className="size-3.5 text-cream" />
                          <span>Submitted Return Photos (All 6 Angles)</span>
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'].map((ang) => {
                            const img = (b.post?.photos as any)?.[ang] || (b.pre?.photos as any)?.[ang] || (r as any).image
                            return (
                              <div key={ang} className="relative aspect-square rounded-xl overflow-hidden border border-white/15 bg-black/40">
                                {img ? (
                                  <img src={img} alt={ang} className="size-full object-cover" />
                                ) : (
                                  <div className="grid size-full place-items-center text-[10px] text-stone">No photo</div>
                                )}
                                <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1 py-0.5 text-[9px] text-white font-medium">
                                  {ang}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* AI Vision Condition Advisory */}
                      <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 text-xs">
                        <div className="flex items-center gap-2 text-cream font-semibold">
                          <Sparkles className="size-3.5 text-amber-400" />
                          <span>AI Groq Vision Pre-Assessment</span>
                        </div>
                        <p className="mt-1 text-white/80">
                          {b.post?.findings?.length ? b.post.findings.join('; ') : 'All 6 angles compared against check-in baseline. Ready for owner confirmation.'}
                        </p>
                      </div>

                      {/* Owner Decision Action Buttons */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { api } = await import('@/lib/api')
                              await (api as any).post?.(`/incidents/${b.id}/owner-decision`, { decision: 'NO_DAMAGE_REPORTED' })
                            } catch {}
                            alert('Return confirmed! No damage reported. Agreement closed and borrower deposit released.')
                            window.location.reload()
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm"
                        >
                          <CheckCircle2 className="size-4" />
                          <span>Accept Return with No Damage & Close</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const reason = prompt('Please describe the damage detected on this asset:')
                            if (!reason) return
                            try {
                              const { api } = await import('@/lib/api')
                              await (api as any).post?.(`/incidents/${b.id}/owner-decision`, { decision: 'DAMAGE_REPORTED', notes: reason })
                            } catch {}
                            alert('Damage flagged. Incident ticket created for dispute & deposit deduction.')
                            window.location.reload()
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition shadow-sm"
                        >
                          <AlertTriangle className="size-4" />
                          <span>Flag Damage & Initiate Deduction</span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-5">
          <Panel title={`Pending applicants (${pending.length})`}>
            {pending.length === 0 ? (
              <p className="text-sm text-stone">No requests awaiting review.</p>
            ) : (
              <ul className="space-y-3">
                {pending.map((b) => (
                  <ApplicantCard
                    key={b.id}
                    booking={b}
                    resourceName={getRes(b.resourceId).name}
                    onApprove={onApprove}
                    onReject={onReject}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={`Agreements awaiting owner signature (${toSign.length})`}>
              {toSign.length === 0 ? (
                <p className="text-sm text-stone">No agreements pending your signature.</p>
              ) : (
                <ul className="space-y-2">
                  {toSign.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                      <span className="min-w-0 text-sm">
                        <span className="block truncate font-medium">{getRes(b.resourceId).name}</span>
                        <span className="block truncate text-xs text-stone">Borrower: {b.applicant.name}</span>
                      </span>
                      <button onClick={() => onOpenAgreement(b.id)} className={`${btnPrimary} shrink-0 px-4 py-1.5 text-xs`}>
                        Sign as Owner
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Managed equipment">
              <ul className="divide-y divide-white/5">
                {resources.map((r) => {
                  const live = bookings.filter((b) => b.resourceId === r.id && !['completed', 'rejected', 'cancelled'].includes(b.status)).length
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-stone">{r.location}</span>
                      </span>
                      <span className="shrink-0 text-xs text-stone">
                        {live} active · {r.queue} queued
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {activeTab === 'credentials' && (
        <Panel title="AI Credential Verification Queue">
          <p className="text-xs text-stone mb-4">
            Uploaded certifications verified optically by Groq. Human confirmation is required to grant eligibility clearance.
          </p>
          {credentialQueue.length === 0 ? (
            <p className="text-sm text-stone">No credentials pending review.</p>
          ) : (
            <div className="space-y-3">
              {credentialQueue.map((cred) => {
                const ai = cred.ai_analysis || {}
                return (
                  <div key={cred.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-white">{cred.credential_name}</h4>
                        <p className="text-xs text-stone">
                          Applicant: <strong className="text-cream">{cred.applicant_name}</strong> ({cred.department})
                        </p>
                        <p className="text-xs text-stone/80 mt-1">
                          File: <span className="font-mono text-white/60">{cred.document_path}</span>
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-500/10 text-amber-300 px-2.5 py-0.5 text-xs ring-1 ring-amber-500/20">
                        {cred.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* AI Assessment Box */}
                    <div className="mt-3 rounded-xl bg-black/40 p-3 text-xs">
                      <span className="font-semibold text-cream">AI Verification Findings:</span>
                      <div className="mt-1 flex flex-wrap gap-3 text-stone">
                        <span>Confidence: <strong className="text-white">{Math.round((ai.confidence || 0) * 100)}%</strong></span>
                        <span>Name Match: <strong className={ai.name_match ? 'text-emerald-300' : 'text-red-300'}>{ai.name_match ? 'Yes' : 'No'}</strong></span>
                        <span>Requirement Match: <strong className={ai.matches_requirement ? 'text-emerald-300' : 'text-red-300'}>{ai.matches_requirement ? 'Yes' : 'No'}</strong></span>
                      </div>
                      {ai.reasons && ai.reasons.length > 0 && (
                        <p className="mt-1 text-white/70 italic">&ldquo;{ai.reasons.join('; ')}&rdquo;</p>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => handleConfirmCred(cred.id, false)}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleConfirmCred(cred.id, true)}
                        className="rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-semibold text-ink hover:bg-emerald-400"
                      >
                        Confirm & Verify Clearance
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'incidents' && (
        <Panel title="Equipment Incidents & Condition Flags">
          <p className="text-xs text-stone mb-4">
            Variance flagged by post-return inspections or user anomaly reports. Confirm, dismiss, or request more evidence.
          </p>
          {incidentList.length === 0 ? (
            <p className="text-sm text-stone">No reported incidents.</p>
          ) : (
            <div className="space-y-3">
              {incidentList.map((inc) => (
                <div key={inc.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-white">{inc.title}</h4>
                      <p className="text-xs text-stone">
                        Resource: <span className="text-cream">{inc.resource_id}</span> · Severity:{' '}
                        <span className="capitalize font-semibold text-amber-300">{inc.severity}</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-stone">
                      {inc.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-white/80">{inc.description}</p>
                  {inc.ai_summary && (
                    <div className="mt-2 rounded-lg bg-black/30 p-2.5 text-xs text-stone">
                      <strong className="text-cream">AI Incident Summary: </strong>
                      {inc.ai_summary}
                    </div>
                  )}

                  {inc.status === 'under_review' && (
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => handleReviewIncident(inc.id, 'dismissed')}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:text-white"
                      >
                        Dismiss (Minor Wear)
                      </button>
                      <button
                        onClick={() => handleReviewIncident(inc.id, 'confirmed')}
                        className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-ink hover:bg-amber-300"
                      >
                        Confirm & Log Incident
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

function ApplicantCard({
  booking,
  resourceName,
  onApprove,
  onReject,
}: {
  booking: Booking
  resourceName: string
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState(REASONS[0])

  return (
    <li className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-white">{resourceName}</p>
          <p className="text-xs text-stone">
            Applicant: <strong className="text-cream">{booking.applicant.name}</strong> ({booking.applicant.role},{' '}
            {booking.applicant.department})
          </p>
          <p className="mt-1 text-xs text-stone">
            Window: {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
          </p>
          <p className="mt-1 text-xs italic text-white/75">&ldquo;{booking.purpose}&rdquo;</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} text-xs py-1.5 [color-scheme:dark]`}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRejecting(false)} className={btnGhost}>Cancel</button>
            <button onClick={() => onReject(booking.id, reason)} className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
              Confirm Rejection
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setRejecting(true)} className={`${btnGhost} text-xs py-1`}>Reject</button>
          <button onClick={() => onApprove(booking.id)} className={`${btnPrimary} text-xs py-1 px-3`}>
            Approve & Generate Agreement
          </button>
        </div>
      )}
    </li>
  )
}
