"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { JobProgress } from "@/components/jobs/job-progress"
import { ClipCard } from "@/components/jobs/clip-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DownloadIcon, XCircleIcon } from "lucide-react"

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
  postcut: {
    wasabi_url?: string
    duration_original?: number
    duration_cut?: number
    time_saved?: number
  } | null
  clips: Clip[]
}

export function JobView({ job: initialJob }: { job: Job }) {
  const router = useRouter()
  const [job, setJob] = useState(initialJob)
  const [clips, setClips] = useState<Clip[]>(initialJob.clips)
  const [cancelling, setCancelling] = useState(false)

  // Called by JobProgress when pipeline completes — refresh job data
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
    // TODO Phase 3 part 2: open schedule sheet
    console.log("Schedule clip", clipId)
  }

  const isProcessing = job.status === "queued" || job.status === "running"

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job</h1>
          <p className="font-mono text-xs text-muted-foreground">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
              <XCircleIcon className="mr-1.5 h-3.5 w-3.5" />
              {cancelling ? "Cancelling..." : "Cancel"}
            </Button>
          )}
          <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"} className="capitalize">
            {job.status}
          </Badge>
        </div>
      </div>

      {/* Error message */}
      {job.status === "failed" && job.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="font-medium">Error: </span>{job.error}
        </div>
      )}

      {/* Progress tracker — shown while processing */}
      {isProcessing && (
        <JobProgress
          jobId={job.id}
          initialProgress={job.progress}
          initialStatus={job.status}
          initialStep={job.step}
          onComplete={handleComplete}
        />
      )}

      {/* Post-cut summary */}
      {job.postcut && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Post-cut video</CardTitle>
            {job.postcut.wasabi_url && (
              <Button variant="outline" size="sm" nativeButton={false} render={<a href={job.postcut.wasabi_url} target="_blank" rel="noopener noreferrer" />}>
                <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                Download
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex gap-6 text-sm text-muted-foreground">
            {job.postcut.duration_original && (
              <span>Original: {Math.round(job.postcut.duration_original / 60)}m</span>
            )}
            {job.postcut.duration_cut && (
              <span>Post-cut: {Math.round(job.postcut.duration_cut / 60)}m</span>
            )}
            {job.postcut.time_saved && (
              <span className="text-green-600 dark:text-green-400">
                Saved: {Math.round(job.postcut.time_saved / 60)}m of dead air
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clip grid */}
      {clips.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Generated clips
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {clips.length} clips
              </span>
            </h2>
            <span className="text-sm text-muted-foreground">
              {clips.filter((c) => c.approved).length} approved
            </span>
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

      {/* Empty state while waiting */}
      {!isProcessing && clips.length === 0 && job.status !== "failed" && (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
          <p className="text-sm">No clips generated yet.</p>
        </div>
      )}
    </div>
  )
}
