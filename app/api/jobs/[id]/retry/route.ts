import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const job = await db.job.findFirst({ where: { id, userId: session.user.id } })
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (job.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 })
  }

  if (!job.wasabiKey && !job.youtubeUrl) {
    return NextResponse.json({ error: "No source to retry from" }, { status: 400 })
  }

  const pipelineUrl = process.env.MODAL_PIPELINE_URL
  if (!pipelineUrl) {
    return NextResponse.json({ error: "MODAL_PIPELINE_URL not configured" }, { status: 500 })
  }

  // Delete existing clips and reset the job
  await db.clip.deleteMany({ where: { jobId: id } })
  await db.job.update({
    where: { id },
    data: { status: "queued", progress: 0, step: "", error: null, logs: [] },
  })

  const res = await fetch(`${pipelineUrl}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: job.wasabiKey ?? null,
      youtube_url: job.youtubeUrl ?? null,
      db_job_id: job.id,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/${job.id}`,
    }),
  })

  if (!res.ok) {
    await db.job.update({ where: { id }, data: { status: "failed", error: "Failed to start pipeline" } })
    return NextResponse.json({ error: "Failed to start pipeline" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
