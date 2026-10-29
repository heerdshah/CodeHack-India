"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { Alert } from "@/components/ui/Alert"
import { Skeleton } from "@/components/ui/Skeleton"
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog"
import toast from "react-hot-toast"
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  ImageOff,
  Eye,
  Crosshair,
  Sliders,
  Sparkles,
  HelpCircle,
  Camera,
  Layers,
  FileCheck,
  DollarSign,
  Wrench,
  XCircle,
  Send,
  Lock,
  ThumbsUp,
  Flag,
  Download,
  Loader2,
} from "lucide-react"

interface DamageReportProps {
  bookingId: string
  bookingStatus?: string
  isOwner?: boolean
  onRefresh?: () => void
}

export const DamageReport: React.FC<DamageReportProps> = ({
  bookingId,
  bookingStatus,
  isOwner,
  onRefresh,
}) => {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: incident, isLoading } = useQuery<any>({
    queryKey: ["damage-assessment", bookingId],
    queryFn: () => api.get(`/incidents/${bookingId}/damage-assessment`),
  })

  const [activeDiffTab, setActiveDiffTab] = useState<Record<string, "original" | "diff">>({})

  // Modal Dialogs
  const [showNoDamageConfirm, setShowNoDamageConfirm] = useState(false)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [downloadingReceipt, setDownloadingReceipt] = useState(false)

  const handleDownloadReceipt = async () => {
    try {
      setDownloadingReceipt(true)
      const token = typeof window !== "undefined" ? localStorage.getItem("availo_token") : null
      const res = await fetch(`http://localhost:8000/api/v1/contracts/${bookingId}/receipt/pdf`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.detail || "Failed to download settlement receipt")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Availo_Receipt_${bookingId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Settlement PDF Receipt downloaded successfully")
    } catch (err: any) {
      toast.error(err.message || "Failed to download receipt PDF")
    } finally {
      setDownloadingReceipt(false)
    }
  }

  // Damage Claim Form State (for Owner)
  const [claimDesc, setClaimDesc] = useState("")
  const [claimJustification, setClaimJustification] = useState("")
  const [claimCost, setClaimCost] = useState("")
  const [claimResolution, setClaimResolution] = useState("COMPENSATION")
  const [claimAngles, setClaimAngles] = useState<string[]>([])

  // Researcher Response State
  const [respondAction, setRespondAction] = useState<"ACCEPT" | "COUNTER" | "DISPUTE">("ACCEPT")
  const [respondNote, setRespondNote] = useState("")
  const [respondCounterAmt, setRespondCounterAmt] = useState("")

  // Owner Decision Mutation (No Damage / Damage Reported)
  const ownerDecisionMutation = useMutation({
    mutationFn: (payload: { decision: "NO_DAMAGE_REPORTED" | "DAMAGE_REPORTED"; notes?: string }) =>
      api.post(`/incidents/${bookingId}/owner-decision`, payload),
    onSuccess: (data: any) => {
      if (data.owner_decision === "NO_DAMAGE_REPORTED") {
        toast.success("Return confirmed with No Damage. Agreement successfully closed!")
      } else {
        toast.success("Damage reported. Please submit claim details.")
        setShowClaimForm(true)
      }
      queryClient.invalidateQueries({ queryKey: ["damage-assessment", bookingId] })
      onRefresh?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit owner decision")
    },
  })

  // Submit Claim Mutation
  const claimMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/incidents/${bookingId}/claims`, payload),
    onSuccess: () => {
      toast.success("Damage claim submitted to researcher")
      setShowClaimForm(false)
      queryClient.invalidateQueries({ queryKey: ["damage-assessment", bookingId] })
      onRefresh?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit damage claim")
    },
  })

  // Respond Claim Mutation
  const respondMutation = useMutation({
    mutationFn: ({ claimId, payload }: { claimId: string; payload: any }) =>
      api.post(`/incidents/claims/${claimId}/respond`, payload),
    onSuccess: () => {
      toast.success("Response recorded successfully")
      queryClient.invalidateQueries({ queryKey: ["damage-assessment", bookingId] })
      onRefresh?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record response")
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="p-8 bg-slate-50 border border-slate-200/80 rounded-2xl text-center space-y-2">
        <Info className="w-6 h-6 text-slate-400 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-800">Inspection in queue</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Condition inspection records will appear once return photos are processed by Gemini Vision AI and the Explainable AI (XAI) engine.
        </p>
      </div>
    )
  }

  const assessments = incident.assessments || []
  const claims = incident.claims || []
  const isResolved =
    incident.status === "RESOLVED" ||
    incident.status === "RESOLVED_USER" ||
    incident.status === "RESOLVED_OWNER" ||
    incident.status === "RESOLVED_SPLIT" ||
    bookingStatus?.startsWith("RESOLVED_") ||
    bookingStatus === "COMPLETED"

  const activeClaim = claims.find(
    (c: any) => c.status === "SUBMITTED" || c.status === "RESEARCHER_REVIEW" || c.status === "DISPUTED"
  )

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimDesc || !claimJustification) {
      toast.error("Please fill in the claim description and justification")
      return
    }
    claimMutation.mutate({
      description: claimDesc,
      justification: claimJustification,
      estimated_cost: parseFloat(claimCost) || 0,
      requested_resolution: claimResolution,
      photo_angles: claimAngles,
    })
  }

  const handleRespondSubmit = (claimId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!respondNote) {
      toast.error("Please provide a note explaining your response")
      return
    }
    respondMutation.mutate({
      claimId,
      payload: {
        action: respondAction,
        note: respondNote,
        counter_amount: respondAction === "COUNTER" ? parseFloat(respondCounterAmt) || 0 : undefined,
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Clear Human-Understandable Status */}
      {incident.owner_decision === "NO_DAMAGE_REPORTED" || isResolved ? (
        <div className="space-y-3">
          <Alert variant="success" title="Return Inspection Finalized — Agreement Closed">
            The resource owner reviewed the 6-angle evidence and confirmed agreement closure. The agreement is formally closed and escrow reconciliation has been executed in the platform ledger.
          </Alert>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Official Settlement Receipt Available</span>
                <span className="text-[11px] text-emerald-700 block">Download the verifiable PDF receipt including persisted terms, timestamps, and escrow release details.</span>
              </div>
            </div>
            <button
              onClick={handleDownloadReceipt}
              disabled={downloadingReceipt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition self-start sm:self-auto shrink-0"
            >
              {downloadingReceipt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download PDF Receipt
            </button>
          </div>
        </div>
      ) : activeClaim ? (
        <Alert variant="warning" title="Damage Claim Active — Awaiting Resolution">
          The owner has reported damage and submitted a claim. The booking is in damage review. Deposit funds remain held safely in platform escrow until mutual resolution.
        </Alert>
      ) : (
        <Alert variant="info" title="AI Inspection Complete — Awaiting Owner Decision">
          Gemini Vision AI and the OpenCV XAI Engine have completed the 6-angle comparison. The resource owner must review the visual evidence and record the final condition decision.
        </Alert>
      )}

      {/* Methodology & Limitations Notice */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">
            Explainable AI (XAI) Assistive Analysis Framework
          </p>
          <p className="text-blue-800 leading-relaxed">
            AI comparison provides visual probability metrics and localized difference heatmaps. <b>The AI never decides whether damage occurred</b>; the final determination belongs entirely to the authorized resource owner.
          </p>
        </div>
      </div>

      {/* EXPLICIT OWNER DECISION PANEL (PHASE 2 REQUIREMENT) */}
      {isOwner && !isResolved && !activeClaim && (
        <div className="bg-white border-2 border-blue-600/30 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Owner Decision
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review the 6 canonical perspectives below, then record your official determination.
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200 self-start sm:self-auto">
              Owner Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Button A: Report Damage */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                  <Flag className="w-4 h-4 text-rose-600" />
                  Option 1: Report Suspected Damage
                </span>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Report a suspected issue, specify affected angles, and submit supporting evidence or repair quotations for researcher review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClaimForm(true)}
                disabled={ownerDecisionMutation.isPending}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <AlertTriangle className="w-4 h-4" />
                Report Damage
              </button>
            </div>

            {/* Button B: No Damage — Close Agreement */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  Option 2: Confirm No Damage
                </span>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Confirm that you are not reporting damage. This records your decision and safely executes the contract closure gate and deposit release.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoDamageConfirm(true)}
                disabled={ownerDecisionMutation.isPending}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                No Damage — Close Agreement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for No Damage */}
      <ConfirmationDialog
        isOpen={showNoDamageConfirm}
        title="Confirm Return & Close Agreement?"
        description="You are confirming that you do not wish to report damage for this return. This will record your decision and begin the agreement closure process. Please verify the return evidence and outstanding obligations before proceeding."
        confirmText="Confirm and Close Agreement"
        cancelText="Cancel"
        loading={ownerDecisionMutation.isPending}
        onConfirm={() => {
          setShowNoDamageConfirm(false)
          ownerDecisionMutation.mutate({ decision: "NO_DAMAGE_REPORTED" })
        }}
        onCancel={() => setShowNoDamageConfirm(false)}
      />

      {/* Active Damage Claim Banner / Action Bar */}
      {activeClaim && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Active Damage Claim #{activeClaim.id.slice(0, 8)}
            </span>
            <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              {activeClaim.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-amber-700 font-semibold block mb-0.5">Description:</span>
              <p className="text-amber-950">{activeClaim.description}</p>
            </div>
            <div>
              <span className="text-amber-700 font-semibold block mb-0.5">Resolution Requested:</span>
              <p className="text-amber-950 font-bold">
                {activeClaim.requested_resolution} — Est. Cost: ${activeClaim.estimated_cost}
              </p>
            </div>
          </div>

          {/* Researcher Response Form */}
          {!isOwner && activeClaim.status === "RESEARCHER_REVIEW" && (
            <form
              onSubmit={(e) => handleRespondSubmit(activeClaim.id, e)}
              className="pt-3 border-t border-amber-200 space-y-3"
            >
              <h5 className="font-bold text-xs text-amber-950">Researcher Response to Claim:</h5>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRespondAction("ACCEPT")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    respondAction === "ACCEPT" ? "bg-emerald-600 text-white" : "bg-white text-slate-700 border"
                  }`}
                >
                  Accept Claim
                </button>
                <button
                  type="button"
                  onClick={() => setRespondAction("COUNTER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    respondAction === "COUNTER" ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"
                  }`}
                >
                  Propose Counter-Offer
                </button>
                <button
                  type="button"
                  onClick={() => setRespondAction("DISPUTE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    respondAction === "DISPUTE" ? "bg-rose-600 text-white" : "bg-white text-slate-700 border"
                  }`}
                >
                  Dispute Claim
                </button>
              </div>

              {respondAction === "COUNTER" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Proposed Counter Amount ($)
                  </label>
                  <input
                    type="number"
                    value={respondCounterAmt}
                    onChange={(e) => setRespondCounterAmt(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border rounded-lg"
                    placeholder="e.g. 50.00"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Explanation & Supporting Evidence Note
                </label>
                <textarea
                  value={respondNote}
                  onChange={(e) => setRespondNote(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg bg-white"
                  placeholder="Explain why you accept, dispute, or counter this finding..."
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={respondMutation.isPending}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                Submit Response
              </button>
            </form>
          )}
        </div>
      )}

      {/* Owner Submit Claim Modal Form */}
      {isOwner && showClaimForm && (
        <div className="bg-white border-2 border-rose-300 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Submit Formal Damage Claim</h4>
              <p className="text-xs text-slate-500">
                Provide a factual description and repair estimate to initiate the resolution workflow.
              </p>
            </div>
            <button
              onClick={() => setShowClaimForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleClaimSubmit} className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Damage Description *
              </label>
              <input
                type="text"
                value={claimDesc}
                onChange={(e) => setClaimDesc(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg"
                placeholder="e.g. Deep scratch on top casing and loose lens mount"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Requested Resolution *
                </label>
                <select
                  value={claimResolution}
                  onChange={(e) => setClaimResolution(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="COMPENSATION">Direct Financial Compensation</option>
                  <option value="REPAIR">Borrower-Initiated Repair</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Estimated Repair Cost ($)
                </label>
                <input
                  type="number"
                  value={claimCost}
                  onChange={(e) => setClaimCost(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Justification (Why this occurred during booking) *
              </label>
              <textarea
                value={claimJustification}
                onChange={(e) => setClaimJustification(e.target.value)}
                className="w-full text-xs p-2.5 border rounded-lg"
                placeholder="Cite check-in vs check-out photo evidence..."
                rows={2}
              />
            </div>
            <button
              type="submit"
              disabled={claimMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Submit Damage Claim
            </button>
          </form>
        </div>
      )}

      {/* 6 Canonical Perspective Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {assessments.map((a: any) => {
          const isAnomaly =
            a.confidence_score >= 0.25 || !a.match || a.human_review_required
          const currentTab = activeDiffTab[a.id] || (a.difference_image_url ? "diff" : "original")

          return (
            <div
              key={a.id}
              className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4 hover:border-slate-300 transition"
            >
              {/* Card Header */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                    Perspective: {a.angle}
                  </span>
                  <span className="text-[11px] text-slate-500 capitalize">
                    {a.comparison_status ? a.comparison_status.replace(/_/g, " ") : "Comparable"}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    isAnomaly
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {isAnomaly ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> Possible Change
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Undamaged
                    </>
                  )}
                </span>
              </div>

              {/* View Switcher: Original Photos vs Difference Heatmap */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Evidence Viewer</span>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-slate-600">
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab((prev) => ({ ...prev, [a.id]: "original" }))}
                    className={`px-2.5 py-1 rounded-md font-medium text-xs transition ${
                      currentTab === "original"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "hover:text-slate-900"
                    }`}
                  >
                    Original Photos
                  </button>
                  {a.difference_image_url && (
                    <button
                      type="button"
                      onClick={() => setActiveDiffTab((prev) => ({ ...prev, [a.id]: "diff" }))}
                      className={`px-2.5 py-1 rounded-md font-medium text-xs transition flex items-center gap-1 ${
                        currentTab === "diff"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      Difference Heatmap
                    </button>
                  )}
                </div>
              </div>

              {/* Photos or Heatmap Area */}
              {currentTab === "diff" && a.difference_image_url ? (
                <div className="space-y-1.5">
                  <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                    <img
                      src={a.difference_image_url}
                      alt={`Difference heatmap for ${a.angle}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    Highlighted contours indicate localized pixel variance clusters against check-in baseline.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Check-in (Baseline)
                    </span>
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      {a.before_image_url ? (
                        <img
                          src={a.before_image_url}
                          alt={`Check-in ${a.angle}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          <ImageOff className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Check-out (Return)
                    </span>
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      {a.after_image_url ? (
                        <img
                          src={a.after_image_url}
                          alt={`Return ${a.angle}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          <ImageOff className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Explainability Breakdown Section */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2.5 text-xs border border-slate-100">
                {a.damage_category && a.damage_category !== "none" && (
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Suspected Category:</span>
                    <span className="font-semibold text-rose-700 uppercase tracking-wide bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {a.damage_category.replace(/_/g, " ")}
                    </span>
                  </div>
                )}

                {a.location_description && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px] mb-0.5">
                      Suspected Location:
                    </span>
                    <p className="text-slate-800 font-medium">{a.location_description}</p>
                  </div>
                )}

                {a.supporting_evidence && (
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px] mb-0.5">
                      Visual Evidence:
                    </span>
                    <p className="text-slate-700 leading-relaxed">{a.supporting_evidence}</p>
                  </div>
                )}

                {/* Alternative Explanations */}
                {a.alternative_explanations && a.alternative_explanations.length > 0 && (
                  <div className="pt-1">
                    <span className="text-amber-800 font-medium block text-[11px] mb-1">
                      Plausible Alternative Explanations:
                    </span>
                    <ul className="text-amber-900/80 list-disc list-inside space-y-0.5 text-[11px]">
                      {a.alternative_explanations.map((alt: string, idx: number) => (
                        <li key={idx}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Similarity Metric & Algorithm Transparency */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Visual Similarity Metric:</span>
                  <span className="font-bold text-slate-900">
                    {Math.round((a.similarity_metric ?? 1.0) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (a.similarity_metric ?? 1.0) < 0.85 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.round((a.similarity_metric ?? 1.0) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Algorithm: {a.similarity_algorithm || "Normalized Grayscale L1 Pixel Difference (PIL/OpenCV)"}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
