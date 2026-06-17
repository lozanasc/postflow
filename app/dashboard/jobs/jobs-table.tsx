"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import {
  XCircleIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  VideoIcon,
  SearchIcon,
} from "lucide-react"

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
  progress?: number
  step?: string
}

const TABS = ["all", "running", "completed", "failed"] as const
type Tab = typeof TABS[number]
type SortMode = "newest" | "oldest" | "most-clips" | "fewest-clips"

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
  return "Processing job"
}

export function JobsTable({ jobs: initialJobs }: { jobs: Job[] }) {
  const router = useRouter()
  const [jobs, setJobs] = useState(initialJobs)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [logsJob, setLogsJob] = useState<Job | null>(null)

  // Client filter/sort state (fast, no server roundtrips)
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortMode>("newest")

  // Keep local jobs in sync when server data refreshes (e.g. live updates)
  useEffect(() => {
    setJobs(initialJobs)
  }, [initialJobs])

  // Live status feel: router.refresh on window focus + stub polling when active jobs present
  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [router])

  useEffect(() => {
    const hasActive = jobs.some(
      (j) => j.status === "queued" || j.status === "running"
    )
    if (!hasActive) return

    const t = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(t)
  }, [jobs, router])

  function updateJob(id: string, patch: Partial<Job>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }

  async function handleCancel(e: React.MouseEvent, job: Job) {
    e.preventDefault()
    setLoadingId(job.id)
    try {
      const res = await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" })
      if (!res.ok) throw new Error("cancel failed")
      updateJob(job.id, { status: "failed", error: "Cancelled by user" })
      toast.success("Job cancelled")
    } catch {
      toast.error("Failed to cancel job")
    } finally {
      setLoadingId(null)
      router.refresh()
    }
  }

  async function handleRetry(e: React.MouseEvent, job: Job) {
    e.preventDefault()
    setLoadingId(job.id)
    try {
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" })
      if (res.ok) {
        updateJob(job.id, { status: "queued", error: null })
        toast.success("Retry queued")
        router.refresh()
      } else {
        toast.error("Failed to retry job")
      }
    } catch {
      toast.error("Failed to retry job")
    } finally {
      setLoadingId(null)
    }
  }

  function handleLogs(e: React.MouseEvent, job: Job) {
    e.preventDefault()
    setLogsJob(job)
  }

  // Client-side filtered + sorted list (modern & instant)
  const filteredJobs = useMemo(() => {
    let result = [...jobs]

    // Tab filter (treat queued+running as "running" for UX)
    if (activeTab !== "all") {
      if (activeTab === "running") {
        result = result.filter(
          (j) => j.status === "queued" || j.status === "running"
        )
      } else {
        result = result.filter((j) => j.status === activeTab)
      }
    }

    // Search by label or source
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((j) => {
        const label = jobLabel(j).toLowerCase()
        const source = (j.youtubeUrl || j.wasabiKey || "").toLowerCase()
        return label.includes(q) || source.includes(q)
      })
    }

    // Sort
    result.sort((a, b) => {
      if (sort === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      }
      if (sort === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      }
      const ca = a._count?.clips ?? 0
      const cb = b._count?.clips ?? 0
      if (sort === "most-clips") return cb - ca
      if (sort === "fewest-clips") return ca - cb
      return 0
    })

    return result
  }, [jobs, activeTab, search, sort])

  return (
    <>
      {/* Filter tabs (using Phase 1 Tabs primitive - clean segmented), search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
          className="w-full sm:w-auto"
        >
          <TabsList variant="default" className="w-full sm:w-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
          {/* Client search */}
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs by label or source…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>

          {/* Simple sort (native select for minimal footprint, fast client) */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-8 w-full sm:w-auto rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            aria-label="Sort jobs"
            suppressHydrationWarning
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most-clips">Most clips</option>
            <option value="fewest-clips">Fewest clips</option>
          </select>
        </div>
      </div>

      {/* List or rich EmptyState */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title={
            search.trim()
              ? `No jobs match “${search.trim()}”`
              : activeTab === "all"
              ? "No jobs yet"
              : `No ${activeTab} jobs`
          }
          description={
            search.trim()
              ? "Clear the search or try a different filter."
              : activeTab === "all"
              ? "Upload a video to create your first processing job."
              : "Try switching to a different status filter."
          }
          action={
            !search.trim() && activeTab === "all" ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/upload" />}
              >
                Upload your first video
              </Button>
            ) : undefined
          }
          variant="default"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filteredJobs.map((job) => {
            const isProcessing = job.status === "queued" || job.status === "running"
            const isFailed = job.status === "failed"
            const busy = loadingId === job.id
            const hasLogs = job.logs && job.logs.length > 0

            return (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="group flex flex-col gap-2 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3 overflow-hidden"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1 overflow-hidden">
                  <span className="text-sm font-medium truncate">
                    {jobLabel(job)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {job._count.clips} clips ·{" "}
                    {new Date(job.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {job.error && (
                    <span className="text-xs text-destructive truncate">
                      {job.error}
                    </span>
                  )}

                  {/* Inline progress hint for running/queued (richer rows) */}
                  {isProcessing && typeof job.progress === "number" && job.progress >= 0 && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-1.5 bg-primary transition-all duration-200"
                          style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {job.progress}%
                      </span>
                      {job.step && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {job.step}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions + Status: stack friendly on narrow screens */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0 sm:ml-auto sm:gap-2">
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
                  <StatusBadge status={job.status} className="capitalize" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Logs sheet (unchanged behavior) */}
      <Sheet open={!!logsJob} onOpenChange={(open) => { if (!open) setLogsJob(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Pipeline logs</SheetTitle>
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
