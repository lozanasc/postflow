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

  // After successful trigger we don't get the modal uuid back here in retry (unlike ingest),
  // but the first webhook / live status will populate it. We still reset logs above.

  if (!res.ok) {
    let details = "No response body"
    try {
      details = await res.text()
    } catch {}
    console.error("Modal pipeline /ingest (retry) failed:", res.status, details)

    let userMessage = "Failed to start pipeline"
    if (details.includes("invalid function call")) {
      userMessage = "Failed to start pipeline (Modal deployment issue — run `python -m modal deploy pipeline/pipeline.py` and update the URL in .env.local)"
    }

    await db.job.update({ where: { id }, data: { status: "failed", error: userMessage } })
    return NextResponse.json({ error: userMessage, details }, { status: 502 })
  }

  const { job_id: modalJobId } = await res.json().catch(() => ({} as any))
  if (modalJobId) {
    await db.job.update({
      where: { id },
      data: {
        step: modalJobId,
        logs: [{ ts: new Date().toISOString(), step: modalJobId, modalJobId }],
      },
    })
  }

  return NextResponse.json({ ok: true })
}
