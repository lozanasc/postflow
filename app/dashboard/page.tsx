import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { UploadIcon, VideoIcon, CheckCircleIcon, ClockIcon } from "lucide-react"

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

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const [jobs, totalClips, approvedClips] = await Promise.all([
    db.job.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { clips: true } } },
    }),
    db.clip.count({ where: { job: { userId: session.user.id } } }),
    db.clip.count({ where: { job: { userId: session.user.id }, approved: true } }),
  ])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {session.user.name ?? session.user.email}.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <VideoIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{jobs.length}</p>
            <p className="text-xs text-muted-foreground">videos processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clips</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalClips}</p>
            <p className="text-xs text-muted-foreground">clips generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{approvedClips}</p>
            <p className="text-xs text-muted-foreground">ready to publish</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Jobs</h2>
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">No jobs yet. Upload a video to get started.</p>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/upload" />}>
              Upload a video
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map((job: typeof jobs[0]) => (
              <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium truncate max-w-xs">{job.youtubeUrl ?? job.wasabiKey ?? job.id}</span>
                  <span className="text-xs text-muted-foreground">{job._count.clips} clips · {new Date(job.createdAt).toLocaleDateString()}</span>
                </div>
                <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>
                  {STATUS_LABEL[job.status] ?? job.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
