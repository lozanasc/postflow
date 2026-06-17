import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

const VALID_PLATFORMS = ["instagram", "tiktok", "youtube", "x"] as const
type Platform = (typeof VALID_PLATFORMS)[number]

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accounts = await db.socialAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    // include count of scheduled for future use if needed
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform, platformUsername, platformUserId: providedUserId } = body as {
    platform?: string
    platformUsername?: string
    platformUserId?: string
  }

  if (!platform || !VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: "Valid platform is required (instagram, tiktok, youtube, x)" }, { status: 400 })
  }
  if (!platformUsername?.trim()) {
    return NextResponse.json({ error: "platformUsername is required" }, { status: 400 })
  }

  const username = platformUsername.trim()
  const userIdForPlatform = providedUserId?.trim() || `${platform}_${username.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`

  // Mock tokens (real OAuth flow later)
  const mockAccess = `mock_access_${platform}_${Date.now().toString(36)}`
  const mockRefresh = `mock_refresh_${Date.now().toString(36)}`

  try {
    const account = await db.socialAccount.create({
      data: {
        userId: session.user.id,
        platform,
        platformUserId: userIdForPlatform,
        platformUsername: username.startsWith("@") ? username : `@${username}`,
        accessToken: mockAccess,
        refreshToken: mockRefresh,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60), // ~60d mock
      },
    })
    return NextResponse.json(account, { status: 201 })
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Account for this platform + user already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id } = body as { id?: string }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const existing = await db.socialAccount.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Social account not found" }, { status: 404 })
  }

  await db.socialAccount.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
