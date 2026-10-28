'use client'

import { Camera, KeyRound, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { ANGLES, type Angle, type Booking, type InspectionSet, type Resource } from '@/lib/resources'
import { Modal, btnPrimary } from './ui'

type Props = {
  booking: Booking | null
  resource: Resource | null
  phase: 'pre' | 'post'
  onClose: () => void
  onComplete: (set: InspectionSet) => void
}

export function InspectionModal({ booking, resource, phase, onClose, onComplete }: Props) {
  const [photos, setPhotos] = useState<Partial<Record<Angle, string>>>({})
  const [scanIndex, setScanIndex] = useState(-1)
  const [result, setResult] = useState<InspectionSet | null>(null)

  if (!booking || !resource) return <Modal open={false} onClose={onClose} title="">{null}</Modal>

  const ready = ANGLES.every((a) => photos[a])
  const scanning = scanIndex >= 0 && !result

  const close = () => {
    setPhotos({})
    setScanIndex(-1)
    setResult(null)
    onClose()
  }

  const runScan = () => {
    let i = 0
    setScanIndex(0)
    const timer = setInterval(() => {
      i += 1
      setScanIndex(i)
      if (i >= ANGLES.length) {
        clearInterval(timer)
        const set: InspectionSet = {
          photos: photos as Record<Angle, string>,
          completedAt: new Date().toISOString().slice(0, 10),
          flagged: phase === 'post',
          findings:
            phase === 'pre'
              ? ['Baseline recorded across 6 angles', 'No pre-existing damage detected']
              : ['Possible new surface scratch — Top view (62% confidence)', 'Front, Back, Left, Right, Bottom match baseline'],
        }
        setResult(set)
        onComplete(set)
      }
    }, 450)
  }

  const title = phase === 'pre' ? 'Pre-checkin six-angle inspection' : 'Post-return six-angle inspection'

  return (
    <Modal open onClose={close} wide eyebrow={resource.name} title={title}>
      {!result && (
        <p className="text-sm leading-relaxed text-white/70">
          {phase === 'pre'
            ? 'Photograph the asset from all six angles before your Digital Access Pass is issued. These become the baseline for return.'
            : 'Photograph the asset from the same six angles. ResourcX compares them with the check-in baseline before the owner verifies.'}
        </p>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ANGLES.map((angle, i) => {
          const src = photos[angle]
          const scanned = scanIndex > i
          const active = scanning && scanIndex === i
          const flagged = result?.flagged && angle === 'Top'
          return (
            <li key={angle}>
              <label
                className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border transition ${
                  flagged ? 'border-amber-300' : src ? 'border-white/15' : 'border-dashed border-white/20 hover:border-cream/50'
                } ${scanning || result ? 'pointer-events-none' : ''}`}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={src} alt={`${angle} view of ${resource.name}`} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <>
                    <Camera className="size-5 text-stone" aria-hidden />
                    <span className="mt-1 text-xs text-stone">Add photo</span>
                  </>
                )}
                {active && <span className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-cream shadow-[0_0_16px_4px] shadow-cream/50" aria-hidden />}
                <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
                  {angle}
                  {scanned && (flagged ? ' · Flag' : ' · OK')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label={`Upload ${angle} photo`}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setPhotos((p) => ({ ...p, [angle]: URL.createObjectURL(f) }))
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
            {scanning ? `AI vision scan… ${ANGLES[Math.min(scanIndex, 5)]}` : `${Object.keys(photos).length}/6 angles captured`}
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
              Run AI vision scan
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className={`rounded-2xl p-4 ring-1 ${result.flagged ? 'bg-amber-300/10 ring-amber-300/30' : 'bg-emerald-300/10 ring-emerald-300/30'}`}>
            <p className="text-sm font-medium">{result.flagged ? 'Scan flagged for owner review' : 'Scan clear'}</p>
            <ul className="mt-1.5 list-inside list-disc text-sm text-white/75">
              {result.findings.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {result.flagged && <p className="mt-2 text-xs text-stone">Manual verification by {resource.owner} has been triggered.</p>}
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
        Present at {resource.location}. Single-use OTP, valid for your booking window.
      </p>
    </div>
  )
}
