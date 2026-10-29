'use client'

import { ArrowRight, LifeBuoy, Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { SiteNav } from '@/components/resourcx/site-nav'
import { useCurrentUser } from '@/components/resourcx/use-user'
import { btnPrimary, inputCls, labelCls } from '@/components/resourcx/ui'

export default function ContactPage() {
  const user = useCurrentUser()
  const [sent, setSent] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    // TODO: send to your backend (e.g. a FastAPI endpoint) if you want messages stored.
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav user={user} />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-36 sm:px-6 md:pt-32">
        <Link href="/" className="text-xs uppercase tracking-widest text-stone transition hover:text-white">
          ← Back to home
        </Link>

        <div className="mt-10 text-center">
          <h1 className="font-display text-5xl font-medium tracking-tight sm:text-7xl">Contact us</h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/70">
            We are always looking for ways to improve our products and services. Contact us and let us know how we can help you.
          </p>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <div>
            <h2 className="font-display text-2xl font-medium">Get in touch</h2>
            <p className="mt-2 text-sm text-stone">
              Reach out via any channel below. We typically reply within one business day.
            </p>
            <ul className="mt-8 space-y-5 text-sm">
              <li className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5">
                  <Mail className="size-4 text-cream" aria-hidden />
                </span>
                contact@resourcx.ai
              </li>
              <li className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5">
                  <Phone className="size-4 text-cream" aria-hidden />
                </span>
                +1 (800) 321-7379
              </li>
              <li className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5">
                  <LifeBuoy className="size-4 text-cream" aria-hidden />
                </span>
                support@resourcx.ai
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl shadow-black/40 sm:p-8">
            <h2 className="font-display text-xl font-medium">Send a message</h2>
            <p className="mt-1 text-xs text-stone">Fill out the form and we&rsquo;ll get back to you promptly.</p>

            {sent ? (
              <p role="status" className="mt-6 rounded-2xl bg-emerald-300/10 p-4 text-sm text-emerald-100 ring-1 ring-emerald-300/30">
                Thanks! Your message has been received. We&rsquo;ll reply within one business day.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="c-name" className={labelCls}>Full name</label>
                  <input id="c-name" required placeholder="Ex. Vance" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="c-org" className={labelCls}>Company / Institution</label>
                  <input id="c-org" placeholder="University Tech Hub" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-email" className={labelCls}>Email address</label>
                  <input id="c-email" type="email" required placeholder="support@resourcx.ai" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-msg" className={labelCls}>Message</label>
                  <textarea id="c-msg" required rows={4} placeholder="Type your message here..." className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className={btnPrimary}>
                    Submit
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}