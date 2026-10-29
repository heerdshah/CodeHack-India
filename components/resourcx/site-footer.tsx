import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/20">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="font-display text-xl font-semibold tracking-tight text-white"
            >
              ResourcX<span className="text-stone">.</span>
            </Link>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-stone">
              Institutional resource sharing for laboratories,
              specialist equipment, and collaborative spaces—with
              verification and accountability built in.
            </p>

            <p className="mt-5 flex items-center gap-2 text-xs text-stone">
              <span
                className="size-2 rounded-full bg-emerald-400"
                aria-hidden="true"
              />
              Platform interface operational
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Quick navigation
            </h2>

            <ul className="mt-4 space-y-3 text-sm text-stone">
              <li>
                <Link href="/" className="transition hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/explore" className="transition hover:text-white">
                  Browse catalog
                </Link>
              </li>
              <li>
                <Link href="/account" className="transition hover:text-white">
                  My account
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Resource guides
            </h2>

            <ul className="mt-4 space-y-3 text-sm text-stone">
              <li>
                <Link href="/explore" className="transition hover:text-white">
                  Explore available resources
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition hover:text-white">
                  Booking support
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition hover:text-white">
                  Institutional access
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-stone sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} ResourcX. All rights reserved.
          </p>

          <p>
            Shared infrastructure · Verified access · Accountable use
          </p>
        </div>
      </div>
    </footer>
  )
}