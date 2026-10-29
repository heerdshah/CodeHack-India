"use client"

import React, { useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Button } from "@/components/ui/Button"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

interface SignatureCaptureProps {
  contractId: string
  onSigned: () => void
}

export const SignatureCapture: React.FC<SignatureCaptureProps> = ({ contractId, onSigned }) => {
  const sigPadRef = useRef<SignatureCanvas | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const handleClear = () => {
    sigPadRef.current?.clear()
    setHasDrawn(false)
  }

  const handleSubmit = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast.error("Please provide your signature before submitting")
      return
    }

    setSubmitting(true)
    const base64Data = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png")

    try {
      await api.post(`/contracts/${contractId}/sign`, {
        signature_image_base64: base64Data,
      })
      toast.success("Signature captured successfully!")
      onSigned()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit signature")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-700">Digital Signature Pad</span>
        <span className="text-[11px] text-gray-500">Sign with mouse, trackpad, or touch</span>
      </div>

      <div className="border border-gray-300 rounded-lg bg-white overflow-hidden shadow-inner">
        <SignatureCanvas
          ref={sigPadRef}
          penColor="#1d4ed8"
          canvasProps={{
            className: "w-full h-36",
          }}
          onBegin={() => setHasDrawn(true)}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleClear} disabled={!hasDrawn || submitting}>
          Clear
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!hasDrawn || submitting} loading={submitting}>
          Submit Signature
        </Button>
      </div>
    </div>
  )
}
