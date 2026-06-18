import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { LibraryClips } from "./library-clips"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UploadIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { getWasabiPresignedUrl } from "@/lib/wasabi"

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Phase 3: fetch ALL clips ... include wasabiKey so we can generate fresh presigned on click
  const rawClips = await db.clip.findMany({
    where: { job: { userId: session.user.id } },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { id: true } } },
  })

  // Always serve fresh presigned GET URLs (Wasabi account does not allow public object access).
  const clips = await Promise.all(
    rawClips.map(async (c) => ({
      ...c,
      wasabiKey: c.wasabiKey, // ensure passed to clip card for on-demand presign
      wasabiUrl: c.wasabiKey ? await getWasabiPresignedUrl(c.wasabiKey) : c.wasabiUrl,
    }))
  )

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
