"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { XCircleIcon, RefreshCwIcon, ScrollTextIcon } from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Done",
  failed: "Failed",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
}

interface LogEntry {
  ts: string
  step: string
  progress: number
  status: string
  error?: string
}

interface Job {
  id: string
  status: string
  error: string | null
  youtubeUrl: string | null
  wasabiKey: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logs: any
  createdAt: string
  _count: { clips: number }
}

function jobLabel(job: Job): string {
  if (job.youtubeUrl) {
    try {
      const url = new URL(job.youtubeUrl)
      const v = url.searchParams.get("v")
      if (v) return `YouTube · ${v}`
      // youtu.be/ID
      const parts = url.pathname.split("/").filter(Boolean)
      if (parts.length) return `YouTube · ${parts[parts.length - 1]}`
    } catch {}
    return "YouTube video"
  }
  if (job.wasabiKey) {
    const filename = job.wasabiKey.split("/").pop() ?? job.wasabiKey
    // Strip extension for cleanliness
    return filename.replace(/\.[^.]+$/, "") || filename
  }
  return job.id
}

export function JobsTable({ jobs: initialJobs }: { jobs: Job[] }) {
  const router = useRouter()
  const [jobs, setJobs] = useState(initialJobs)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [logsJob, setLogsJob] = useState<Job | null>(null)

  function updateJob(id: string, patch: Partial<Job>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }

  async function handleCancel(e: React.MouseEvent, job: Job) {
    e.preventDefault()
    setLoadingId(job.id)
    await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" })
    updateJob(job.id, { status: "failed", error: "Cancelled by user" })
    setLoadingId(null)
    router.refresh()
  }

  async function handleRetry(e: React.MouseEvent, job: Job) {
    e.preventDefault()
    setLoadingId(job.id)
    const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" })
    if (res.ok) {
      updateJob(job.id, { status: "queued", error: null })
      router.refresh()
    }
    setLoadingId(null)
  }

  function handleLogs(e: React.MouseEvent, job: Job) {
    e.preventDefault()
    setLogsJob(job)
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {jobs.map((job) => {
          const isProcessing = job.status === "queued" || job.status === "running"
          const isFailed = job.status === "failed"
          const busy = loadingId === job.id
          const hasLogs = job.logs && job.logs.length > 0

          return (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}`}
              className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50 overflow-hidden"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {jobLabel(job)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {job._count.clips} clips · {new Date(job.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                {job.error && (
                  <span className="text-xs text-destructive truncate">{job.error}</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasLogs && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleLogs(e, job)}
                    disabled={busy}
                    className="h-7 px-2 text-muted-foreground"
                  >
                    <ScrollTextIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isProcessing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleCancel(e, job)}
                    disabled={busy}
                    className="h-7 px-2"
                  >
                    <XCircleIcon className="mr-1 h-3.5 w-3.5" />
                    {busy ? "..." : "Cancel"}
                  </Button>
                )}
                {isFailed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleRetry(e, job)}
                    disabled={busy}
                    className="h-7 px-2"
                  >
                    <RefreshCwIcon className="mr-1 h-3.5 w-3.5" />
                    {busy ? "..." : "Retry"}
                  </Button>
                )}
                <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"} className="capitalize">
                  {STATUS_LABEL[job.status] ?? job.status}
                </Badge>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Logs sheet */}
      <Sheet open={!!logsJob} onOpenChange={(open) => { if (!open) setLogsJob(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Pipeline Logs</SheetTitle>
            <p className="font-mono text-xs text-muted-foreground truncate">
              {logsJob?.id}
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            {logsJob?.logs && logsJob.logs.length > 0 ? (
              <div className="flex flex-col gap-2">
                {(logsJob.logs as LogEntry[]).map((entry, i) => (
                  <div
                    key={i}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      entry.status === "failed"
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : entry.status === "completed"
                        ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
                        : "bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{entry.step || entry.status}</span>
                      <span className="text-muted-foreground shrink-0">{entry.progress}%</span>
                    </div>
                    {entry.error && (
                      <p className="mt-1 text-destructive">{entry.error}</p>
                    )}
                    <p className="mt-0.5 text-muted-foreground">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No logs available.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
