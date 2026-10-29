"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { SignatureCapture } from "./SignatureCapture"
import { useAuth } from "@/hooks/useAuth"
import { FileText, CheckCircle2, Copy, Download, Loader2 } from "lucide-react"
import toast from "react-hot-toast"

interface ContractViewerProps {
  bookingId: string
  onRefetchBooking?: () => void
}

export const ContractViewer: React.FC<ContractViewerProps> = ({ bookingId, onRefetchBooking }) => {
  const { user } = useAuth()
  const [downloading, setDownloading] = useState(false)

  const { data: contract, isLoading, refetch } = useQuery<any>({
    queryKey: ["contract", bookingId],
    queryFn: () => api.get(`/contracts/${bookingId}`),
  })

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true)
      const token = typeof window !== "undefined" ? localStorage.getItem("availo_token") : null
      const res = await fetch(`http://localhost:8000/api/v1/contracts/${bookingId}/pdf`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        throw new Error("Failed to download PDF agreement")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Availo_Agreement_${bookingId.slice(0, 8)}_v1.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Booking Agreement PDF downloaded successfully")
    } catch (err: any) {
      toast.error(err.message || "Failed to download agreement PDF")
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-gray-500">Retrieving official booking agreement...</div>
  }

  if (!contract) {
    return <div className="p-4 text-center text-sm text-gray-500">No agreement found for this reservation.</div>
  }

  const signatures = contract.signatures || []
  const hasUserSigned = signatures.some((s: any) => s.user_id === user?.id)
  const isFullySigned = contract.status === "SIGNED"

  const handleCopyHash = () => {
    if (contract.sha256_hash) {
      navigator.clipboard.writeText(contract.sha256_hash)
      toast.success("SHA-256 hash copied to clipboard")
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-bold text-gray-900 text-base">Resource Sharing Agreement</h3>
            <p className="text-xs text-slate-500">Cryptographically verified institutional loan agreement</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-blue-600" />}
            Download Agreement PDF
          </button>

          {isFullySigned ? (
            <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fully Executed
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold">
              Awaiting Signatures
            </span>
          )}
        </div>
      </div>

      {/* Contract HTML Preview */}
      <div
        className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed prose max-w-none"
        dangerouslySetInnerHTML={{ __html: contract.content_html }}
      />

      {/* SHA256 & Cryptographic Proof */}
      <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between text-xs">
        <div className="truncate mr-2">
          <span className="font-semibold text-gray-700">Document SHA-256: </span>
          <span className="font-mono text-gray-600">{contract.sha256_hash || "Generating..."}</span>
        </div>
        <button
          onClick={handleCopyHash}
          className="p-1 hover:bg-gray-200 rounded text-gray-600 transition shrink-0"
          title="Copy Hash"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>

      {/* Signature Status */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 border border-gray-200 rounded-lg">
          <span className="text-gray-500 block">User Signature</span>
          <span className="font-semibold text-gray-800">
            {signatures.some((s: any) => s.role_in_contract === "USER") ? "Signed ✓" : "Pending Signature"}
          </span>
        </div>
        <div className="p-3 border border-gray-200 rounded-lg">
          <span className="text-gray-500 block">Owner Signature</span>
          <span className="font-semibold text-gray-800">
            {signatures.some((s: any) => s.role_in_contract === "OWNER") ? "Signed ✓" : "Pending Signature"}
          </span>
        </div>
      </div>

      {/* Signature Capture Pad if user has not yet signed */}
      {!hasUserSigned && contract.status !== "SIGNED" && (
        <SignatureCapture
          contractId={contract.id}
          onSigned={() => {
            refetch()
            onRefetchBooking?.()
          }}
        />
      )}
    </div>
  )
}
