import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { getWasabiPublicUrl } from "@/lib/wasabi"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let job = await db.job.findFirst({
    where: { id, userId: session.user.id },
    include: { clips: { orderBy: { viralityScore: "desc" } } },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Live status sync from Modal (makes progress visible even if webhooks can't reach localhost in dev)
  const pipelineUrl = process.env.MODAL_PIPELINE_URL
  const isProcessing = job.status === "queued" || job.status === "running"

  function findModalJobId(j: any): string | null {
    if (j.step && /^[0-9a-f-]{8,}$/i.test(j.step)) return j.step
    // Try to recover from logs (in case step was overwritten by a human step name)
    const logs = Array.isArray(j.logs) ? j.logs : []
    for (const entry of logs) {
      const s = (entry && (entry.step || entry.modalJobId || entry.modal_id)) as string | undefined
      if (s && /^[0-9a-f-]{8,}$/i.test(s)) return s
    }
    return null
  }

  const modalJobId = findModalJobId(job)

  if (pipelineUrl && isProcessing && modalJobId) {
    try {
      const liveRes = await fetch(`${pipelineUrl}/status/${modalJobId}`, { cache: "no-store" })
      if (liveRes.ok) {
        const live = await liveRes.json()
        const liveStatus = live.status || "running"
        const updates: any = {}

        if (live.step) updates.step = live.step
        if (typeof live.progress === "number") updates.progress = live.progress
        if (live.error) updates.error = live.error
        if (liveStatus !== job.status) updates.status = liveStatus

        // If Modal reports completed with results, persist them (like the webhook does)
        if (liveStatus === "completed" && live.result) {
          const r = live.result
          if (r.summary) updates.summary = r.summary
          if (r.transcript) updates.transcriptJson = r.transcript
          if (r.postcut) updates.postcut = r.postcut

          if (Array.isArray(r.clips) && r.clips.length) {
            // Persist clips (best-effort)
            try {
              await db.clip.createMany({
                skipDuplicates: true,
                data: r.clips.map((c: any) => ({
                  jobId: id,
                  wasabiKey: c.output_key,
                  wasabiUrl: c.wasabi_url,
                  duration: c.duration,
                  start: c.start,
                  end: c.end,
                  viralityScore: c.virality_score ?? 0,
                  hookText: c.hook_text ?? "",
                  layout: c.layout ?? "single",
                })),
              })
            } catch {}
          }
        }

        if (Object.keys(updates).length > 0) {
          await db.job.update({ where: { id }, data: updates })
          // Refetch so we return fresh data
          job = await db.job.findFirst({
            where: { id, userId: session.user.id },
            include: { clips: { orderBy: { viralityScore: "desc" } } },
          })!
        }
      }
    } catch {
      // Modal status not available yet or network hiccup — ignore, fall back to DB state
    }
  }

  // Ensure clips and postcut always have a usable (stable public) URL.
  // If we have a wasabiKey, prefer (or fall back to) a direct public URL.
  // This protects against expired presigned URLs from before the bucket was made public.
  const currentJob = job!
  const enrichedClips = currentJob.clips.map((clip) => ({
    ...clip,
    wasabiUrl: clip.wasabiKey ? getWasabiPublicUrl(clip.wasabiKey) : clip.wasabiUrl,
  }))

  const enrichedPostcut = currentJob.postcut && typeof currentJob.postcut === "object"
    ? {
        ...(currentJob.postcut as Record<string, unknown>),
        wasabi_url:
          (currentJob.postcut as any)?.output_key
            ? getWasabiPublicUrl((currentJob.postcut as any).output_key)
            : (currentJob.postcut as any)?.wasabi_url,
      }
    : currentJob.postcut

  return NextResponse.json({
    ...currentJob,
    clips: enrichedClips,
    postcut: enrichedPostcut,
  })
}

// Called by the Modal pipeline webhook — must be idempotent
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()

  const job = await db.job.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const incomingStatus: string = body.status ?? "running"
  const isTerminal = (s: string) => s === "completed" || s === "failed"

  // Idempotency: if already in a terminal state and this is another terminal call, no-op
  if (isTerminal(job.status) && isTerminal(incomingStatus)) {
    return NextResponse.json({ ok: true })
  }

  // Append to logs
  const prevLogs = Array.isArray(job.logs) ? (job.logs as object[]) : []
  const newLog: Record<string, unknown> = {
    ts: new Date().toISOString(),
    step: body.step ?? "",
    progress: body.progress ?? 0,
    status: incomingStatus,
  }
  if (body.error) newLog.error = body.error

  await db.job.update({
    where: { id },
    data: {
      status: incomingStatus,
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.step !== undefined && { step: body.step }),
      error: body.error ?? null,
      summary: body.summary ?? undefined,
      transcriptJson: body.transcript ?? undefined,
      postcut: body.postcut ?? undefined,
      logs: [...prevLogs, newLog],
    },
  })

  // Persist rendered clips — skipDuplicates guards against double-delivery
  if (body.clips?.length) {
    await db.clip.createMany({
      skipDuplicates: true,
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
