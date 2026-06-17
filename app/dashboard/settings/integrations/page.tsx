"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import {
  Share2Icon,
  VideoIcon,
  AtSignIcon,
  PlugIcon,
  CheckCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { toast } from "sonner"

type SocialAccount = {
  id: string
  platform: string
  platformUsername: string
  platformUserId: string
  createdAt: string
  expiresAt?: string | null
}

type PlatformDef = {
  id: "instagram" | "tiktok" | "youtube" | "x"
  name: string
  description: string
  scopes: string
  docs: string
  icon: React.ComponentType<{ className?: string }>
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Publish Reels & carousels via the Instagram Graph API.",
    scopes: "instagram_basic, instagram_content_publish, pages_read_engagement",
    docs: "https://developers.facebook.com/docs/instagram-api",
    icon: Share2Icon,
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Upload and publish videos using TikTok Content Posting API.",
    scopes: "user.info.basic, video.upload, video.publish",
    docs: "https://developers.tiktok.com/doc/login-kit-web",
    icon: VideoIcon,
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Upload Shorts and manage videos on your YouTube channel.",
    scopes: "youtube.upload, youtube.readonly",
    docs: "https://developers.google.com/youtube/v3",
    icon: VideoIcon,
  },
  {
    id: "x",
    name: "X (Twitter)",
    description: "Post video clips directly to X (requires elevated API access).",
    scopes: "tweet.read, tweet.write, users.read, media.upload",
    docs: "https://developer.x.com/en/docs/twitter-api",
    icon: AtSignIcon,
  },
]

export default function IntegrationsPage() {
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([])
  const [loading, setLoading] = React.useState(true)
  const [connecting, setConnecting] = React.useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null)

  async function loadAccounts() {
    setLoading(true)
    try {
      const res = await fetch("/api/social-accounts")
      if (!res.ok) throw new Error("Failed to load accounts")
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load connected accounts")
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadAccounts()
  }, [])

  const accountsByPlatform = React.useMemo(() => {
    const map: Record<string, SocialAccount[]> = {}
    for (const acc of accounts) {
      if (!map[acc.platform]) map[acc.platform] = []
      map[acc.platform].push(acc)
    }
    return map
  }, [accounts])

  function startOAuth(platformId: string) {
    setConnecting(platformId)
    // Redirect to our OAuth connect route
    window.location.href = `/api/integrations/${platformId}/connect`
  }

  async function handleDisconnect(id: string, platformUsername: string, platform: string) {
    setDisconnectingId(id)
    try {
      const res = await fetch("/api/social-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to disconnect")
      }
      toast.success(`Disconnected ${platformUsername}`)
      await loadAccounts()
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect account")
    } finally {
      setDisconnectingId(null)
    }
  }

  async function handleReconnect(platformId: string) {
    // Simply start a new OAuth flow (existing record will be replaced on callback or user can disconnect first)
    startOAuth(platformId)
  }

  const connectedCount = accounts.length

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Integrations"
        description="Connect your social accounts with real OAuth to enable direct publishing from Postflow."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORMS.map((platform) => {
          const connected = accountsByPlatform[platform.id] || []
          const Icon = platform.icon
          const isConnectingThis = connecting === platform.id

          return (
            <Card key={platform.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{platform.name}</CardTitle>
                  </div>
                </div>
                {connected.length > 0 ? (
                  <Badge variant="default" className="shrink-0 bg-emerald-600 text-white dark:bg-emerald-500 text-[10px]">
                    <CheckCircleIcon className="mr-1 h-3 w-3" />
                    {connected.length}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-xs">Not connected</Badge>
                )}
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                <CardDescription className="text-xs leading-snug">{platform.description}</CardDescription>

                {connected.length > 0 && (
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-2">
                    {connected.map((acc) => {
                      const isExpiringSoon =
                        acc.expiresAt && new Date(acc.expiresAt).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7

                      return (
                        <div key={acc.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{acc.platformUsername}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              Connected {new Date(acc.createdAt).toLocaleDateString()}
                              {isExpiringSoon && <span className="text-amber-600">· token expiring soon</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 px-2"
                              onClick={() => handleReconnect(platform.id)}
                            >
                              <RefreshCwIcon className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 px-2 text-destructive hover:bg-destructive/10"
                              disabled={disconnectingId === acc.id}
                              onClick={() => handleDisconnect(acc.id, acc.platformUsername, platform.id)}
                            >
                              {disconnectingId === acc.id ? <Loader2Icon className="h-3 w-3 animate-spin" /> : "Disconnect"}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-auto pt-2">
                  {connected.length === 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isConnectingThis}
                      onClick={() => startOAuth(platform.id)}
                    >
                      <PlugIcon className="mr-2 h-3.5 w-3.5" />
                      {isConnectingThis ? "Redirecting..." : `Connect ${platform.name}`}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => startOAuth(platform.id)}
                    >
                      <RefreshCwIcon className="mr-2 h-3.5 w-3.5" />
                      Reconnect / Add account
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Scopes: {platform.scopes.split(",").slice(0, 2).join(", ")}…</span>
                  <a
                    href={platform.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center hover:text-foreground"
                  >
                    Docs <ExternalLinkIcon className="ml-1 h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground">How OAuth works here</div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Clicking Connect takes you to the platform’s official login.</li>
          <li>After you authorize, we receive an access + refresh token and store them securely.</li>
          <li>Tokens are used only to publish content you explicitly schedule.</li>
          <li>You can disconnect or reconnect at any time.</li>
        </ul>
        <div className="pt-1 text-[10px]">
          Make sure you have configured the corresponding environment variables (META_APP_ID, TIKTOK_CLIENT_KEY, GOOGLE_CLIENT_ID, etc) and added the correct redirect URI in each developer console.
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {loading ? "Loading..." : `${connectedCount} connected account${connectedCount === 1 ? "" : "s"}`}
      </div>
    </div>
  )
}
