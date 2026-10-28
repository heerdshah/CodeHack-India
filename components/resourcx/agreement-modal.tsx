'use client'

import { Lock, LockOpen } from 'lucide-react'
import { formatDate, type Booking, type Resource } from '@/lib/resources'
import { SignaturePad } from './signature-pad'
import { Modal, btnPrimary } from './ui'

type Props = {
  booking: Booking | null
  resource: Resource | null
  onClose: () => void
  onSign: (party: 'user' | 'owner', dataUrl: string) => void
  onProceed: () => void
}

export function AgreementModal({ booking, resource, onClose, onSign, onProceed }: Props) {
  if (!booking || !resource) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const executed = Boolean(booking.userSignature && booking.ownerSignature)
  const ref = `RX-${booking.id.slice(-6).toUpperCase()}`

  const clauses = [
    ['Parties', `This agreement is made between ${booking.applicant.name} (${booking.applicant.role}, ${booking.applicant.department}) — the "Borrower" — and ${resource.owner}, custodian of the ${resource.name} — the "Owner".`],
    ['Scope & term', `Access is granted to ${resource.name} at ${resource.location} from ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)} solely for: "${booking.purpose}".`],
    ['Duty of care', 'The Borrower shall operate the asset only within certified competencies, follow posted safety procedures, never transfer access to third parties, and report any malfunction immediately.'],
    ['Damage liability', "The Borrower accepts financial liability for damage beyond fair wear, assessed at documented repair or replacement value and charged to the Borrower's department cost centre. No payment is collected at booking."],
    ['Inspection protocol', 'Six-angle photographs (front, back, left, right, top, bottom) are mandatory at check-in and return. AI-assisted comparison and owner verification are binding evidence of condition.'],
    ['Termination', 'The Owner may revoke access at any time for safety, misuse, or maintenance. Disputes are resolved by the Office of Research Infrastructure.'],
  ]

  return (
    <Modal open onClose={onClose} wide eyebrow={`Legal binding document · ${ref}`} title="Resource Use & Liability Agreement">
      <article className="rounded-2xl bg-[#f4f2ee] p-5 text-ink shadow-inner sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-4">
          <p className="font-display text-lg font-semibold">
            Resourc<span className="text-ink/50">X</span> — Agreement
          </p>
          <p className="text-xs text-ink/60">PDF · {ref} · Page 1 of 1</p>
        </div>
        <ol className="mt-5 space-y-4">
          {clauses.map(([h, body], i) => (
            <li key={h}>
              <h3 className="text-sm font-semibold">
                {i + 1}. {h}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <SignaturePad label="Borrower signature" signer={booking.applicant.name} signature={booking.userSignature} onSign={(d) => onSign('user', d)} />
          <SignaturePad label="Owner signature" signer={resource.owner} signature={booking.ownerSignature} onSign={(d) => onSign('owner', d)} />
        </div>
      </article>

      <div
        className={`mt-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${
          executed ? 'bg-emerald-300/10 ring-1 ring-emerald-300/30' : 'bg-white/[0.03] ring-1 ring-white/10'
        }`}
        aria-live="polite"
      >
        <p className="flex items-start gap-2 text-sm">
          {executed ? <LockOpen className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : <Lock className="mt-0.5 size-4 shrink-0 text-stone" />}
          <span className={executed ? 'text-emerald-100' : 'text-white/70'}>
            {executed
              ? 'Both signatures verified. Agreement executed.'
              : `Access locked until both signatures are verified (${[booking.userSignature, booking.ownerSignature].filter(Boolean).length}/2).`}
          </span>
        </p>
        {executed && booking.status === 'signed' && booking.isMine && (
          <button onClick={onProceed} className={btnPrimary}>
            Start pre-checkin inspection
          </button>
        )}
      </div>
    </Modal>
  )
}
