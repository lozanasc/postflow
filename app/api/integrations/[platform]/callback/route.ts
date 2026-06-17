import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { exchangeCodeForToken, type Platform } from "@/lib/integrations"

const ALLOWED: Platform[] = ["instagram", "tiktok", "youtube", "x"]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL))
  }

  const { platform: rawPlatform } = await params
  const platform = rawPlatform as Platform

  if (!ALLOWED.includes(platform)) {
    return NextResponse.redirect(
      new URL("/dashboard/settings/integrations?error=bad_platform", process.env.NEXT_PUBLIC_APP_URL)
    )
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const returnedState = url.searchParams.get("state")

  const cookieName = `oauth_state_${platform}`
  const expectedState = req.cookies.get(cookieName)?.value

  // Basic state validation
  if (error || !code || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings/integrations?error=${error || "oauth_failed"}`,
        process.env.NEXT_PUBLIC_APP_URL
      )
    )
  }

  // Exchange code
  const tokenResult = await exchangeCodeForToken(platform, code)

  if (!tokenResult) {
    return NextResponse.redirect(
      new URL("/dashboard/settings/integrations?error=token_exchange_failed", process.env.NEXT_PUBLIC_APP_URL)
    )
  }

  const { accessToken, refreshToken, expiresIn, platformUserId, platformUsername } = tokenResult

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 60) // fallback ~60 days

  try {
    // Upsert: remove previous for same platform + user + platformUserId if exists, or just create (unique constraint will help)
    // For simplicity, delete existing for this (user, platform) combination first
    await db.socialAccount.deleteMany({
      where: {
        userId: session.user.id,
        platform,
      },
    })

    await db.socialAccount.create({
      data: {
        userId: session.user.id,
        platform,
        platformUserId,
        platformUsername: platformUsername.startsWith("@") ? platformUsername : `@${platformUsername}`,
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt,
      },
    })

    // Clear state cookie
    const response = NextResponse.redirect(
      new URL("/dashboard/settings/integrations?success=connected", process.env.NEXT_PUBLIC_APP_URL)
    )
    response.cookies.delete(cookieName)
    return response
  } catch (e: any) {
    console.error("Failed to save social account", e)
    return NextResponse.redirect(
      new URL("/dashboard/settings/integrations?error=save_failed", process.env.NEXT_PUBLIC_APP_URL)
    )
  }
}
