'use client'

import { BadgeCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { btnGhost, btnPrimary } from './ui'

type Props = { label: string; signer: string; signature?: string; onSign: (dataUrl: string) => void; disabled?: boolean }

export function SignaturePad({ label, signer, signature, onSign, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111111'
  }, [signature])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const clear = () => {
    const c = canvasRef.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
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

      {signature ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL from canvas
        <img src={signature} alt={`Signature of ${signer}`} className="mt-2 h-28 w-full rounded-xl bg-[#f4f2ee] object-contain" />
      ) : (
        <>
          <canvas
            ref={canvasRef}
            aria-label={`Signature pad for ${signer}. Draw your signature.`}
            className={`mt-2 h-28 w-full touch-none rounded-xl border border-dashed border-ink/20 bg-[#f4f2ee] ${disabled ? 'pointer-events-none opacity-50' : 'cursor-crosshair'}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drawing.current = true
              const ctx = e.currentTarget.getContext('2d')
              const p = point(e)
              ctx?.beginPath()
              ctx?.moveTo(p.x, p.y)
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return
              const ctx = e.currentTarget.getContext('2d')
              const p = point(e)
              ctx?.lineTo(p.x, p.y)
              ctx?.stroke()
              if (!hasInk) setHasInk(true)
            }}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={clear} className={`${btnGhost} flex-1 border-ink/15 px-3 py-2 text-ink hover:bg-ink/5`}>
              Clear
            </button>
            <button
              type="button"
              disabled={!hasInk || disabled}
              onClick={() => canvasRef.current && onSign(canvasRef.current.toDataURL('image/png'))}
              className={`${btnPrimary} flex-1 bg-ink px-3 py-2 text-white hover:bg-ink/85`}
            >
              Apply signature
            </button>
          </div>
        </>
      )}
    </div>
  )
}
