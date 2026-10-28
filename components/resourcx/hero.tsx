'use client'

import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'
import { useRef } from 'react'

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const t = useTransform(scrollYProgress, [0, 0.8], [0, 1], { clamp: true })
  // Card settles at max-w-6xl (72rem) on desktop, keeps a 16px gutter on small screens.
  const sideInset = useMotionTemplate`calc(${t} * max(16px, 50% - 36rem))`
  const topInset = useMotionTemplate`calc(${t} * 15svh)`
  const bottomInset = useMotionTemplate`calc(${t} * 12svh)`
  const radius = useMotionTemplate`calc(${t} * 24px)`
  const borderColor = useMotionTemplate`rgba(255,255,255,calc(${t} * 0.12))`
  const imageScale = useTransform(t, [0, 1], [1.12, 1])
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0])
  const headlineY = useTransform(scrollYProgress, [0, 0.45], [0, -80])
  const captionOpacity = useTransform(scrollYProgress, [0.55, 0.85], [0, 1])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0])

  return (
    <section ref={ref} id="top" aria-labelledby="hero-title" className="relative h-[210svh] bg-ink">
      <div className="sticky top-0 h-svh overflow-hidden">
        <motion.div
          className="absolute overflow-hidden border shadow-2xl shadow-black/60"
          style={
            reduce
              ? { inset: 0 }
              : { top: topInset, bottom: bottomInset, left: sideInset, right: sideInset, borderRadius: radius, borderColor }
          }
        >
          <motion.div className="absolute inset-0" style={{ scale: reduce ? 1 : imageScale }}>
            <Image
              src="/images/hero-library.png"
              alt="Timber-framed library hall with globe pendant lights, bookshelf staircase, and tall glazing onto a garden"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/40" aria-hidden />

          <motion.div
            className="absolute inset-x-0 bottom-0 px-5 pb-12 sm:px-10 sm:pb-16"
            style={{ opacity: headlineOpacity, y: headlineY }}
          >
            <p className="mb-5 text-xs uppercase tracking-[0.25em] text-cream/90">Equipment · Lab Spaces · Technical Assets</p>
            <h1
              id="hero-title"
              className="max-w-5xl text-balance font-display text-[clamp(2.4rem,8.5vw,7.25rem)] font-medium leading-[0.92] tracking-tight text-white"
            >
              We shape underused assets into institutional purpose.
            </h1>
          </motion.div>

          <motion.div
            className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-8"
            style={{ opacity: captionOpacity }}
            aria-hidden
          >
            <p className="max-w-sm font-display text-lg leading-snug text-white sm:text-2xl">
              One campus. Every lab, studio, and instrument — shared on trust.
            </p>
            <p className="text-xs uppercase tracking-widest text-cream/80">Fig. 01 — Central Library Commons</p>
          </motion.div>
        </motion.div>

        <motion.p
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/70"
        >
          Scroll
        </motion.p>
      </div>
    </section>
  )
}
