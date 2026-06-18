import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { getWasabiPresignedUrl } from "@/lib/wasabi"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const scheduled = await db.scheduledPost.findMany({
    where: { userId: session.user.id },
    orderBy: { scheduledAt: "asc" },
    include: {
      clip: {
        select: {
          id: true,
          wasabiKey: true,
          wasabiUrl: true,
          duration: true,
          viralityScore: true,
          hookText: true,
          layout: true,
          job: { select: { id: true, youtubeUrl: true } },
        },
      },
    },
  })

  const enriched = await Promise.all(
    scheduled.map(async (s) => ({
      ...s,
      clip: s.clip
        ? {
            ...s.clip,
            wasabiUrl: s.clip.wasabiKey
              ? await getWasabiPresignedUrl(s.clip.wasabiKey)
              : s.clip.wasabiUrl,
          }
        : s.clip,
    }))
  )
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { clipId, platform, caption, scheduledAt, socialAccountId } = await req.json()

  if (!clipId) return NextResponse.json({ error: "clipId is required" }, { status: 400 })
  if (!platform) return NextResponse.json({ error: "platform is required" }, { status: 400 })

  // Ensure the clip belongs to the user
  const clip = await db.clip.findFirst({
    where: { id: clipId },
    include: { job: { select: { userId: true } } },
  })
  if (!clip || clip.job.userId !== session.user.id) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 })
  }

  const scheduled = await db.scheduledPost.create({
    data: {
      userId: session.user.id,
      clipId,
      platform,
      caption: caption?.trim() ?? "",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      socialAccountId: socialAccountId || null,
      status: "draft",
    },
    include: {
      clip: {
        select: {
          id: true,
          wasabiUrl: true,
          duration: true,
          viralityScore: true,
          hookText: true,
          layout: true,
          job: { select: { id: true } },
        },
      },
    },
  })

  return NextResponse.json(scheduled, { status: 201 })
}
