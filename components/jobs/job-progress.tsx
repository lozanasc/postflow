"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { CheckCircleIcon, CircleIcon, LoaderIcon } from "lucide-react"

const STEPS = [
  "Downloading video",
  "Uploading source video",
  "Extracting audio",
  "Transcribing audio",
  "Removing silence",
  "Extracting highlights",
  "Rendering vertical clips",
  "Finalising post-cut",
  "Saving results",
]

interface JobProgressProps {
  jobId: string
  initialProgress: number
  initialStatus: string
  initialStep: string
  onComplete: () => void
}

export function JobProgress({
  jobId,
  initialProgress,
  initialStatus,
  initialStep,
  onComplete,
}: JobProgressProps) {
  const [progress, setProgress] = useState(initialProgress)
  const [status, setStatus] = useState(initialStatus)
  const [step, setStep] = useState(initialStep)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "completed" || status === "failed") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return
        const job = await res.json()
        // Only update state when values actually change to avoid flicker
        setProgress((p) => job.progress ?? p)
        setStatus((s) => job.status ?? s)
        setStep((s) => job.step ?? s)
        if (job.error) setError(job.error)
        if (job.status === "completed") {
          clearInterval(interval)
          onComplete()
        } else if (job.status === "failed") {
          clearInterval(interval)
        }
      } catch {}
    }, 3000)

    return () => clearInterval(interval)
  }, [jobId, status, onComplete])

  // Better step matching for checklist (maps keywords from pipeline step strings)
  function getCurrentStepIndex(stepStr: string): number {
    const lower = (stepStr || "").toLowerCase()
    const keywordMap: Array<{ keyword: string; index: number }> = [
      { keyword: "download", index: 0 },
      { keyword: "upload", index: 1 },
      { keyword: "audio", index: 2 },
      { keyword: "transcrib", index: 3 },
      { keyword: "silence", index: 4 },
      { keyword: "highlight", index: 5 },
      { keyword: "render", index: 6 },
      { keyword: "post-cut", index: 7 },
      { keyword: "finalis", index: 7 },
      { keyword: "save", index: 8 },
    ]
    for (const { keyword, index } of keywordMap) {
      if (lower.includes(keyword)) return index
    }
    return -1
  }

  const currentIndex = getCurrentStepIndex(step)
  const isActiveProcessing = status === "queued" || status === "running"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Processing pipeline</CardTitle>
        <StatusBadge status={status} className="capitalize" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{step || "Queued..."}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {isActiveProcessing && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span>Live updates • In progress</span>
              <span>ETA feel: {Math.max(1, Math.ceil((100 - Math.max(progress, 5)) / 12))}m remaining</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {STEPS.map((s, stepIndex) => {
            const done = stepIndex < currentIndex || status === "completed"
            const active = stepIndex === currentIndex && isActiveProcessing

            return (
              <div
                key={s}
                className={`flex items-center gap-2 text-sm transition-colors duration-500 ${active ? "bg-muted/40 rounded px-2 py-0.5 -mx-2" : ""}`}
              >
                <span className="transition-all duration-500">
                  {done ? (
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500" />
                  ) : active ? (
                    <LoaderIcon className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <CircleIcon className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                </span>
                <span
                  className={`transition-colors duration-500 ${done || active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s}
                </span>
                {active && (
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.5px] text-primary/70">
                    in progress
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
