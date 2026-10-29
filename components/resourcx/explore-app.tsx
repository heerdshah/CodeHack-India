'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type {
  Booking,
  Resource,
  UserProfile,
} from '@/lib/resources'

import { Catalogue } from './catalogue'
import { ResourceModal } from './resource-modal'
import { SiteNav } from './site-nav'
import { SiteFooter } from './site-footer'

export function ExploreApp() {
  const router = useRouter()
  const params = useSearchParams()

  const [query, setQuery] = useState(params.get('q') ?? '')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = async (
    lat?: number | null,
    lng?: number | null
  ) => {
    try {
      const [res, bks] = await Promise.all([
        api.resources.list({ lat, lng }),
        api.bookings.list().catch(() => [] as Booking[]),
      ])

      setResources(res)
      setBookings(bks)
    } catch (err: unknown) {
      console.error('Error loading resources:', err)
    }

    try {
      const me = await api.auth.getMe()

      if (me) {
        setUser(me)
      } else {
        setUser(null)
      }
    } catch {
      // The visitor is not signed in.
      setUser(null)
    }
  }

  useEffect(() => {
    void load()
    // Load the initial catalog when this page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mine = bookings.filter((booking) => booking.isMine)

  const detail =
    resources.find((resource) => resource.id === detailId) ?? null

  const openResource = (resource: Resource) => {
    if (!user) {
      router.push('/sign-in')
      return
    }

    setDetailId(resource.id)
  }

  const submitRequest = async (
    resource: Resource,
    input: {
      startDate: string
      endDate: string
      purpose: string
      proofFiles: string[]
    }
  ) => {
    if (!user) {
      router.push('/sign-in')
      return
    }

    try {
      const result = await api.bookings.create({
        resource_id: resource.id,
        start_date: `${input.startDate}T09:00:00Z`,
        end_date: `${input.endDate}T17:00:00Z`,
        purpose: input.purpose,
        proof_files: input.proofFiles,
      })

      if (result.status === 'waitlisted') {
        alert(
          result.message ||
            'Slot busy. You have been placed on the FIFO waitlist.'
        )
      }

      setDetailId(null)

      router.push('/#dashboard')
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.'

      alert(`Booking request failed: ${message}`)
    }
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav user={user} />

      <main className="pt-32 md:pt-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-stone transition hover:text-white"
          >
            ← Back to home
          </Link>

          <p className="mt-8 text-xs font-medium uppercase tracking-[0.25em] text-stone">
            Complete live catalog
          </p>

          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-6xl">
            All Shared Resources
          </h1>

          <p className="mt-3 max-w-xl text-sm text-white/70">
            Browse, filter, and inspect verified spaces, specialized
            tools, and research equipment.
          </p>

          <div className="relative mt-8 max-w-2xl">
            <label
              htmlFor="explore-search"
              className="sr-only"
            >
              Search tools, labs, makerspaces, or locations
            </label>

            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone"
              aria-hidden="true"
            />

            <input
              id="explore-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools, labs, makerspaces, or locations…"
              className="w-full rounded-full border border-white/15 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-stone focus:border-cream/60 focus:ring-2 focus:ring-cream/20"
            />
          </div>
        </div>

        <Catalogue
          resources={resources}
          query={query}
          onClearQuery={() => setQuery('')}
          onView={openResource}
          onBook={openResource}
          onLocationSort={(lat, lng) => {
            void load(lat, lng)
          }}
        />
      </main>

      <SiteFooter />

      {detail && user && (
        <ResourceModal
          key={detail.id}
          resource={detail}
          user={user}
          activeBooking={mine.find(
            (booking) =>
              booking.resourceId === detail.id &&
              ![
                'completed',
                'rejected',
                'cancelled',
              ].includes(booking.status)
          )}
          onClose={() => setDetailId(null)}
          onSubmit={(input) => submitRequest(detail, input)}
          onJoinWaitlist={() => {}}
        />
      )}
    </div>
  )
}