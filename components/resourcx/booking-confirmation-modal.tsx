'use client'

import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Modal, btnGhost, btnPrimary } from './ui'

export function BookingConfirmationModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()

  const openAccount = () => {
    onClose()
    router.push('/account#active-bookings-heading')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Booking request"
      title="Request submitted"
    >
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/75">
          Booking request submitted, waiting for owner approval. Keep track of
          your bookings in the account section.
        </p>
        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          <button type="button" onClick={onClose} className={btnGhost}>
            Continue browsing
          </button>
          <button type="button" onClick={openAccount} className={btnPrimary}>
            View my bookings
          </button>
        </div>
      </div>
    </Modal>
  )
}
