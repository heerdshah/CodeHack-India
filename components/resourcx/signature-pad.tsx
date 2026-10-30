'use client'

import { BadgeCheck } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'

type Props = {
  label: string
  signer: string
  signature?: string
  onSign: (dataUrl: string) => void | Promise<void>
  disabled?: boolean
}

export function SignaturePad({ label, signer, signature, onSign, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const activePointer = useRef<number | null>(null)
  const [hasInk, setHasInk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.lineWidth = 2 * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111111'
  }, [signature])

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (e.currentTarget.width / r.width),
      y: (e.clientY - r.top) * (e.currentTarget.height / r.height),
    }
  }

  const clear = () => {
    if (disabled || saving) return
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
    setError('')
  }

  const addSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasInk || disabled || saving) return

    setSaving(true)
    setError('')
    try {
      await onSign(canvas.toDataURL('image/png'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the signature. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-ink/15 bg-white p-3 text-ink">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink/60">{label}</p>
        {signature && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <BadgeCheck className="size-3.5" aria-hidden /> Verified
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm font-medium">{signer}</p>

      {signature?.startsWith('data:image/') ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL from canvas
        <img src={signature} alt={`Signature of ${signer}`} className="mt-2 h-28 w-full rounded-xl bg-[#f4f2ee] object-contain" />
      ) : signature ? (
        <div className="mt-2 flex h-28 items-center justify-center rounded-xl bg-[#f4f2ee] text-sm font-medium text-emerald-800">
          Digital signature recorded
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            aria-label={`Signature pad for ${signer}. Draw your signature.`}
            className={`mt-2 block h-28 w-full touch-none rounded-xl border border-dashed border-ink/20 bg-[#f4f2ee] ${disabled || saving ? 'pointer-events-none opacity-50' : 'cursor-crosshair'}`}
            onPointerDown={(e) => {
              if (disabled || saving) return
              e.preventDefault()
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                setError('Unable to capture signature input. Try clicking or tapping the pad again.')
                return
              }
              activePointer.current = e.pointerId
              drawing.current = true
              const ctx = e.currentTarget.getContext('2d')
              if (!ctx) {
                drawing.current = false
                activePointer.current = null
                return
              }
              const p = point(e)
              ctx?.beginPath()
              ctx?.moveTo(p.x, p.y)
              ctx?.lineTo(p.x + 1, p.y + 1)
              ctx?.stroke()
              setHasInk(true)
              setError('')
            }}
            onPointerMove={(e) => {
              if (!drawing.current || activePointer.current !== e.pointerId) return
              e.preventDefault()
              const ctx = e.currentTarget.getContext('2d')
              const p = point(e)
              ctx?.lineTo(p.x, p.y)
              ctx?.stroke()
            }}
            onPointerUp={(e) => {
              if (activePointer.current !== e.pointerId) return
              drawing.current = false
              activePointer.current = null
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
            }}
            onLostPointerCapture={() => {
              drawing.current = false
              activePointer.current = null
            }}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={clear}
              disabled={disabled || saving || !hasInk}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-ink/20 bg-white px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-[#f4f2ee] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Erase signature
            </button>
            <button
              type="button"
              disabled={!hasInk || disabled || saving}
              onClick={() => void addSignature()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-3 py-2.5 text-sm font-medium text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Adding signature…' : 'Add signature'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
        </>
      )}
    </div>
  )
}
