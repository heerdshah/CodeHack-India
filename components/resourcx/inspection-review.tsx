'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, ExternalLink, LoaderCircle } from 'lucide-react'

import { api } from '@/lib/api'
import { ANGLES, type Angle, type InspectionSet } from '@/lib/resources'

type Props = {
  booking: {
    id: string
    pre?: InspectionSet
    post?: InspectionSet
  }
  resourceName: string
  onReviewed: (decision: 'damage' | 'no_damage') => void
}

export function OwnerInspectionReview({ booking, resourceName, onReviewed }: Props) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [failedPhotos, setFailedPhotos] = useState<string[]>([])
  const [photoError, setPhotoError] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)
  const [savedDecision, setSavedDecision] = useState(booking.post?.ownerDecision ?? null)

  useEffect(() => {
    let active = true
    const objectUrls: string[] = []
    setPhotoUrls({})
    setFailedPhotos([])
    setPhotoError('')

    const loadPhotos = async () => {
      const available = (['pre', 'post'] as const).flatMap((phase) =>
        booking[phase]
          ? ANGLES.map((angle) => ({ phase, angle }))
          : []
      )
      const results = await Promise.all(
        available.map(async ({ phase, angle }) => {
          try {
            const blob = await api.inspections.getPhoto(booking.id, phase, angle)
            const url = URL.createObjectURL(blob)
            objectUrls.push(url)
            return [`${phase}:${angle}`, url] as const
          } catch {
            return [`${phase}:${angle}`, null] as const
          }
        })
      )
      if (!active) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      const loaded: Record<string, string> = {}
      results.forEach(([key, url]) => {
        if (url) loaded[key] = url
      })
      setPhotoUrls(loaded)
      setFailedPhotos(results.filter((result) => result[1] === null).map((result) => result[0]))
      if (Object.keys(loaded).length !== available.length) {
        setPhotoError('Some inspection photos could not be loaded. Refresh and try again.')
      }
    }

    void loadPhotos()
    return () => {
      active = false
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [booking.id, booking.pre?.id, booking.post?.id])

  useEffect(() => {
    setSavedDecision(booking.post?.ownerDecision ?? null)
  }, [booking.id, booking.post?.ownerDecision])

  const makeDecision = async (decision: 'damage' | 'no_damage') => {
    setSavingDecision(true)
    setDecisionError('')
    try {
      await api.inspections.review(booking.id, decision)
      setSavedDecision(decision)
      onReviewed(decision)
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : 'Could not save the inspection decision.')
    } finally {
      setSavingDecision(false)
    }
  }

  if (!booking.post) return null

  const reviewReady = Object.keys(photoUrls).length === 12

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-cream">Return inspection · {resourceName}</h4>
          <p className="mt-1 text-xs text-stone">
            Compare the borrower&apos;s six return photos with the original baseline. AI results are advisory.
          </p>
        </div>
        {savedDecision && (
          <span className={`rounded-full px-2.5 py-1 text-xs ${
            savedDecision === 'damage'
              ? 'bg-red-400/10 text-red-200'
              : 'bg-emerald-400/10 text-emerald-200'
          }`}>
            {savedDecision === 'damage' ? 'Damage reported' : 'No damage'}
          </span>
        )}
      </div>

      {photoError && <p role="alert" className="mt-3 text-xs text-amber-200">{photoError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {ANGLES.map((angle: Angle) => (
          <div key={angle} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-medium text-white">{angle} view</p>
            <div className="grid grid-cols-2 gap-2">
              {(['pre', 'post'] as const).map((phase) => {
                const url = photoUrls[`${phase}:${angle}`]
                return (
                  <div key={phase}>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-stone">
                      {phase === 'pre' ? 'Before' : 'Return'}
                    </p>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="group relative block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`${resourceName} ${phase === 'pre' ? 'baseline' : 'return'} ${angle.toLowerCase()} view`}
                          className="aspect-[4/3] w-full rounded-lg object-cover"
                        />
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 p-1 text-white">
                          <ExternalLink className="size-3" aria-hidden />
                        </span>
                      </a>
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-white/10 text-stone">
                        {failedPhotos.includes(`${phase}:${angle}`)
                          ? <span className="text-[10px]">Unavailable</span>
                          : <LoaderCircle className="size-4 animate-spin" aria-label="Loading photo" />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {!savedDecision && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {decisionError && <p role="alert" className="mr-auto text-xs text-red-200">{decisionError}</p>}
          {!reviewReady && (
            <p className="mr-auto text-xs text-stone">Load all 12 photos before recording a decision.</p>
          )}
          <button
            type="button"
            onClick={() => void makeDecision('no_damage')}
            disabled={savingDecision || !reviewReady}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            <CheckCircle className="size-3.5" aria-hidden />
            No damage
          </button>
          <button
            type="button"
            onClick={() => void makeDecision('damage')}
            disabled={savingDecision || !reviewReady}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-amber-200 disabled:opacity-50"
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            Report damage
          </button>
        </div>
      )}
    </div>
  )
}
