'use client'

import React, { useState, useEffect } from 'react'
import { Lock, Unlock, Snowflake, CreditCard, CheckCircle2, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'

interface EscrowWidgetProps {
  bookingId: string
  canPay?: boolean
  onPaymentSuccess?: () => void
}

export function EscrowWidget({ bookingId, canPay = false, onPaymentSuccess }: EscrowWidgetProps) {
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  const loadStatus = async () => {
    try {
      const data = await api.payments.getStatus(bookingId)
      setPayment(data)
    } catch (err) {
      console.error('Error loading escrow status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [bookingId])

  const handlePay = async () => {
    setPaying(true)
    try {
      const order = await api.payments.createOrder(bookingId)
      // Demo escrow verification
      await api.payments.verify(bookingId, `pay_demo_${Math.random().toString(16).slice(2, 10)}`)
      await loadStatus()
      onPaymentSuccess?.()
      alert('Payment captured & safely held in escrow!')
    } catch (err: any) {
      alert(`Payment failed: ${err.message}`)
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return <div className="h-20 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
  }

  if (!payment) return null

  const isHeld = payment.status === 'HELD'
  const isCreated = payment.status === 'CREATED'
  const usageFee = Number(payment.usage_fee || 1200)
  const deposit = Number(payment.deposit_amount || 2000)
  const totalEscrow = usageFee + deposit

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          {isHeld ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
              <Lock className="size-3" />
              Held in Escrow
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
              <CreditCard className="size-3" />
              Awaiting Payment
            </span>
          )}
        </div>
        <div className="text-stone">
          Total Escrow Amount:{' '}
          <strong className="text-white font-semibold">
            ₹{totalEscrow}
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-stone border-y border-white/5 py-2.5 my-2.5">
        <div>
          <span>Usage Fee:</span>{' '}
          <strong className="text-white">₹{usageFee}</strong>
        </div>
        <div>
          <span>Refundable Deposit:</span>{' '}
          <strong className="text-white">₹{deposit}</strong>
        </div>
      </div>

      {isCreated && canPay && (
        <button
          type="button"
          onClick={handlePay}
          disabled={paying}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
        >
          <CreditCard className="size-3.5" />
          <span>{paying ? 'Processing...' : `Pay ₹${payment.usage_fee + payment.deposit_amount} into Escrow`}</span>
        </button>
      )}

      {isHeld && (
        <p className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2">
          <CheckCircle2 className="size-3.5" />
          Funds safely held in escrow until return inspection is complete.
        </p>
      )}
    </div>
  )
}
