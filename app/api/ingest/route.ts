import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { wasabiKey, youtubeUrl, language } = await req.json()
  if (!wasabiKey && !youtubeUrl) {
    return NextResponse.json({ error: "wasabiKey or youtubeUrl required" }, { status: 400 })
  }

  // Create a job record in the DB
  const job = await db.job.create({
    data: {
      userId: session.user.id,
      status: "queued",
      wasabiKey: wasabiKey ?? null,
      youtubeUrl: youtubeUrl ?? null,
    },
  })

  // Trigger Modal pipeline asynchronously
  const pipelineUrl = process.env.MODAL_PIPELINE_URL
  if (!pipelineUrl) {
    return NextResponse.json({ error: "MODAL_PIPELINE_URL not configured" }, { status: 500 })
  }

  const res = await fetch(`${pipelineUrl}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: wasabiKey ?? null,
      youtube_url: youtubeUrl ?? null,
      language: language ?? null,
      db_job_id: job.id,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/${job.id}`,
    }),
  })

  if (!res.ok) {
    await db.job.update({ where: { id: job.id }, data: { status: "failed", error: "Failed to start pipeline" } })
    return NextResponse.json({ error: "Failed to start pipeline" }, { status: 502 })
  }

  const { job_id: modalJobId } = await res.json()

  // Store Modal job_id for WebSocket polling
  await db.job.update({
    where: { id: job.id },
    data: { step: modalJobId },
  })

  return NextResponse.json({ jobId: job.id, modalJobId })
}
