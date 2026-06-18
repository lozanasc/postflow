"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { JobProgress } from "@/components/jobs/job-progress"
import { ClipCard } from "@/components/jobs/clip-card"
import { ScheduleSheet, type SchedulableClip } from "@/components/schedule-sheet"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmptyState } from "@/components/empty-state"
import { toast } from "sonner"
import {
  DownloadIcon,
  XCircleIcon,
  ScissorsIcon,
  ClockIcon,
  SparklesIcon,
  CheckCheckIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react"

interface Clip {
  id: string
  wasabiUrl: string
  wasabiKey?: string | null
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
  transcriptJson?: unknown
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
  const [retrying, setRetrying] = useState(false)
  // Lifted playing state for ClipCards (in this view) to guarantee only one video plays at a time
  const [playingClipId, setPlayingClipId] = useState<string | null>(null)

  // Phase 3: Schedule sheet state (single clip from job clips tab)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [clipsToSchedule, setClipsToSchedule] = useState<SchedulableClip[]>([])

  const handleComplete = useCallback(async () => {
    const res = await fetch(`/api/jobs/${initialJob.id}`)
    if (!res.ok) return
    const updated = await res.json()
    setJob(updated)
    setClips(updated.clips ?? [])
    setPlayingClipId(null)
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
    try {
      // Optimistic
      setJob((j) => ({ ...j, status: "failed", error: "Cancelled by user" }))
      setPlayingClipId(null)
      const res = await fetch(`/api/jobs/${initialJob.id}/cancel`, { method: "POST" })
      if (res.ok) {
        toast.success("Job cancelled")
      } else {
        toast.error("Failed to cancel job")
      }
    } finally {
      setCancelling(false)
      router.refresh()
    }
  }

  async function handleRetry() {
    setRetrying(true)
    try {
      // Optimistic reset for retry flow (server also deletes clips + resets)
      setJob((j) => ({ ...j, status: "queued", error: null, progress: 0, step: "" }))
      setClips([])
      setPlayingClipId(null)
      const res = await fetch(`/api/jobs/${initialJob.id}/retry`, { method: "POST" })
      if (res.ok) {
        toast.success("Job retried — queued for processing")
      } else {
        const data = await res.json().catch(() => ({} as any))
        toast.error(data?.error || "Failed to retry job")
      }
    } finally {
      setRetrying(false)
      router.refresh()
    }
  }

  function handleSchedule(clipId: string) {
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return
    const schedClip: SchedulableClip = {
      id: clip.id,
      hookText: clip.hookText,
      duration: clip.duration,
    }
    setClipsToSchedule([schedClip])
    setScheduleOpen(true)
  }

  function handleScheduled(_created: any[]) {
    // No visual change to current clips list required (schedules are separate records)
    // But keep data fresh in case other views use it
    router.refresh()
  }

  const isProcessing = job.status === "queued" || job.status === "running"
  const isFailed = job.status === "failed"
  const approvedCount = clips.filter((c) => c.approved).length

  // Simple transcript excerpt stub (pairs with summary per Phase 2 spec)
  function getTranscriptExcerpt(tj: unknown): string {
    if (!tj) return ""
    try {
      const t: any = tj
      if (Array.isArray(t) && t[0]?.text) {
        const joined = t.slice(0, 6).map((s: any) => (s.text || "").trim()).filter(Boolean).join(" ")
        return joined.slice(0, 260) + (joined.length > 260 ? "…" : "")
      }
      if (t?.segments && Array.isArray(t.segments)) {
        const joined = t.segments.slice(0, 6).map((s: any) => (s.text || "").trim()).filter(Boolean).join(" ")
        return joined.slice(0, 260) + (joined.length > 260 ? "…" : "")
      }
      if (typeof t === "string") return t.slice(0, 260) + (t.length > 260 ? "…" : "")
      if (t?.text) return String(t.text).slice(0, 260) + (String(t.text).length > 260 ? "…" : "")
      return JSON.stringify(t).slice(0, 180) + "…"
    } catch {
      return "Transcript data available."
    }
  }

  // Default tab selection for Phase 2 tabs organization (Progress / Summary / Clips / Post-cut)
  const initialTab = isProcessing
    ? "progress"
    : clips.length > 0
    ? "clips"
    : job.summary || job.transcriptJson
    ? "summary"
    : "progress"

  const showSummaryTab = !!(job.summary || job.transcriptJson)
  const showClipsTab = clips.length > 0
  const showPostcutTab = !!job.postcut?.wasabi_url

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-7xl">

      {/* ── Header using PageHeader (Phase 2: Job detail) ───────────────── */}
      <PageHeader
        title="Job details"
        description="AI clip extraction, transcription &amp; scheduling"
      >
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing && (
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
              <XCircleIcon className="mr-1.5 h-3.5 w-3.5" />
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          {isFailed && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          )}
          <StatusBadge status={job.status} className="capitalize text-xs px-2.5 py-1" />
        </div>
      </PageHeader>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {job.status === "failed" && job.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">Error: </span>{job.error}
        </div>
      )}

      {/* ── Stats row using StatCard primitives (Phase 2) ──────────────── */}
      {(job.postcut || clips.length > 0 || job.summary) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {job.postcut?.duration_original && (
            <StatCard
              title="Original length"
              value={fmt(job.postcut.duration_original)}
              icon={ClockIcon}
            />
          )}
          {job.postcut?.duration_cut && (
            <StatCard
              title="Post-cut"
              value={fmt(job.postcut.duration_cut)}
              icon={ScissorsIcon}
            />
          )}
          {clips.length > 0 && (
            <StatCard
              title="Clips generated"
              value={clips.length}
              icon={SparklesIcon}
            />
          )}
          {clips.length > 0 && (
            <StatCard
              title="Approved"
              value={approvedCount}
              icon={CheckCheckIcon}
            />
          )}
        </div>
      )}

      {/* ── Tabs for Progress / Summary / Clips / Post-cut (Phase 2 polish) */}
      {(isProcessing || showSummaryTab || showClipsTab || showPostcutTab) && (
        <Tabs defaultValue={initialTab}>
          <TabsList>
            {isProcessing && <TabsTrigger value="progress">Progress</TabsTrigger>}
            {showSummaryTab && <TabsTrigger value="summary">Summary</TabsTrigger>}
            {showClipsTab && <TabsTrigger value="clips">Clips{` (${clips.length})`}</TabsTrigger>}
            {showPostcutTab && <TabsTrigger value="postcut">Post-cut</TabsTrigger>}
          </TabsList>

          {/* Progress tab (enhanced JobProgress inside) */}
          {isProcessing && (
            <TabsContent value="progress" className="pt-4">
              <JobProgress
                jobId={job.id}
                initialProgress={job.progress}
                initialStatus={job.status}
                initialStep={job.step}
                onComplete={handleComplete}
              />
            </TabsContent>
          )}

          {/* Summary + transcript preview stub */}
          {showSummaryTab && (
            <TabsContent value="summary" className="pt-4">
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

                    {/* Transcript preview stub (Phase 2) */}
                    {job.transcriptJson != null && (
                      <div className="mt-4 border-t pt-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <FileTextIcon className="h-3.5 w-3.5" />
                          Transcript preview
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground/80 line-clamp-3">
                          “{getTranscriptExcerpt(job.transcriptJson)}”
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {!job.summary && job.transcriptJson != null && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                      Transcript preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground/80">
                      “{getTranscriptExcerpt(job.transcriptJson)}”
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Clips tab with enhanced ClipCard grid */}
          {showClipsTab && (
            <TabsContent value="clips" className="pt-4">
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
                      playingClipId={playingClipId}
                      onPlay={setPlayingClipId}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          )}

          {/* Post-cut tab */}
          {showPostcutTab && (
            <TabsContent value="postcut" className="pt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold">Post-cut video</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={job.postcut!.wasabi_url} target="_blank" rel="noopener noreferrer" />}
                  >
                    <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                    Download
                  </Button>
                </CardHeader>
                {job.postcut!.time_saved && (
                  <CardContent className="pt-0">
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {fmt(job.postcut!.time_saved)} of dead air removed
                    </span>
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* ── Empty state (using primitive where applicable) ─────────────── */}
      {!isProcessing && !showSummaryTab && !showClipsTab && !showPostcutTab && job.status !== "failed" && (
        <EmptyState
          icon={SparklesIcon}
          title="No clips generated yet"
          description="The pipeline results will appear here."
          variant="compact"
        />
      )}

      {/* Phase 3 Scheduling surface (reused from Library) */}
      <ScheduleSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        clips={clipsToSchedule}
        onScheduled={handleScheduled}
      />
    </div>
  )
}
