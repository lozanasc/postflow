import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const job = await db.job.findFirst({
    where: { id, userId: session.user.id },
    include: { clips: { orderBy: { viralityScore: "desc" } } },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(job)
}

// Called by the Modal pipeline webhook when a job completes
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()

  const job = await db.job.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Append to logs
  const prevLogs = Array.isArray(job.logs) ? (job.logs as object[]) : []
  const newLog: Record<string, unknown> = {
    ts: new Date().toISOString(),
    step: body.step ?? "",
    progress: body.progress ?? 0,
    status: body.status ?? "running",
  }
  if (body.error) newLog.error = body.error

  // Persist transcript and postcut
  await db.job.update({
    where: { id },
    data: {
      status: body.status ?? "completed",
      // Don't reset progress on failure — keep last known value
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.step !== undefined && { step: body.step }),
      error: body.error ?? null,
      transcriptJson: body.transcript ?? undefined,
      postcut: body.postcut ?? undefined,
      logs: [...prevLogs, newLog],
    },
  })

  // Persist rendered clips
  if (body.clips?.length) {
    await db.clip.createMany({
      data: body.clips.map((c: {
        output_key: string
        wasabi_url: string
        duration: number
        start: number
        end: number
        virality_score: number
        hook_text: string
        layout: string
      }) => ({
        jobId: id,
        wasabiKey: c.output_key,
        wasabiUrl: c.wasabi_url,
        duration: c.duration,
        start: c.start,
        end: c.end,
        viralityScore: c.virality_score,
        hookText: c.hook_text,
        layout: c.layout,
      })),
    })
  }

  return NextResponse.json({ ok: true })
}
