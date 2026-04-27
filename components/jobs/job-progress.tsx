"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  const statusColor = {
    queued: "secondary",
    running: "default",
    completed: "default",
    failed: "destructive",
  }[status] as "secondary" | "default" | "destructive"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Processing pipeline</CardTitle>
        <Badge variant={statusColor} className="capitalize">{status}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{step || "Queued..."}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-col gap-2">
          {STEPS.map((s) => {
            const stepIndex = STEPS.indexOf(s)
            const currentIndex = STEPS.findIndex((x) =>
              step.toLowerCase().includes(x.toLowerCase().split(" ")[0])
            )
            const done = stepIndex < currentIndex || status === "completed"
            const active = step.toLowerCase().includes(s.toLowerCase().split(" ")[0])

            return (
              <div key={s} className="flex items-center gap-2 text-sm transition-colors duration-500">
                <span className="transition-all duration-500">
                  {done ? (
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500" />
                  ) : active ? (
                    <LoaderIcon className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <CircleIcon className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                </span>
                <span className={`transition-colors duration-500 ${done || active ? "text-foreground" : "text-muted-foreground"}`}>
                  {s}
                </span>
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
