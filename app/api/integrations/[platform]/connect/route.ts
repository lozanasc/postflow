import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { buildConnectUrl, generateState, type Platform } from "@/lib/integrations"

const ALLOWED: Platform[] = ["instagram", "tiktok", "youtube", "x"]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL))
  }

  const { platform: rawPlatform } = await params
  const platform = rawPlatform as Platform

  if (!ALLOWED.includes(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 })
  }

  const state = generateState()

  // Store state temporarily in a cookie (simple CSRF protection)
  const cookieName = `oauth_state_${platform}`
  const url = buildConnectUrl(platform, state)

  if (!url) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings/integrations?error=missing_env_${platform}`,
        process.env.NEXT_PUBLIC_APP_URL
      )
    )
  }

  const response = NextResponse.redirect(url)

  response.cookies.set(cookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })

  return response
}
