import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { getWasabiPresignedUrl } from "@/lib/wasabi"

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "20")))
  const search = searchParams.get("search")?.trim() || ""

  const skip = (page - 1) * limit

  const where: any = {
    approved: true,
    job: { userId: session.user.id },
  }

  if (search) {
    where.hookText = {
      contains: search,
      mode: "insensitive",
    }
  }

  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        hookText: true,
        duration: true,
        viralityScore: true,
        layout: true,
        thumbnailKey: true,
        thumbnailUrl: true,
        wasabiKey: true,
        wasabiUrl: true,
        start: true,
        end: true,
        createdAt: true,
      },
    }),
    db.clip.count({ where }),
  ])

  const enriched = await Promise.all(
    clips.map(async (c) => ({
      ...c,
      thumbnailUrl: c.thumbnailKey
        ? await getWasabiPresignedUrl(c.thumbnailKey)
        : c.thumbnailUrl,
      wasabiUrl: c.wasabiKey
        ? await getWasabiPresignedUrl(c.wasabiKey)
        : c.wasabiUrl,
    }))
  )

  return NextResponse.json({
    clips: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
