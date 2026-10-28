'use client'

import { ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { CATEGORIES, RESOURCES, formatDate, matchesQuery, type Category, type Resource } from '@/lib/resources'
import { SectionHeading, btnGhost, btnPrimary } from './ui'

type Props = {
  query: string
  onClearQuery: () => void
  onView: (r: Resource) => void
  onBook: (r: Resource) => void
}

export function Catalogue({ query, onClearQuery, onView, onBook }: Props) {
  const [category, setCategory] = useState<Category | 'All'>('All')
  const list = RESOURCES.filter((r) => (category === 'All' || r.category === category) && matchesQuery(r, query))

  return (
    <section id="catalogue" aria-labelledby="catalogue-title" className="scroll-mt-28 mx-auto max-w-6xl px-5 py-20 sm:px-6">
      <SectionHeading index="02" eyebrow="Catalogue" title="Browse what the institution already owns." id="catalogue-title" />

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
              <div className="mt-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-stone">
                  <ShieldCheck className="size-3.5 text-cream" aria-hidden />
                  Owner eligibility rules
                </p>
                <p className="mt-1.5 text-sm leading-snug text-white/85">Requires {r.criteria.join(' & ')}</p>
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
