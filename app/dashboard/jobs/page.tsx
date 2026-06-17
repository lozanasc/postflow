import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UploadIcon } from "lucide-react"
import { JobsTable } from "./jobs-table"
import { PageHeader } from "@/components/page-header"

export default async function JobsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const jobs = await db.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clips: true } } },
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PageHeader
        title="Jobs"
        description="All your processing jobs."
      >
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </PageHeader>

      <JobsTable jobs={jobs.map((j: typeof jobs[number]) => ({ ...j, createdAt: j.createdAt.toISOString() }))} />
    </div>
  )
}
