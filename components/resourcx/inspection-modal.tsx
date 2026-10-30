'use client'

import { Camera, KeyRound, ScanLine, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { ANGLES, type Angle, type Booking, type InspectionSet, type Resource } from '@/lib/resources'
import { Modal, btnPrimary, btnGhost, inputCls, labelCls } from './ui'
import { api } from '@/lib/api'

type Props = {
  booking: Booking | null
  resource: Resource | null
  phase: 'pre' | 'post'
  onClose: () => void
  onComplete: (set: InspectionSet) => void
}

export function InspectionModal({ booking, resource, phase, onClose, onComplete }: Props) {
  const [photos, setPhotos] = useState<Partial<Record<Angle, string>>>({})
  const [scanning, setScanning] = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [result, setResult] = useState<InspectionSet | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!booking || !resource) return <Modal open={false} onClose={onClose} title="">{null}</Modal>

  const ready = ANGLES.every((a) => photos[a])

  const close = () => {
    setPhotos({})
    setScanning(false)
    setResult(null)
    setError(null)
    onClose()
  }

  const runScan = async () => {
    setScanning(true)
    setError(null)

    // Visual scan progress animation
    const progressTimer = setInterval(() => {
      setScanStep((s) => (s < 5 ? s + 1 : s))
    }, 400)

    try {
      const res = await api.inspections.submit({
        booking_id: booking.id,
        phase,
        photos: photos as Record<Angle, string>,
      })

      clearInterval(progressTimer)
      const set: InspectionSet = {
        photos: photos as Record<Angle, string>,
        completedAt: res.completedAt || new Date().toISOString().slice(0, 10),
        flagged: res.flagged,
        findings: res.findings || [],
      }
      setResult(set)
      onComplete(set)
    } catch (err: any) {
      clearInterval(progressTimer)
      setError(err.message || 'Inspection failed. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  const title = phase === 'pre' ? 'Pre-checkin six-angle inspection' : 'Post-return six-angle inspection'

  return (
    <Modal open onClose={close} wide eyebrow={resource.name} title={title}>
      {!result && (
        <p className="text-sm leading-relaxed text-white/70">
          {phase === 'pre'
            ? 'Photograph the asset from all six angles before check-in. Groq Vision assesses baseline condition.'
            : 'Photograph the asset from the same six angles upon return. AI compares each angle against the baseline.'}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          {error}
        </div>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ANGLES.map((angle, i) => {
          const src = photos[angle]
          const active = scanning && scanStep === i
          return (
            <li key={angle}>
              <label
                className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border transition ${
                  src ? 'border-white/20' : 'border-dashed border-white/20 hover:border-cream/50'
                } ${scanning || result ? 'pointer-events-none' : ''}`}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={`${angle} view`} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <>
                    <Camera className="size-5 text-stone" aria-hidden />
                    <span className="mt-1 text-xs text-stone">Add photo</span>
                  </>
                )}
                {active && (
                  <span className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-cream shadow-[0_0_16px_4px] shadow-cream/50" aria-hidden />
                )}
                <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
                  {angle}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label={`Upload ${angle} photo`}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      const reader = new FileReader()
                      reader.onload = (re) => {
                        if (re.target?.result) {
                          setPhotos((p) => ({ ...p, [angle]: re.target!.result as string }))
                        }
                      }
                      reader.readAsDataURL(f)
                    }
                  }}
                />
              </label>
            </li>
          )
        })}
      </ul>

      {!result && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone" aria-live="polite">
            {scanning ? `AI vision analyzing… ${ANGLES[scanStep]}` : `${Object.keys(photos).length}/6 angles captured`}
          </p>
          <div className="flex gap-2">
            {!ready && !scanning && (
              <button
                type="button"
                onClick={() => setPhotos(Object.fromEntries(ANGLES.map((a) => [a, resource.image])))}
                className="text-xs text-cream underline underline-offset-4"
              >
                Use sample photos
              </button>
            )}
            <button disabled={!ready || scanning} onClick={runScan} className={btnPrimary}>
              <ScanLine className="size-4" aria-hidden />
              {scanning ? 'Running AI Scan...' : 'Run AI Vision Scan'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className={`rounded-2xl p-4 ring-1 ${result.flagged ? 'bg-amber-300/10 ring-amber-300/30' : 'bg-emerald-300/10 ring-emerald-300/30'}`}>
            <p className="text-sm font-medium">
              {result.flagged ? 'Scan flagged for facility owner review' : 'Scan clear — verified'}
            </p>
            <ul className="mt-1.5 list-inside list-disc text-sm text-white/75">
              {result.findings.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {result.flagged && (
              <p className="mt-2 text-xs text-stone">
                Incident review ticket automatically created for {resource.owner}. No automatic penalty is charged.
              </p>
            )}
          </div>
          {phase === 'pre' && booking.otp && <AccessPass otp={booking.otp} resource={resource} />}
          <button onClick={close} className={`${btnPrimary} w-full`}>Done</button>
        </div>
      )}
    </Modal>
  )
}

export function AccessPass({ otp, resource }: { otp: string; resource: Resource }) {
  return (
    <div className="rounded-2xl bg-cream p-5 text-ink">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink/60">
        <KeyRound className="size-3.5" aria-hidden /> Digital Access Pass
      </p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-[0.3em] tabular-nums">{otp}</p>
      <p className="mt-2 text-xs text-ink/70">
        Present at {resource.location}. Single-use OTP, verified server-side.
      </p>
    </div>
  )
}

export function StandaloneIncidentModal({
  open,
  resource,
  onClose,
  onReported,
}: {
  open: boolean
  resource: Resource | null
  onClose: () => void
  onReported: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [angle, setAngle] = useState<Angle>('Front')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!resource) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.incidents.report({
        resource_id: resource.id,
        angle,
        title,
        description,
        photos: [resource.image],
      })
      onReported()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to submit incident report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={resource.name} title="Report Damage or Equipment Anomaly">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-white/70">
          Describe any observed damage or equipment malfunction. ResourcX will generate an objective AI incident report for facility review.
        </p>

        <div>
          <label className={labelCls}>Incident Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scuffed surface or loose calibration clamp"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Primary Perspective / Angle</label>
          <select
            value={angle}
            onChange={(e) => setAngle(e.target.value as Angle)}
            className={`${inputCls} [color-scheme:dark]`}
          >
            {ANGLES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Detailed Description</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Specify what occurred, any strange noises, or noticeable physical deviations..."
            className={inputCls}
          />
        </div>

        {error && <p className="text-xs text-red-300">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? 'Submitting...' : 'Submit Incident Report'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
