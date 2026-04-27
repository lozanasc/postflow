import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { ClipCard } from "@/components/jobs/clip-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UploadIcon } from "lucide-react"

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const clips = await db.clip.findMany({
    where: { job: { userId: session.user.id }, approved: true },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { id: true } } },
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-muted-foreground">Your approved clips ready to schedule.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </div>

      {clips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-muted-foreground text-sm">No approved clips yet.</p>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/upload" />}>
            Upload your first video
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {clips.map((clip: typeof clips[0]) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onApprove={() => {}}
              onSchedule={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}
