'use client'

import { useEffect, useState } from 'react'
import { Lock, LockOpen, Download, CheckCircle, Clock } from 'lucide-react'
import { type Booking, type Resource } from '@/lib/resources'
import type { Agreement } from '@/lib/api'
import { SignaturePad } from './signature-pad'
import { Modal, btnPrimary } from './ui'
import { api } from '@/lib/api'

type Props = {
  booking: Booking | null
  resource: Resource | null
  viewer: 'user' | 'owner'
  onClose: () => void
  onSign: (party: 'user' | 'owner', dataUrl: string, hash: string) => void | Promise<void>
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
  const [agreementError, setAgreementError] = useState('')
  const [agreementData, setAgreementData] = useState<Agreement | null>(null)
  const [loadingAgreement, setLoadingAgreement] = useState(false)
  const bookingId = booking?.id

  useEffect(() => {
    let cancelled = false
    setAgreementData(null)
    setAgreementError('')

    if (!bookingId) {
      setLoadingAgreement(false)
      return () => {
        cancelled = true
      }
    }

    setLoadingAgreement(true)
    void api.agreements.get(bookingId)
      .then((agreement) => {
        if (cancelled) return
        if (!agreement.document_hash) {
          throw new Error('The agreement document hash is unavailable.')
        }
        setAgreementData(agreement)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAgreementError(
          err instanceof Error ? err.message : 'Unable to load the agreement terms.'
        )
      })
      .finally(() => {
        if (!cancelled) setLoadingAgreement(false)
      })

    return () => {
      cancelled = true
    }
  }, [bookingId])

  if (!booking || !resource) return <Modal open={false} onClose={onClose} title="">{null}</Modal>

  const agreementLoaded = agreementData?.booking_id === booking.id
  const borrowerSigned = agreementLoaded
    ? Boolean(agreementData?.user_signed_at)
    : Boolean(booking.userSignature)
  const ownerSigned = agreementLoaded
    ? Boolean(agreementData?.owner_signed_at)
    : Boolean(booking.ownerSignature)
  const borrowerSignature = agreementLoaded
    ? agreementData?.user_signature || (borrowerSigned ? 'signed' : undefined)
    : booking.userSignature
  const ownerSignature = agreementLoaded
    ? agreementData?.owner_signature || (ownerSigned ? 'signed' : undefined)
    : booking.ownerSignature
  const executed = borrowerSigned && ownerSigned
  const ref = `RX-${booking.id.slice(-6).toUpperCase()}`

  const addSignature = async (dataUrl: string) => {
    if (
      !agreementData ||
      agreementData.booking_id !== booking.id ||
      !agreementData.document_hash
    ) throw new Error('The agreement has not loaded. Please try again before signing.')

    try {
      await onSign(viewer, dataUrl, agreementData.document_hash)
      const refreshedAgreement = await api.agreements.get(booking.id)
      setAgreementData(refreshedAgreement)
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Unable to record the signature.')
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

        <dl className="mt-5 grid gap-2 rounded-xl bg-white/70 p-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Borrower</dt><dd>{booking.applicant.name}</dd></div>
          <div><dt className="font-semibold">Resource owner</dt><dd>{resource.owner}</dd></div>
          <div><dt className="font-semibold">Resource</dt><dd>{resource.name} · {resource.location}</dd></div>
          <div><dt className="font-semibold">Booking period</dt><dd>{booking.startDate} – {booking.endDate}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold">Purpose</dt><dd>{booking.purpose}</dd></div>
        </dl>

        {loadingAgreement && <p className="mt-4 text-sm text-ink/60">Loading the agreement terms…</p>}
        {agreementError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">
            Unable to load the agreement: {agreementError}
          </p>
        )}
        {agreementLoaded && agreementData && (
          <div className="mt-5 space-y-4">
            <section>
              <h3 className="text-sm font-semibold">Mandatory institutional terms</h3>
              <ol className="mt-2 space-y-2">
                {agreementData.content_clauses.mandatory.map((clause, index) => (
                  <li key={`${index}-${clause}`} className="text-sm leading-relaxed text-ink/75">
                    {clause}
                  </li>
                ))}
              </ol>
            </section>
            {agreementData.content_clauses.tailored.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold">Resource-specific operational covenants</h3>
                <ol className="mt-2 space-y-2">
                  {agreementData.content_clauses.tailored.map((clause, index) => (
                    <li key={`${index}-${clause}`} className="text-sm leading-relaxed text-ink/75">
                      Special Rule {index + 1}: {clause}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        {/* SPLIT SIGNATURE PANELS: Viewer signs only in their mode */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Borrower Block */}
          <div className="rounded-xl border border-ink/10 bg-white/70 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink/70">
                Borrower Signature
              </span>
              {borrowerSigned ? (
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

            {viewer === 'user' && !borrowerSigned ? (
              <SignaturePad
                label=""
                signer={booking.applicant.name}
                signature={borrowerSignature}
                onSign={addSignature}
                disabled={loadingAgreement || !agreementLoaded}
              />
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-ink/20 flex flex-col items-center justify-center p-3 text-center">
                {borrowerSigned ? (
                  <span className="text-xs font-semibold text-emerald-800">
                    Borrower signature recorded
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
              {ownerSigned ? (
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

            {viewer === 'owner' && !ownerSigned ? (
              <SignaturePad
                label=""
                signer={resource.owner}
                signature={ownerSignature}
                onSign={addSignature}
                disabled={loadingAgreement || !agreementLoaded}
              />
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-ink/20 flex flex-col items-center justify-center p-3 text-center">
                {ownerSigned ? (
                  <span className="text-xs font-semibold text-emerald-800">
                    Owner signature recorded
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
              : `Access locked until both signatures are verified (${Number(borrowerSigned) + Number(ownerSigned)}/2).`}
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
