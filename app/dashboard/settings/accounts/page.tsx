import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Share2Icon, VideoIcon, AtSignIcon, PlugIcon } from "lucide-react"

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram / TikTok",
    description: "Post Reels and TikTok videos directly from your library.",
    icon: Share2Icon,
    available: false,
  },
  {
    id: "youtube",
    name: "YouTube Shorts",
    description: "Publish Shorts to your YouTube channel.",
    icon: VideoIcon,
    available: false,
  },
  {
    id: "x",
    name: "X (Twitter)",
    description: "Post short-form video clips to X.",
    icon: AtSignIcon,
    available: false,
  },
]

export default function ConnectedAccountsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div>
        <h1 className="text-2xl font-semibold">Connected Accounts</h1>
        <p className="text-muted-foreground">Connect your social platforms to enable one-click publishing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Card key={platform.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <platform.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm">{platform.name}</CardTitle>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">Coming soon</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <CardDescription className="text-xs">{platform.description}</CardDescription>
              <Button variant="outline" size="sm" disabled>
                <PlugIcon className="mr-2 h-3.5 w-3.5" />
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Social platform integrations are in development. Each platform requires app approval from the respective API team. You&apos;ll be notified when each integration goes live.
      </p>
    </div>
  )
}
