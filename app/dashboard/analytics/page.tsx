import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { RefreshCwIcon, UploadIcon } from "lucide-react"
import { AnalyticsDashboard } from "./analytics-dashboard"

// Server action for explicit refresh (revalidates analytics data)
async function refreshAnalytics() {
  "use server"
  revalidatePath("/dashboard/analytics")
}

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const userId = session.user.id

  // Server-side aggregate queries on Clip, Job, ScheduledPost (serialize dates for client)
  // Fetch raw rows needed for time series, distributions, and breakdowns (client does range filtering + chart prep)
  const [clips, jobs, posts] = await Promise.all([
    db.clip.findMany({
      where: { job: { userId } },
      select: {
        id: true,
        createdAt: true,
        viralityScore: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.job.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        postcut: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.scheduledPost.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  // Serialize dates (and keep postcut JSON as-is; Next RSC serializes safely to client)
  const serializedClips = clips.map((c) => ({
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    viralityScore: c.viralityScore,
  }))

  const serializedJobs = jobs.map((j) => ({
    id: j.id,
    createdAt: j.createdAt.toISOString(),
    postcut: j.postcut,
  }))

  const serializedPosts = posts.map((p) => ({
    id: p.id,
    platform: p.platform,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Analytics"
        description="Performance across your clips, virality, scheduling, and time savings."
      >
        <form action={refreshAnalytics} className="contents">
          <Button variant="outline" size="sm" type="submit">
            <RefreshCwIcon className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </form>
        <Button nativeButton={false} render={<a href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </PageHeader>

      {/* Real interactive dashboard with time range controls, StatCard metrics, and recharts.
          All data fetched server-side with aggregates/queries here; client handles range + viz. */}
      <AnalyticsDashboard clips={serializedClips} jobs={serializedJobs} posts={serializedPosts} />
    </div>
  )
}
