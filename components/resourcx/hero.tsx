import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate min-h-svh overflow-hidden bg-[#F6F2EA] text-white"
    >
      {/* Full-screen hero image */}
      <Image
        src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop"
        alt="Bright shared learning space"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 object-cover object-center"
      />

      {/* Very subtle overlay: keep the image visible */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-black/15"
      />

      {/* Smooth fade from the hero image into black */}
<div
  aria-hidden="true"
  className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent via-black/60 to-black"
/>


      {/* Hero content */}
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col items-center justify-center px-5 pb-20 pt-28 text-center sm:px-6">
        <h1
          id="hero-title"
          className="max-w-4xl text-balance font-display text-[clamp(2.75rem,8vw,6.5rem)] font-medium leading-[0.95] tracking-tight text-white drop-shadow-sm"
        >
          We shape space into purpose
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
          Unlocking Capital. Empowering Shared Innovation for Everyone.
        </p>

        <Link
          href="/explore"
          className="mt-9 inline-flex items-center gap-2.5 rounded-full bg-[#F6F2EA] px-7 py-3.5 text-sm font-semibold text-[#292821] shadow-xl transition hover:bg-white"
        >
          Explore Full Catalog
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}