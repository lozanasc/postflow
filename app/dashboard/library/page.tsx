import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LibraryClips } from "./library-clips"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UploadIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { getWasabiPublicUrl } from "@/lib/wasabi"

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Phase 3: fetch ALL clips (no approved: true filter) so Library supports full curation/review/approve + unapprove from here
  const rawClips = await db.clip.findMany({
    where: { job: { userId: session.user.id } },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { id: true } } },
  })

  // Use stable public URL when we have the key (works after bucket is made publicly readable).
  // Falls back to whatever (possibly expired presigned) was stored.
  const clips = rawClips.map((c) => ({
    ...c,
    wasabiUrl: c.wasabiKey ? getWasabiPublicUrl(c.wasabiKey) : c.wasabiUrl,
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Library"
        description="Review, curate, and schedule clips. Use filters, multi-select, and bulk actions."
      >
        <Button nativeButton={false} render={<Link href="/dashboard/upload" />}>
          <UploadIcon className="mr-2 h-4 w-4" />
          New Upload
        </Button>
      </PageHeader>

      <LibraryClips clips={clips} />
    </div>
  )
}
