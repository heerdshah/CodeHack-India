'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import type { BookingStatus } from '@/lib/resources'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40'
export const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-stone outline-none transition focus:border-cream/60 focus:ring-2 focus:ring-cream/20'
export const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone'

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  wide?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button aria-label="Close dialog" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-panel text-white shadow-2xl sm:rounded-3xl ${
              wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
            }`}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                {eyebrow && <p className="text-xs uppercase tracking-widest text-stone">{eyebrow}</p>}
                <h2 id={titleId} className="mt-0.5 font-display text-xl font-medium text-pretty">
                  {title}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-stone transition hover:text-white"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending Owner Review', cls: 'bg-amber-300/10 text-amber-200 ring-amber-300/30' },
  rejected: { label: 'Rejected', cls: 'bg-red-400/10 text-red-300 ring-red-400/30' },
  approved: { label: 'Approved — Awaiting Signatures', cls: 'bg-sky-300/10 text-sky-200 ring-sky-300/30' },
  signed: { label: 'Signed — Pre-Checkin Required', cls: 'bg-cream/10 text-cream ring-cream/30' },
  active: { label: 'Active Access', cls: 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/30' },
  returned: { label: 'Returned — Owner Verifying', cls: 'bg-amber-300/10 text-amber-200 ring-amber-300/30' },
  completed: { label: 'Completed', cls: 'bg-white/5 text-stone ring-white/15' },
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${m.cls}`}>
      {m.label}
    </span>
  )
}

export function FileDrop({
  label,
  files,
  onFiles,
  hint,
  compact = false,
}: {
  label: string
  files: string[]
  onFiles: (names: string[]) => void
  hint?: string
  compact?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onFiles(Array.from(e.dataTransfer.files).map((f) => f.name))
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-center transition hover:border-cream/50 hover:bg-white/[0.04] ${
          compact ? 'px-4 py-3' : 'px-4 py-6'
        }`}
      >
        <span className="text-sm font-medium text-white">{label}</span>
        {hint && <span className="text-xs text-stone">{hint}</span>}
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept="image/*,.pdf"
        className="sr-only"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []).map((f) => f.name))}
      />
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f) => (
            <li key={f} className="max-w-full truncate rounded-full bg-white/5 px-2.5 py-1 text-xs text-cream ring-1 ring-white/10">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SectionHeading({ index, eyebrow, title, id }: { index: string; eyebrow: string; title: string; id?: string }) {
  return (
    <div>
      <p className="flex items-center gap-3 text-xs uppercase tracking-widest text-stone">
        <span className="text-cream">{index}</span>
        <span className="h-px w-8 bg-white/20" aria-hidden />
        {eyebrow}
      </p>
      <h2 id={id} className="mt-4 max-w-2xl text-balance font-display text-3xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
        {title}
      </h2>
    </div>
  )
}
