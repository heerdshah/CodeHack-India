'use client'

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { formatDate, formatHourlyRate, type Resource } from '@/lib/resources'
import { SectionHeading, btnGhost } from './ui'

export function FeaturedResources({
  resources,
  loading,
  onView,
}: {
  resources: Resource[]
  loading: boolean
  onView: (resource: Resource) => void
}) {
  const featured = resources.slice(0, 4)

  return (
    <section
      id="browse"
      aria-labelledby="browse-title"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-6"
    >
      <SectionHeading
        index=""
        eyebrow="Featured facilities"
        title="Spotlight spaces & tools."
        id="browse-title"
      />

      {loading && featured.length === 0 && (
        <p className="mt-10 text-sm text-stone">
          Loading resources…
        </p>
      )}

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((resource) => (
          <li
            key={resource.id}
            className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-panel"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={resource.image}
                alt={resource.name}
                fill
                sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                className="object-cover"
              />

              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                {resource.category}
              </span>

              <span
                className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${
                  resource.bookedUntil
                    ? 'bg-amber-200/90 text-ink'
                    : 'bg-emerald-200/90 text-ink'
                }`}
              >
                {resource.bookedUntil
                  ? `Booked to ${formatDate(resource.bookedUntil).replace(/ \d{4}$/, '')}`
                  : 'Available'}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-medium leading-snug">
                {resource.name}
              </h3>

              <p className="mt-1 text-sm text-stone">
                {resource.department} · {resource.location}
              </p>

              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="font-display text-base font-medium text-cream">
                  {resource.hourlyRate != null
                    ? formatHourlyRate(resource.hourlyRate)
                    : 'Contact owner for price'}
                </p>
                {resource.assistance && (
                  <p className="mt-1 text-xs leading-relaxed text-stone">
                    Help with {resource.assistance.name} · +{formatHourlyRate(resource.assistance.hourlyRate)}
                  </p>
                )}
              </div>

              <button
                onClick={() => onView(resource)}
                className={`${btnGhost} mt-auto w-full px-3 py-2 text-xs`}
              >
                View Details
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-center text-xs text-stone">
        Sample rates and assistance contacts; confirm availability and final pricing with the facility owner.
      </p>

      <div className="mt-10 text-center">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 text-sm font-medium text-cream underline-offset-4 transition hover:underline"
        >
          View more options
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}