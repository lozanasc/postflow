import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SparklesIcon, UploadIcon } from "lucide-react"

export default async function BitsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Light data fetch for stub enhancement (all clips as "bits" for now; filters stub)
  const bits = await db.clip.findMany({
    where: { job: { userId: session.user.id } },
    orderBy: { viralityScore: "desc" },
    take: 24,
    select: {
      id: true,
      hookText: true,
      duration: true,
      viralityScore: true,
      layout: true,
      approved: true,
      createdAt: true,
    },
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Short-form Bits"
        description="AI-extracted vertical clips ready to schedule. (Basic filters + list stub; full experience in Library.)"
      >
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </PageHeader>

      {bits.length === 0 ? (
        <EmptyState
          icon={SparklesIcon}
          title="No short-form bits yet"
          description="Clips are generated automatically during video processing."
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/upload" />}>
              Upload your first video
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {/* Basic filter stub (non-interactive for now to avoid new client files) */}
          <div className="text-[10px] text-muted-foreground">Showing top {bits.length} by virality (stub — use Library for full filters/multi-select)</div>
          <div className="divide-y rounded-xl border">
            {bits.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 truncate">
                  {b.hookText ? <span>“{b.hookText}”</span> : <span className="text-muted-foreground">Clip {b.id.slice(0, 8)}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span>{Math.round(b.duration)}s</span>
                  <span>·</span>
                  <span>{b.viralityScore}/10</span>
                  <span>·</span>
                  <span className="capitalize">{b.layout}</span>
                  {b.approved && <span className="rounded bg-primary/10 px-1 text-primary">approved</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
