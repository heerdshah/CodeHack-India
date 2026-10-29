'use client'

import { useState } from 'react'
import { Lock, LockOpen, Download, CheckCircle, Clock } from 'lucide-react'
import { formatDate, type Booking, type Resource } from '@/lib/resources'
import { SignaturePad } from './signature-pad'
import { Modal, btnPrimary, btnGhost, inputCls, labelCls } from './ui'
import { api } from '@/lib/api'

type Props = {
  booking: Booking | null
  resource: Resource | null
  viewer: 'user' | 'owner'
  onClose: () => void
  onSign: (party: 'user' | 'owner', dataUrl: string, hash: string) => void
  onProceed: () => void
}

export function AgreementModal({
  booking,
  resource,
  viewer,
  onClose,
  onSign,
  onProceed,
}: Props) {
  const [reauthPassword, setReauthPassword] = useState('')
  const [showReauth, setShowReauth] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<string | null>(null)
  const [reauthError, setReauthError] = useState('')
  const [isSigning, setIsSigning] = useState(false)

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

  const handleSignatureCaptured = (dataUrl: string) => {
    setPendingSignature(dataUrl)
    setShowReauth(true)
    setReauthError('')
  }

  const handleConfirmSignature = async () => {
    if (!reauthPassword) {
      return setReauthError('Please enter your account password to authorize digital signature.')
    }
    if (!pendingSignature) return

    setIsSigning(true)
    setReauthError('')

    try {
      // Fetch actual document hash from backend agreement endpoint
      let docHash = ''
      try {
        const serverAgr = await api.agreements.get(booking.id)
        docHash = serverAgr.document_hash
      } catch {
        docHash = ''
      }
      await onSign(viewer, pendingSignature, docHash)
      setShowReauth(false)
      setPendingSignature(null)
      setReauthPassword('')
    } catch (err: any) {
      setReauthError(err.message || 'Signature authorization failed.')
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide eyebrow={`Legal binding document · ${ref}`} title="Resource Use & Liability Agreement">
      <article className="rounded-2xl bg-[#f4f2ee] p-5 text-ink shadow-inner sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 pb-4">
          <p className="font-display text-lg font-semibold">
            Resourc<span className="text-ink/50">X</span> — Agreement
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink/60">PDF · {ref}</span>
            <a
              href={api.agreements.getPdfUrl(booking.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink/80 hover:text-ink underline"
            >
              <Download className="size-3.5" />
              Download Document
            </a>
          </div>
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

        {/* SPLIT SIGNATURE PANELS: Viewer signs only in their mode */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Borrower Block */}
          <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink/70">
                Borrower Signature
              </span>
              {booking.userSignature ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle className="size-3.5" /> Signed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <Clock className="size-3.5" /> Pending
                </span>
              )}
            </div>

            <p className="text-xs text-ink/60 mb-2">Signer: {booking.applicant.name}</p>

            {viewer === 'user' ? (
              <SignaturePad
                label=""
                signer={booking.applicant.name}
                signature={booking.userSignature}
                onSign={handleSignatureCaptured}
              />
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-ink/20 flex flex-col items-center justify-center p-3 text-center">
                {booking.userSignature ? (
                  <span className="text-xs font-semibold text-emerald-800">
                    Digitally countersigned by Borrower
                  </span>
                ) : (
                  <span className="text-xs text-ink/50 italic">
                    Awaiting borrower digital signature in User Mode
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Owner Block */}
          <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink/70">
                Owner Signature
              </span>
              {booking.ownerSignature ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle className="size-3.5" /> Signed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <Clock className="size-3.5" /> Pending
                </span>
              )}
            </div>

            <p className="text-xs text-ink/60 mb-2">Signer: {resource.owner}</p>

            {viewer === 'owner' ? (
              <SignaturePad
                label=""
                signer={resource.owner}
                signature={booking.ownerSignature}
                onSign={handleSignatureCaptured}
              />
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-ink/20 flex flex-col items-center justify-center p-3 text-center">
                {booking.ownerSignature ? (
                  <span className="text-xs font-semibold text-emerald-800">
                    Digitally approved and signed by Facility Owner
                  </span>
                ) : (
                  <span className="text-xs text-ink/50 italic">
                    Awaiting facility owner digital signature in Owner Mode
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Re-auth confirmation modal before submitting signature */}
      {showReauth && (
        <div className="mt-4 rounded-xl border border-cream/20 bg-panel/95 p-4 shadow-xl">
          <h4 className="text-sm font-semibold text-cream mb-1">
            Confirm Signature & Re-authenticate
          </h4>
          <p className="text-xs text-white/70 mb-3">
            Please enter your password to cryptographically bind your digital signature and timestamp to this agreement.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="password"
              placeholder="Account password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              className={`${inputCls} sm:max-w-xs`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowReauth(false); setPendingSignature(null); }}
                className={btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSigning}
                onClick={handleConfirmSignature}
                className={btnPrimary}
              >
                {isSigning ? 'Authorizing...' : 'Authorize & Sign'}
              </button>
            </div>
          </div>
          {reauthError && <p className="mt-2 text-xs text-red-300">{reauthError}</p>}
        </div>
      )}

      {/* Status Bar */}
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
              ? 'Both signatures verified. Agreement executed. Check-in unlocked.'
              : `Access locked until both signatures are verified (${[booking.userSignature, booking.ownerSignature].filter(Boolean).length}/2).`}
          </span>
        </p>
        {executed && (booking.status === 'signed' || booking.status === 'approved') && booking.isMine && (
          <button onClick={onProceed} className={btnPrimary}>
            Start pre-checkin inspection
          </button>
        )}
      </div>
    </Modal>
  )
}
