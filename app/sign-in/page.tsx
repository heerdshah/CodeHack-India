'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthModal } from '@/components/resourcx/auth-modal'
import { SiteNav } from '@/components/resourcx/site-nav'

export default function SignInPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-ink text-white">
      <SiteNav user={null} />

      <main className="grid min-h-screen place-items-center px-5 pt-24 text-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone">ResourcX Identity & Portal</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">Sign in to ResourcX</h1>
          <Link href="/" className="mt-6 inline-block text-sm text-cream underline underline-offset-4">
            ← Back to home
          </Link>
        </div>
      </main>

      {/* Reuses your existing login + register flow */}
      <AuthModal open onClose={() => router.push('/')} onRegister={() => router.push('/')} />
    </div>
  )
}