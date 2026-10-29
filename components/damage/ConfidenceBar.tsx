import React from "react"
import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  score: number // 0.0 to 1.0
  label?: string
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ score, label }) => {
  const pct = Math.round(score * 100)

  let color = "bg-emerald-500"
  let text = "Low Risk / Clean"
  if (score > 0.6) {
    color = "bg-rose-500"
    text = "Damage Detected / Review Required"
  } else if (score >= 0.3) {
    color = "bg-amber-500"
    text = "Minor Anomaly / Inspection Alert"
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="font-medium text-gray-700">{label || "AI Confidence"}</span>
        <span className="text-gray-500 font-mono">
          {pct}% — {text}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
