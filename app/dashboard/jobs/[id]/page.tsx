import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { JobView } from "./job-view"

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  const job = await db.job.findFirst({
    where: { id, userId: session.user.id },
    include: { clips: { orderBy: { viralityScore: "desc" } } },
  })
  if (!job) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <JobView job={job as any} />
}
