import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import {
  UploadIcon,
  VideoIcon,
  CheckCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  LayersIcon,
  PlayIcon,
  ArrowRightIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"

// Server action for explicit refresh (revalidates dashboard data on demand)
async function refreshDashboard() {
  "use server"
  revalidatePath("/dashboard")
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const userId = session.user.id

  const [totalJobs, activeJobs, recentJobs, totalClips, approvedClips, recentApproved] =
    await Promise.all([
      db.job.count({ where: { userId } }),
      db.job.findMany({
        where: { userId, status: { in: ["queued", "running"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { clips: true } } },
      }),
      db.job.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { clips: true } } },
      }),
      db.clip.count({ where: { job: { userId } } }),
      db.clip.count({ where: { job: { userId }, approved: true } }),
      db.clip.findMany({
        where: { approved: true, job: { userId } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          job: { select: { id: true, youtubeUrl: true, wasabiKey: true } },
        },
      }),
    ])

  function formatJobLabel(job: { youtubeUrl: string | null; wasabiKey: string | null; id: string }) {
    if (job.youtubeUrl) {
      try {
        const u = new URL(job.youtubeUrl)
        const v = u.searchParams.get("v")
        if (v) return `YouTube · ${v}`
        const parts = u.pathname.split("/").filter(Boolean)
        if (parts.length) return `YouTube · ${parts[parts.length - 1]}`
      } catch {}
      return "YouTube video"
    }
    if (job.wasabiKey) {
      const filename = job.wasabiKey.split("/").pop() ?? job.wasabiKey
      return filename.replace(/\.[^.]+$/, "") || filename
    }
    return job.id
  }

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? session.user.email}.`}
      >
        <form action={refreshDashboard} className="contents">
          <Button variant="outline" size="sm" type="submit">
            <RefreshCwIcon className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </form>
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </PageHeader>

      {/* Stats — using accurate server counts */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Jobs"
          value={totalJobs}
          icon={VideoIcon}
          description="videos processed"
        />
        <StatCard
          title="Total Clips"
          value={totalClips}
          icon={ClockIcon}
          description="clips generated"
        />
        <StatCard
          title="Approved"
          value={approvedClips}
          icon={CheckCircleIcon}
          description="ready to publish"
        />
      </div>

      {/* Quick-start CTAs (prominent, minimalist cards) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/upload"
          className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/60 hover:bg-accent/30"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UploadIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Upload new video</div>
            <div className="text-xs text-muted-foreground">File or YouTube link</div>
          </div>
          <ArrowRightIcon className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/dashboard/jobs"
          className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/60 hover:bg-accent/30"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayersIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">View all jobs</div>
            <div className="text-xs text-muted-foreground">Track progress &amp; logs</div>
          </div>
          <ArrowRightIcon className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/dashboard/templates"
          className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/60 hover:bg-accent/30"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PlayIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Manage templates</div>
            <div className="text-xs text-muted-foreground">Aspect ratios, styles</div>
          </div>
          <ArrowRightIcon className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Live / Recent activity — running jobs with StatusBadge + quick links */}
      {activeJobs.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Live activity</h2>
            <span className="text-xs text-muted-foreground">{activeJobs.length} running</span>
          </div>
          <div className="flex flex-col gap-2">
            {activeJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {formatJobLabel(job)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {job._count.clips} clips · {formatDate(job.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={job.status} />
                  <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Jobs — polished with StatusBadge, alive formatting, explicit refresh via header action */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent jobs</h2>
          <Link
            href="/dashboard/jobs"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View all <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <EmptyState
            icon={VideoIcon}
            title="No jobs yet"
            description="Upload a video to get started."
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/upload" />}
              >
                Upload a video
              </Button>
            }
            variant="default"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {formatJobLabel(job)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {job._count.clips} clips · {formatDate(job.createdAt)}
                  </span>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Small preview of recently approved clips (lightweight server cards, link to job) */}
      {recentApproved.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recently approved</h2>
            <Link
              href="/dashboard/library"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View library <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentApproved.map((clip) => {
              const mins = Math.floor(clip.duration / 60)
              const secs = Math.round(clip.duration % 60)
              const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
              const label = clip.job
                ? formatJobLabel({ id: clip.job.id, youtubeUrl: clip.job.youtubeUrl, wasabiKey: clip.job.wasabiKey })
                : "Job"
              return (
                <Link
                  key={clip.id}
                  href={`/dashboard/jobs/${clip.job?.id ?? ""}`}
                  className="group flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 font-medium leading-snug text-foreground">
                      {clip.hookText || "Approved clip"}
                    </span>
                    <span className="shrink-0 rounded bg-green-100 px-1.5 py-px text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {clip.viralityScore}/10
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{dur} · {label}</span>
                    <span className="text-primary/70 group-hover:text-primary transition-colors">Open →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
