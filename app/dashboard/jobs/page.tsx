import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UploadIcon, VideoIcon } from "lucide-react"
import { JobsTable } from "./jobs-table"

const TABS = ["all", "running", "completed", "failed"] as const
type Tab = typeof TABS[number]

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const { status } = await searchParams
  const activeTab: Tab = (TABS.includes(status as Tab) ? status : "all") as Tab

  const where = {
    userId: session.user.id,
    ...(activeTab !== "all" && { status: activeTab }),
  }

  const jobs = await db.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clips: true } } },
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-muted-foreground">All your processing jobs.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={tab === "all" ? "/dashboard/jobs" : `/dashboard/jobs?status=${tab}`}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <VideoIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {activeTab === "all" ? "No jobs yet." : `No ${activeTab} jobs.`}
          </p>
          {activeTab === "all" && (
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/upload" />}>
              Upload your first video
            </Button>
          )}
        </div>
      ) : (
        <JobsTable jobs={jobs.map((j) => ({ ...j, createdAt: j.createdAt.toISOString() }))} />
      )}
    </div>
  )
}
