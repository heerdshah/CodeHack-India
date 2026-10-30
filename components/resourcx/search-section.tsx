'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { formatHourlyRate, matchesQuery, type Resource } from '@/lib/resources'

export function SearchSection({
  resources,
  onPick,
}: {
  resources: Resource[]
  onPick: (resource: Resource) => void
}) {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const matches = query.trim()
    ? resources.filter((resource) => matchesQuery(resource, query)).slice(0, 5)
    : []

  function goExplore(searchTerm: string) {
    const term = searchTerm.trim()

    router.push(
      term
        ? `/explore?q=${encodeURIComponent(term)}`
        : '/explore'
    )
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    goExplore(query)
  }

  return (
    <section
      id="search"
      aria-labelledby="search-title"
      className="relative scroll-mt-24 bg-ink px-5 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone">
          Catalog lookup
        </p>

        <h2
          id="search-title"
          className="mt-3 text-balance font-display text-3xl font-medium tracking-tight sm:text-4xl"
        >
          Search Available Facilities &amp; Tools
        </h2>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.025] p-5 text-left shadow-2xl shadow-black/20 sm:p-6">
          <form onSubmit={onSubmit} className="relative">
            <label htmlFor="home-search" className="sr-only">
              Search tools, labs, makerspaces, or locations
            </label>

            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone"
              aria-hidden="true"
            />

            <input
              id="home-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() =>
                setTimeout(() => setFocused(false), 150)
              }
              placeholder="Search tools, labs, makerspaces, or locations..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-stone focus:border-cream/60 focus:ring-2 focus:ring-cream/20"
            />

            {focused && query.trim() && (
              <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-2xl">
                {matches.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-stone">
                    No assets match &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  <ul>
                    {matches.map((resource) => (
                      <li key={resource.id}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            onPick(resource)
                            setFocused(false)
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-white">
                              {resource.name}
                            </span>

                            <span className="block truncate text-xs text-stone">
                              {resource.department}
                            </span>
                          </span>

                          <span className="shrink-0 text-right">
                            <span className="block text-[11px] text-cream">
                              {resource.hourlyRate != null
                                ? formatHourlyRate(resource.hourlyRate)
                                : 'Ask for price'}
                            </span>
                            <span className="block text-[10px] text-stone">
                              {resource.assistance ? 'Help available' : resource.category.split(' ')[0]}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}

                    <li className="border-t border-white/10">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goExplore(query)}
                        className="w-full px-4 py-2.5 text-left text-xs text-cream hover:bg-white/5"
                      >
                        See all results for &ldquo;{query}&rdquo; →
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  )
}