'use client'

import { BadgeCheck, FileText, Upload, AlertCircle, Clock, ShieldCheck, Flag } from 'lucide-react'
import { useState } from 'react'
import { formatDate, type Booking, type UserProfile, type WaitlistEntry, type Resource } from '@/lib/resources'
import { AccessPass, StandaloneIncidentModal } from './inspection-modal'
import { QueueWidget } from './resource-modal'
import { StatusBadge, btnGhost, btnPrimary, inputCls, labelCls } from './ui'
import { api } from '@/lib/api'

type Props = {
  user: UserProfile | null
  bookings: Booking[]
  waitlist: WaitlistEntry[]
  resources: Resource[]
  onRegister: () => void
  onOpenAgreement: (id: string) => void
  onInspect: (id: string, phase: 'pre' | 'post') => void
  onRefreshUser?: () => void
}

export function UserDashboard({
  user,
  bookings,
  waitlist,
  resources,
  onRegister,
  onOpenAgreement,
  onInspect,
  onRefreshUser,
}: Props) {
  const [uploadingCert, setUploadingCert] = useState(false)
  const [certName, setCertName] = useState('Lab Safety Level 2 Certification')
  const [certFile, setCertFile] = useState<File | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const [incidentResource, setIncidentResource] = useState<Resource | null>(null)

  const getRes = (id: string): Resource =>
    resources.find((r) => r.id === id) || {
      id,
      name: 'Equipment / Lab',
      department: 'Campus',
      category: 'Robotics & Fabrication',
      owner: 'Facility Owner',
      location: 'Campus Building',
      image: '/images/res-robotics.jpg',
      description: '',
      condition: 'Good',
      criteria: [],
      bookedUntil: null,
      queue: 0,
      latitude: 0,
      longitude: 0,
    }

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/10 bg-panel p-6 text-center sm:p-10">
        <p className="font-display text-2xl font-medium">Your profile lives here.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone">
          Sign in or register with your institutional email to manage bookings, sign agreements, and view inspections.
        </p>
        <button onClick={onRegister} className={`${btnPrimary} mt-6`}>
          Sign In or Register
        </button>
      </div>
    )
  }

  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certFile) return
    setUploadingCert(true)
    setUploadMsg('AI verifying certificate...')
    try {
      const fd = new FormData()
      fd.append('file', certFile)
      fd.append('credential_name', certName)
      const res = await api.verification.upload(fd)
      setUploadMsg(`Submitted! Status: ${res.status.replace(/_/g, ' ')}. Sent to owner queue.`)
      onRefreshUser?.()
    } catch (err: any) {
      setUploadMsg(`Error: ${err.message}`)
    } finally {
      setUploadingCert(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-white/10 bg-panel p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-cream font-display font-semibold text-ink">
              {user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-stone">{user.email}</p>
              <span className="inline-block mt-0.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cream">
                {user.systemRole || 'user'} role
              </span>
            </div>
          </div>

          <p className="mt-4 text-[11px] uppercase tracking-wider text-stone">Clearances & Badges</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            <li className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-ink">
              <BadgeCheck className="size-3.5" aria-hidden /> Verified {user.role}
            </li>
            <li className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/10">
              {user.department}
            </li>
            {user.credentials.map((c) => (
              <li key={c} className="rounded-full bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-xs ring-1 ring-emerald-500/30">
                {c}
              </li>
            ))}
          </ul>

          {/* Certificate Verification Upload Box */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[11px] uppercase tracking-wider text-stone mb-2">Upload Verified Certificate</p>
            <form onSubmit={handleUploadCert} className="space-y-2">
              <select
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                className={`${inputCls} text-xs py-1.5 [color-scheme:dark]`}
              >
                <option>Lab Safety Level 2 Certification</option>
                <option>CNC Operator Clearance</option>
                <option>Cobot Safety Certification</option>
                <option>Chemical Hygiene Training</option>
                <option>Biosafety Level 2 Training</option>
                <option>Studio Induction</option>
                <option>3D Fabrication Clearance</option>
              </select>
              <input
                type="file"
                required
                accept=".pdf,image/*"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-stone file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white"
              />
              <button
                type="submit"
                disabled={uploadingCert || !certFile}
                className={`${btnGhost} w-full text-xs py-1.5 justify-center`}
              >
                <Upload className="size-3 mr-1" />
                {uploadingCert ? 'Verifying with Groq...' : 'Upload & Verify with AI'}
              </button>
            </form>
            {uploadMsg && <p className="mt-2 text-xs text-stone">{uploadMsg}</p>}
          </div>
        </div>

        {waitlist.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-stone">Active Queue Rankings</p>
            {waitlist.map((w) => (
              <QueueWidget key={w.id} entry={w} resourceName={getRes(w.resourceId).name} />
            ))}
          </div>
        )}
      </aside>

      <div className="space-y-5">
        <Panel title="Active reservations">
          {bookings.length === 0 ? (
            <p className="text-sm text-stone">No reservations yet. Browse the catalogue to book equipment.</p>
          ) : (
            <ul className="space-y-3">
              {bookings.map((b) => {
                const r = getRes(b.resourceId)
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

                    <BookingAction
                      booking={b}
                      resource={r}
                      onOpenAgreement={onOpenAgreement}
                      onInspect={onInspect}
                      onReportIncident={() => setIncidentResource(r)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Standalone Incident Modal */}
      {incidentResource && (
        <StandaloneIncidentModal
          open={Boolean(incidentResource)}
          resource={incidentResource}
          onClose={() => setIncidentResource(null)}
          onReported={() => {
            alert('Incident report submitted to facility managers.')
          }}
        />
      )}
    </div>
  )
}

export function BookingAction({
  booking,
  resource,
  onOpenAgreement,
  onInspect,
  onReportIncident,
}: {
  booking: Booking
  resource: Resource
  onOpenAgreement: (id: string) => void
  onInspect: (id: string, phase: 'pre' | 'post') => void
  onReportIncident: () => void
}) {
  const needsMySignature = booking.status === 'approved' && !booking.userSignature
  const awaitingOwner = booking.status === 'approved' && Boolean(booking.userSignature) && !booking.ownerSignature
  const signed = booking.status === 'signed' || (booking.userSignature && booking.ownerSignature)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
      {needsMySignature && (
        <button
          onClick={() => onOpenAgreement(booking.id)}
          className={`${btnPrimary} px-3 py-1.5 text-xs`}
        >
          Sign Agreement (Borrower)
        </button>
      )}

      {awaitingOwner && (
        <span className="flex items-center gap-1.5 text-xs text-amber-300">
          <Clock className="size-3.5" />
          Agreement signed by you. Awaiting owner countersignature.
        </span>
      )}

      {signed && booking.status === 'signed' && (
        <button
          onClick={() => onInspect(booking.id, 'pre')}
          className={`${btnPrimary} px-3 py-1.5 text-xs`}
        >
          Perform Pre-Checkin 6-Angle Inspection
        </button>
      )}

      {booking.status === 'active' && (
        <>
          {booking.otp && (
            <div className="mr-2">
              <span className="text-xs text-stone">Access OTP: </span>
              <strong className="text-cream font-mono text-sm tracking-wider">{booking.otp}</strong>
            </div>
          )}
          <button
            onClick={() => onInspect(booking.id, 'post')}
            className={`${btnPrimary} px-3 py-1.5 text-xs`}
          >
            Perform Return 6-Angle Inspection
          </button>
        </>
      )}

      {booking.status === 'overdue' && (
        <button
          onClick={() => onInspect(booking.id, 'post')}
          className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
        >
          Overdue Return — Complete Inspection Now
        </button>
      )}

      <button
        onClick={onReportIncident}
        type="button"
        className="ml-auto inline-flex items-center gap-1 text-xs text-stone hover:text-white"
      >
        <Flag className="size-3 text-stone" />
        Report Issue / Damage
      </button>
    </div>
  )
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-panel p-5">
      <h3 className="font-display text-lg font-medium tracking-tight text-white mb-4">{title}</h3>
      {children}
    </section>
  )
}
