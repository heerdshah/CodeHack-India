"use client"

import React, { useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Camera, Check, UploadCloud, AlertCircle, Info, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"
import toast from "react-hot-toast"

const ANGLES = ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"] as const
type Angle = typeof ANGLES[number]

const ANGLE_INSTRUCTIONS: Record<Angle, string> = {
  FRONT: "Face the main controls, branding, and primary display directly.",
  BACK: "Capture serial number, ventilation ports, and power sockets.",
  LEFT: "Side profile showing casing alignment and left ports.",
  RIGHT: "Side profile showing right accessories and connectors.",
  TOP: "Top-down view of workbed, optics, or top surface.",
  BOTTOM: "Underside feet, mounting brackets, and chassis base.",
}

interface SixAnglePhotoUploadProps {
  bookingId: string
  reportType: "CHECK_IN" | "CHECK_OUT"
  onComplete: () => void
}

export const SixAnglePhotoUpload: React.FC<SixAnglePhotoUploadProps> = ({
  bookingId,
  reportType,
  onComplete,
}) => {
  const [uploads, setUploads] = useState<
    Record<
      Angle,
      { file?: File; preview?: string; uploaded: boolean; uploading: boolean; error?: string }
    >
  >({
    FRONT: { uploaded: false, uploading: false },
    BACK: { uploaded: false, uploading: false },
    LEFT: { uploaded: false, uploading: false },
    RIGHT: { uploaded: false, uploading: false },
    TOP: { uploaded: false, uploading: false },
    BOTTOM: { uploaded: false, uploading: false },
  })
  const [submitting, setSubmitting] = useState(false)

  // Fetch previously uploaded condition photos on mount so uploads persist after refresh
  useEffect(() => {
    let isMounted = true
    async function loadExistingPhotos() {
      try {
        const reports: any[] = await api.get(`/conditions/${bookingId}`)
        const report = reports.find((r: any) => r.report_type === reportType)
        if (report && report.images && report.images.length > 0 && isMounted) {
          setUploads((prev) => {
            const next = { ...prev }
            for (const img of report.images) {
              const ang = img.angle as Angle
              if (next[ang]) {
                next[ang] = {
                  preview: img.url,
                  uploaded: true,
                  uploading: false,
                  error: undefined,
                }
              }
            }
            return next
          })
        }
      } catch (e) {
        // Condition report might not exist yet for this booking
      }
    }
    loadExistingPhotos()
    return () => {
      isMounted = false
    }
  }, [bookingId, reportType])

  const handleFileDrop = async (angle: Angle, files: File[]) => {
    if (!files.length) return
    const file = files[0]
    const preview = URL.createObjectURL(file)

    setUploads((prev) => ({
      ...prev,
      [angle]: { file, preview, uploaded: false, uploading: true, error: undefined },
    }))

    // Upload individual angle to backend via multipart/form-data
    const formData = new FormData()
    formData.append("file", file)
    formData.append("report_type", reportType)
    formData.append("angle", angle)

    try {
      await api.post(`/conditions/${bookingId}/photos`, formData)
      setUploads((prev) => ({
        ...prev,
        [angle]: { file, preview, uploaded: true, uploading: false, error: undefined },
      }))
      toast.success(`${angle} photo verified & uploaded`)
    } catch (err: any) {
      let friendlyError = "Upload failed"
      if (err.message) {
        friendlyError = err.message
      }
      setUploads((prev) => ({
        ...prev,
        [angle]: {
          file,
          preview,
          uploaded: false,
          uploading: false,
          error: friendlyError,
        },
      }))
      toast.error(`Failed to upload ${angle} photo`)
    }
  }

  const uploadedCount = ANGLES.filter((a) => uploads[a].uploaded).length
  const allComplete = uploadedCount === 6
  const progressPct = Math.round((uploadedCount / 6) * 100)

  const handleSubmitReport = async () => {
    if (!allComplete) return
    setSubmitting(true)
    try {
      if (reportType === "CHECK_IN") {
        await api.post(`/conditions/${bookingId}/checkin-complete`)
        toast.success("Check-in condition baseline confirmed! Equipment is in use.")
      } else {
        await api.post(`/conditions/${bookingId}/checkout-complete`)
        toast.success("Check-out condition submitted. Gemini AI inspection initiated!")
      }
      onComplete()
    } catch (err: any) {
      toast.error(err.message || "Failed to complete condition report")
    } finally {
      setSubmitting(false)
    }
  }

  const isCheckIn = reportType === "CHECK_IN"

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600">
            {isCheckIn ? "Check-in Baseline Inspection" : "Check-out Return Inspection"}
          </span>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <Camera className="w-5 h-5 text-blue-600" />
            {isCheckIn ? "Initial 6-Angle Condition Capture" : "Return 6-Angle Condition Capture"}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isCheckIn
              ? "Capture all 6 canonical angles to establish the baseline condition before use."
              : "Capture identical 6 angles to allow AI comparison against your check-in baseline."}
          </p>
        </div>

        {/* Progress Counter Pill */}
        <div className="flex flex-col items-end">
          <div className="text-xs font-bold text-slate-800">
            {uploadedCount} of 6 photos confirmed
          </div>
          <div className="w-36 bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allComplete ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <Alert variant="info">
        Ensure clear lighting and clean optics. Uploads are cryptographically hashed and verified by
        the server before submission.
      </Alert>

      {/* 6-Angle Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ANGLES.map((angle) => {
          const slot = uploads[angle]
          return (
            <AngleDropzone
              key={angle}
              angle={angle}
              instruction={ANGLE_INSTRUCTIONS[angle]}
              slot={slot}
              onDrop={(files) => handleFileDrop(angle, files)}
            />
          )
        })}
      </div>

      {/* Footer and Submit CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          {!allComplete ? (
            <span className="text-amber-600 font-medium">
              Please upload all {6 - uploadedCount} remaining angles to proceed.
            </span>
          ) : (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> All 6 angles verified by server. Ready to submit.
            </span>
          )}
        </div>

        <Button
          onClick={handleSubmitReport}
          disabled={!allComplete || submitting}
          loading={submitting}
          className="w-full sm:w-auto px-6 py-2.5"
        >
          {isCheckIn ? "Confirm & Finalize Check-in" : "Submit Return for AI Inspection"}
        </Button>
      </div>
    </div>
  )
}

function AngleDropzone({
  angle,
  instruction,
  slot,
  onDrop,
}: {
  angle: string
  instruction: string
  slot: {
    preview?: string
    uploaded: boolean
    uploading: boolean
    error?: string
  }
  onDrop: (files: File[]) => void
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxFiles: 1,
    disabled: slot.uploading,
  })

  return (
    <div className="flex flex-col space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-slate-800">{angle}</span>
        {slot.uploaded ? (
          <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Verified
          </span>
        ) : (
          <span className="text-slate-400 text-[11px]">Required</span>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`relative aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center cursor-pointer transition overflow-hidden ${
          slot.uploaded
            ? "border-emerald-500 bg-emerald-50/20"
            : slot.error
            ? "border-rose-400 bg-rose-50/20"
            : isDragActive
            ? "border-blue-500 bg-blue-50/50"
            : "border-slate-200 hover:border-slate-300 bg-slate-50"
        }`}
      >
        <input {...getInputProps()} />

        {slot.preview ? (
          <>
            <img
              src={slot.preview}
              alt={angle}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center">
              {slot.uploaded ? (
                <div className="bg-emerald-600 text-white rounded-full p-2 shadow-md">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
              ) : slot.uploading ? (
                <div className="bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to server...</span>
                </div>
              ) : (
                <span className="bg-rose-600 text-white text-xs px-2.5 py-1 rounded">
                  Retry Upload
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-1.5 flex flex-col items-center">
            <UploadCloud className="w-6 h-6 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">Drop {angle} photo</span>
            <span className="text-[10px] text-slate-400">PNG, JPG, WEBP</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-tight">{instruction}</p>
      {slot.error && <p className="text-[11px] text-rose-600 font-medium">{slot.error}</p>}
    </div>
  )
}
