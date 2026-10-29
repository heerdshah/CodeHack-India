import React from "react"
import { BookingItem, BookingStatus } from "@/hooks/useBooking"
import { Check, Clock, AlertTriangle, XCircle, ShieldCheck, ArrowRight } from "lucide-react"

interface BookingTimelineProps {
  booking: BookingItem
}

interface Phase {
  id: number
  title: string
  statuses: BookingStatus[]
  description: string
}

const PHASES: Phase[] = [
  {
    id: 1,
    title: "1. Request & Approval",
    statuses: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
    description: "Owner evaluates reservation dates and eligibility",
  },
  {
    id: 2,
    title: "2. Agreement & Escrow",
    statuses: ["AWAITING_SIGNATURES", "AWAITING_PAYMENT"],
    description: "Dual cryptographic contract execution & security deposit escrow",
  },
  {
    id: 3,
    title: "3. Check-in & Use",
    statuses: ["CONFIRMED", "CHECKED_IN"],
    description: "6-angle baseline photo capture and active equipment possession",
  },
  {
    id: 4,
    title: "4. Return & Condition Review",
    statuses: ["RETURN_SUBMITTED", "DAMAGE_REVIEW"],
    description: "Return photos analyzed against baseline by Gemini Visual AI",
  },
  {
    id: 5,
    title: "5. Settlement & Completion",
    statuses: [
      "COMPLETED",
      "DISPUTE_OPEN",
      "RESOLVED_OWNER",
      "RESOLVED_USER",
      "RESOLVED_SPLIT",
    ],
    description: "Escrow released, deposit refunded, or administrative arbitration settled",
  },
]

export const BookingTimeline: React.FC<BookingTimelineProps> = ({ booking }) => {
  const currentStatus = booking.status

  // Terminal or non-linear states
  const isTerminal = ["REJECTED", "CANCELLED", "WAITLISTED"].includes(currentStatus)

  const getPhaseStatus = (phase: Phase) => {
    if (isTerminal) return "disabled"

    // Find current phase index
    const currentPhaseIdx = PHASES.findIndex((p) => p.statuses.includes(currentStatus))
    const thisPhaseIdx = PHASES.findIndex((p) => p.id === phase.id)

    if (currentPhaseIdx === -1) return "upcoming"
    if (thisPhaseIdx < currentPhaseIdx) return "completed"
    if (thisPhaseIdx === currentPhaseIdx) return "active"
    return "upcoming"
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Guided Workflow Lifecycle</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Phased progression from application to automated deposit release
          </p>
        </div>
      </div>

      {/* Terminal or Out-of-band banner */}
      {currentStatus === "REJECTED" && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-rose-900">Booking Request Rejected</h4>
            <p className="text-rose-700">
              The resource owner declined this reservation.
              {booking.rejection_reason && (
                <span className="block mt-1 italic">Reason: "{booking.rejection_reason}"</span>
              )}
            </p>
          </div>
        </div>
      )}

      {currentStatus === "CANCELLED" && (
        <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-3">
          <XCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-slate-800">Reservation Cancelled</h4>
            <p className="text-slate-600">
              This reservation was cancelled. Any authorized escrow or deposit has been released.
            </p>
          </div>
        </div>
      )}

      {currentStatus === "WAITLISTED" && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
          <Clock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-purple-900">Reservation Waitlisted</h4>
            <p className="text-purple-700">
              The equipment is currently booked for these dates. You are queued on the priority waitlist.
            </p>
          </div>
        </div>
      )}

      {/* Grouped 5-Phase Lifecycle */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {PHASES.map((phase) => {
          const state = getPhaseStatus(phase)
          const isActive = state === "active"
          const isDone = state === "completed"

          return (
            <div key={phase.id} className="relative flex items-start gap-4">
              <div
                className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  isActive
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : phase.id}
              </div>

              <div className="space-y-0.5">
                <h4
                  className={`text-xs font-bold ${
                    isActive
                      ? "text-blue-600"
                      : isDone
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {phase.title}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{phase.description}</p>

                {isActive && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    <span>In progress: {currentStatus.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
