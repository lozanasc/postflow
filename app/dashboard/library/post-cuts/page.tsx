import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ScissorsIcon, UploadIcon, DownloadIcon } from "lucide-react"
import { getWasabiPublicUrl } from "@/lib/wasabi"

export default async function PostCutsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Fetch jobs with post-cut data (stub data for Phase 3 light enhancement)
  const postcutJobs = await db.job.findMany({
    where: {
      userId: session.user.id,
      postcut: { not: null as any },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      youtubeUrl: true,
      wasabiKey: true,
      postcut: true,
    },
  })

  function formatJobLabel(job: { youtubeUrl: string | null; wasabiKey: string | null; id: string }) {
    if (job.youtubeUrl) {
      try {
        const u = new URL(job.youtubeUrl)
        const v = u.searchParams.get("v")
        if (v) return `YouTube · ${v}`
        const parts = u.pathname.split("/").filter(Boolean)
        if (parts.length) return `YouTube · ${parts[parts.length - 1]}`
      } catch {}
      return "YouTube video"
    }
    if (job.wasabiKey) {
      const filename = job.wasabiKey.split("/").pop() ?? job.wasabiKey
      return filename.replace(/\.[^.]+$/, "") || filename
    }
    return job.id
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Post-Cuts"
        description="Silence-removed full-length videos. (Basic filters stub — full curation in All Clips.)"
      >
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </PageHeader>

      {postcutJobs.length === 0 ? (
        <EmptyState
          icon={ScissorsIcon}
          title="No post-cuts yet"
          description="Process a video upload to generate silence-removed post-cuts."
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/upload" />}>
              Upload your first video
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {postcutJobs.map((job) => {
            const pc: any = job.postcut || {}
            const label = formatJobLabel(job)
            return (
              <div key={job.id} className="rounded-xl border p-4 flex flex-col gap-2 text-sm">
                <div className="font-medium truncate">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleDateString()} · {pc.duration_cut ? `${Math.round(pc.duration_cut)}s cut` : "post-cut ready"}
                </div>
                {(() => {
                  const publicUrl =
                    (pc.output_key && getWasabiPublicUrl(pc.output_key)) ||
                    pc.wasabi_url
                  return publicUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start mt-1"
                      nativeButton={false}
                      render={<a href={publicUrl} target="_blank" rel="noopener noreferrer" />}
                    >
                      <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                      Download post-cut
                    </Button>
                  ) : null
                })()}
                <div className="text-[10px] text-muted-foreground mt-auto">Job: {job.id.slice(0, 8)}…</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
