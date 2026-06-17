/**
 * OAuth helpers for social integrations (Meta/Instagram, TikTok, YouTube).
 *
 * Environment variables required:
 * - META_APP_ID, META_APP_SECRET
 * - TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *
 * Redirect URIs (must be registered in each developer console):
 *   /api/integrations/meta/callback
 *   /api/integrations/tiktok/callback
 *   /api/integrations/youtube/callback
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export type Platform = "instagram" | "tiktok" | "youtube" | "x"

export function getRedirectUri(platform: Platform): string {
  return `${APP_URL}/api/integrations/${platform}/callback`
}

export function buildConnectUrl(platform: Platform, state: string): string | null {
  const redirectUri = getRedirectUri(platform)

  switch (platform) {
    case "instagram": {
      // Meta / Facebook Login (Instagram Graph)
      const appId = process.env.META_APP_ID
      if (!appId) return null

      const scopes = [
        "instagram_basic",
        "instagram_content_publish",
        "pages_read_engagement",
        "pages_show_list",
      ].join(",")

      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        state,
        // Use https://www.facebook.com/v19.0/dialog/oauth for Meta
      })
      return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
    }

    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY
      if (!clientKey) return null

      const scopes = "user.info.basic,video.upload,video.publish"
      const params = new URLSearchParams({
        client_key: clientKey,
        response_type: "code",
        scope: scopes,
        redirect_uri: redirectUri,
        state,
      })
      return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
    }

    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID
      if (!clientId) return null

      const scopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
      ].join(" ")

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        access_type: "offline",
        include_granted_scopes: "true",
        state,
        prompt: "consent", // force refresh token
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    }

    case "x":
      // X (Twitter) v2 OAuth 2.0 with PKCE is more involved.
      // For now return a placeholder — real impl needs PKCE + code_challenge.
      return null

    default:
      return null
  }
}

interface TokenExchangeResult {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  platformUserId: string
  platformUsername: string
  raw?: any
}

export async function exchangeCodeForToken(
  platform: Platform,
  code: string,
  state?: string
): Promise<TokenExchangeResult | null> {
  const redirectUri = getRedirectUri(platform)

  try {
    if (platform === "instagram") {
      const appId = process.env.META_APP_ID!
      const appSecret = process.env.META_APP_SECRET!

      // Exchange short-lived code for short-lived user token
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${appSecret}&code=${code}`

      const tokenRes = await fetch(tokenUrl)
      const tokenData = await tokenRes.json()

      if (!tokenData.access_token) throw new Error("Meta token exchange failed")

      const shortLived = tokenData.access_token

      // Exchange for long-lived token (60 days)
      const longUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLived}`
      const longRes = await fetch(longUrl)
      const longData = await longRes.json()

      const accessToken = longData.access_token || shortLived

      // Fetch Instagram business account(s)
      // For simplicity we fetch /me/accounts then pick first IG account
      const accountsRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
      )
      const accountsData = await accountsRes.json()

      let igAccount: any = null
      for (const page of accountsData?.data || []) {
        if (page.instagram_business_account) {
          igAccount = page.instagram_business_account
          break
        }
      }

      if (!igAccount) {
        // Fallback: try to get the user's IG profile directly
        const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}&fields=id,username`)
        const me = await meRes.json()
        return {
          accessToken,
          refreshToken: undefined,
          expiresIn: 60 * 24 * 3600,
          platformUserId: me.id || "meta_unknown",
          platformUsername: me.username || "instagram_user",
          raw: me,
        }
      }

      // Get username
      const igInfoRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccount.id}?fields=username&access_token=${accessToken}`
      )
      const igInfo = await igInfoRes.json()

      return {
        accessToken,
        expiresIn: 60 * 24 * 3600,
        platformUserId: igAccount.id,
        platformUsername: igInfo.username || igAccount.name || "instagram_user",
        raw: igInfo,
      }
    }

    if (platform === "tiktok") {
      const clientKey = process.env.TIKTOK_CLIENT_KEY!
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET!

      const body = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      })

      const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      })

      const data = await res.json()
      if (!data.access_token) throw new Error(data?.error || "TikTok token exchange failed")

      // Fetch user info
      const userRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      const userData = await userRes.json()
      const user = userData?.data?.user || {}

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        platformUserId: user.open_id || user.union_id || "tiktok_unknown",
        platformUsername: user.display_name || "tiktok_user",
        raw: data,
      }
    }

    if (platform === "youtube") {
      const clientId = process.env.GOOGLE_CLIENT_ID!
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

      const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      })

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      })
      const data = await res.json()

      if (!data.access_token) throw new Error("Google token exchange failed")

      // Get channel info
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${data.access_token}` } }
      )
      const channelData = await channelRes.json()
      const channel = channelData?.items?.[0]

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        platformUserId: channel?.id || "youtube_unknown",
        platformUsername: channel?.snippet?.title || "youtube_channel",
        raw: data,
      }
    }

    return null
  } catch (err) {
    console.error("OAuth exchange error", platform, err)
    return null
  }
}

export function generateState(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  )
}
