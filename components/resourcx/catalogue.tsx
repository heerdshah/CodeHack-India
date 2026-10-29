'use client'

import { ShieldCheck, MapPin, Navigation } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { CATEGORIES, formatDate, matchesQuery, type Category, type Resource } from '@/lib/resources'
import { SectionHeading, btnGhost, btnPrimary } from './ui'

type Props = {
  resources: Resource[]
  query: string
  onClearQuery: () => void
  onView: (r: Resource) => void
  onBook: (r: Resource) => void
  onLocationSort?: (lat: number | null, lng: number | null) => void
}

export function Catalogue({
  resources,
  query,
  onClearQuery,
  onView,
  onBook,
  onLocationSort,
}: Props) {
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [nearMeActive, setNearMeActive] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [manualCoords, setManualCoords] = useState(false)
  const [customLat, setCustomLat] = useState('37.7749')
  const [customLng, setCustomLng] = useState('-122.4194')

  const toggleNearMe = () => {
    if (nearMeActive) {
      setNearMeActive(false)
      setLocationError(null)
      onLocationSort?.(null, null)
      return
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNearMeActive(true)
          setLocationError(null)
          onLocationSort?.(pos.coords.latitude, pos.coords.longitude)
        },
        (err) => {
          setLocationError('Geolocation permission denied. You can enter campus coordinates manually.')
          setManualCoords(true)
        }
      )
    } else {
      setLocationError('Browser does not support geolocation.')
      setManualCoords(true)
    }
  }

  const applyManualCoords = () => {
    const lat = parseFloat(customLat)
    const lng = parseFloat(customLng)
    if (!isNaN(lat) && !isNaN(lng)) {
      setNearMeActive(true)
      setLocationError(null)
      onLocationSort?.(lat, lng)
    }
  }

  const list = resources.filter(
    (r) => (category === 'All' || r.category === category) && matchesQuery(r, query)
  )

  return (
    <section id="catalogue" aria-labelledby="catalogue-title" className="scroll-mt-28 mx-auto max-w-6xl px-5 py-20 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading index="02" eyebrow="Catalogue" title="Browse what the institution already owns." id="catalogue-title" />
        
        {/* Near Me Sorting Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleNearMe}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              nearMeActive
                ? 'bg-cream text-ink shadow-sm'
                : 'border border-white/20 text-white/80 hover:border-cream/60'
            }`}
          >
            <Navigation className={`size-3.5 ${nearMeActive ? 'fill-ink' : ''}`} />
            {nearMeActive ? 'Sorted Near Me' : 'Sort by Distance (Near Me)'}
          </button>
        </div>
      </div>

      {locationError && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p>{locationError}</p>
          {manualCoords && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-white/70">Manual Lat:</span>
              <input
                type="text"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-24 rounded border border-white/20 bg-black/40 px-2 py-0.5 text-xs text-white"
              />
              <span className="text-white/70">Lng:</span>
              <input
                type="text"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                className="w-24 rounded border border-white/20 bg-black/40 px-2 py-0.5 text-xs text-white"
              />
              <button
                type="button"
                onClick={applyManualCoords}
                className="rounded bg-cream px-2.5 py-0.5 text-xs font-semibold text-ink"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category Pills */}
      <div className="mt-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter by category">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
              category === c ? 'bg-cream text-ink' : 'border border-white/15 text-white/70 hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {query.trim() && (
        <p className="mt-4 text-sm text-stone" aria-live="polite">
          {list.length} result{list.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;{' '}
          <button onClick={onClearQuery} className="text-cream underline underline-offset-4">
            Clear
          </button>
        </p>
      )}

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <li key={r.id} className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-panel">
            <div className="relative aspect-[4/3]">
              <Image src={r.image} alt={r.name} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                {r.category}
              </span>

              {/* Distance badge if computed */}
              {r.distance_km != null && (
                <span className="absolute left-3 bottom-3 flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-medium text-cream backdrop-blur">
                  <MapPin className="size-3 text-cream" />
                  {r.distance_km} km away
                </span>
              )}

              <span
                className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${
                  r.bookedUntil ? 'bg-amber-200/90 text-ink' : 'bg-emerald-200/90 text-ink'
                }`}
              >
                {r.bookedUntil ? `Booked to ${formatDate(r.bookedUntil).replace(/ \d{4}$/, '')}` : 'Available'}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-xl font-medium">{r.name}</h3>
              <p className="mt-1 text-sm text-stone">
                {r.department} · {r.location}
              </p>
              {r.building && (
                <p className="text-xs text-stone/80">
                  {r.building}{r.floor ? ` (${r.floor})` : ''}
                </p>
              )}

              <div className="mt-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-stone">
                  <ShieldCheck className="size-3.5 text-cream" aria-hidden />
                  Owner eligibility rules
                </p>
                <p className="mt-1.5 text-sm leading-snug text-white/85">
                  Requires {r.criteria && r.criteria.length ? r.criteria.join(' & ') : 'Standard safety clearance'}
                </p>
              </div>

              {r.queue > 0 && <p className="mt-3 text-xs text-stone">{r.queue} in transparent waiting list</p>}

              <div className="mt-auto flex gap-2 pt-5">
                <button onClick={() => onView(r)} className={`${btnGhost} flex-1 px-3`}>
                  View Details
                </button>
                <button onClick={() => onBook(r)} className={`${btnPrimary} flex-1 px-3`}>
                  Book Resource
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="mt-10 text-center text-stone">No assets match these filters.</p>}
    </section>
  )
}
