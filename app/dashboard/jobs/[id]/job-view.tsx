"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { JobProgress } from "@/components/jobs/job-progress"
import { ClipCard } from "@/components/jobs/clip-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  DownloadIcon,
  XCircleIcon,
  ScissorsIcon,
  ClockIcon,
  SparklesIcon,
  CheckCheckIcon,
  FileTextIcon,
} from "lucide-react"

interface Clip {
  id: string
  wasabiUrl: string
  duration: number
  viralityScore: number
  hookText: string
  layout: string
  approved: boolean
  start: number
  end: number
}

interface Job {
  id: string
  status: string
  step: string
  progress: number
  error: string | null
  youtubeUrl: string | null
  wasabiKey: string | null
  summary: string | null
  postcut: {
    wasabi_url?: string
    duration_original?: number
    duration_cut?: number
    time_saved?: number
  } | null
  clips: Clip[]
}

function fmt(s: number) {
  const m = Math.round(s / 60)
  return `${m}m`
}

export function JobView({ job: initialJob }: { job: Job }) {
  const router = useRouter()
  const [job, setJob] = useState(initialJob)
  const [clips, setClips] = useState<Clip[]>(initialJob.clips)
  const [cancelling, setCancelling] = useState(false)

  const handleComplete = useCallback(async () => {
    const res = await fetch(`/api/jobs/${initialJob.id}`)
    if (!res.ok) return
    const updated = await res.json()
    setJob(updated)
    setClips(updated.clips ?? [])
  }, [initialJob.id])

  async function handleApprove(clipId: string) {
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return
    const newApproved = !clip.approved
    setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, approved: newApproved } : c))
    await fetch(`/api/clips/${clipId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: newApproved }),
    })
  }

  async function handleCancel() {
    setCancelling(true)
    await fetch(`/api/jobs/${initialJob.id}/cancel`, { method: "POST" })
    router.refresh()
  }

  function handleSchedule(clipId: string) {
    console.log("Schedule clip", clipId)
  }

  const isProcessing = job.status === "queued" || job.status === "running"
  const approvedCount = clips.filter((c) => c.approved).length

  const statusVariant =
    job.status === "completed" ? "default"
    : job.status === "failed" ? "destructive"
    : "secondary"

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Job details</h1>
          <p className="font-mono text-xs text-muted-foreground select-all">{job.id}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing && (
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
              <XCircleIcon className="mr-1.5 h-3.5 w-3.5" />
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          <Badge variant={statusVariant} className="capitalize text-xs px-2.5 py-1">
            {job.status}
          </Badge>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {job.status === "failed" && job.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">Error: </span>{job.error}
        </div>
      )}

      {/* ── Progress ───────────────────────────────────────────────────── */}
      {isProcessing && (
        <JobProgress
          jobId={job.id}
          initialProgress={job.progress}
          initialStatus={job.status}
          initialStep={job.step}
          onComplete={handleComplete}
        />
      )}

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      {(job.postcut || clips.length > 0 || job.summary) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {job.postcut?.duration_original && (
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                Original length
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {fmt(job.postcut.duration_original)}
              </span>
            </div>
          )}
          {job.postcut?.duration_cut && (
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ScissorsIcon className="h-3.5 w-3.5" />
                Post-cut
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {fmt(job.postcut.duration_cut)}
              </span>
            </div>
          )}
          {clips.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <SparklesIcon className="h-3.5 w-3.5" />
                Clips generated
              </span>
              <span className="text-2xl font-semibold tabular-nums">{clips.length}</span>
            </div>
          )}
          {clips.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCheckIcon className="h-3.5 w-3.5" />
                Approved
              </span>
              <span className="text-2xl font-semibold tabular-nums">{approvedCount}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Video summary ───────────────────────────────────────────────── */}
      {job.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileTextIcon className="h-4 w-4 text-muted-foreground" />
              Video summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{job.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              Used by the AI to keep clips on-topic and in context.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Post-cut download ───────────────────────────────────────────── */}
      {job.postcut?.wasabi_url && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Post-cut video</CardTitle>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={job.postcut.wasabi_url} target="_blank" rel="noopener noreferrer" />}
            >
              <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
          </CardHeader>
          {job.postcut.time_saved && (
            <CardContent className="pt-0">
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                {fmt(job.postcut.time_saved)} of dead air removed
              </span>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Clip grid ───────────────────────────────────────────────────── */}
      {clips.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Generated clips</h2>
            {approvedCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {approvedCount} of {clips.length} approved
              </span>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onApprove={handleApprove}
                onSchedule={handleSchedule}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!isProcessing && clips.length === 0 && job.status !== "failed" && (
        <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
          <SparklesIcon className="h-8 w-8 opacity-30" />
          <p className="text-sm">No clips generated yet.</p>
        </div>
      )}
    </div>
  )
}
