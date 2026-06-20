import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { CalendarView } from "./calendar-view"
import { getWasabiPresignedUrl } from "@/lib/wasabi"

export default async function CalendarPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const posts = await db.scheduledPost.findMany({
    where: { userId: session.user.id },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    include: {
      clip: {
        select: {
          id: true,
          wasabiKey: true,
          wasabiUrl: true,
          thumbnailKey: true,
          thumbnailUrl: true,
          duration: true,
          viralityScore: true,
          hookText: true,
          layout: true,
          job: { select: { id: true, youtubeUrl: true } },
        },
      },
    },
  })

  // Approved clips ready for scheduling (we allow scheduling even if already scheduled, but prioritize fresh)
  const readyClipsRaw = await db.clip.findMany({
    where: {
      approved: true,
      job: { userId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      hookText: true,
      duration: true,
      thumbnailKey: true,
      thumbnailUrl: true,
      wasabiKey: true,
      wasabiUrl: true,
    },
  })

  // Serialize dates + presigned URLs for both posts and ready clips
  const serializedPosts = await Promise.all(
    posts.map(async (p) => ({
      ...p,
      scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      clip: p.clip
        ? {
            ...p.clip,
            wasabiUrl: p.clip.wasabiKey
              ? await getWasabiPresignedUrl(p.clip.wasabiKey)
              : p.clip.wasabiUrl,
            thumbnailUrl: p.clip.thumbnailKey
              ? await getWasabiPresignedUrl(p.clip.thumbnailKey)
              : p.clip.thumbnailUrl,
          }
        : p.clip,
    }))
  )

  // Note: For the dedicated schedule modal we use paginated /api/clips to avoid loading thousands.
  // Only load a reasonable initial set for the general schedule sheet + side panel.
  const availableClips = await Promise.all(
    readyClipsRaw.slice(0, 50).map(async (c) => ({
      id: c.id,
      hookText: c.hookText || undefined,
      duration: c.duration,
      thumbnailUrl: c.thumbnailKey
        ? await getWasabiPresignedUrl(c.thumbnailKey)
        : c.thumbnailUrl,
    }))
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Calendar"
        description="Full month view of scheduled content. Click days to filter, use Schedule clips to add new posts directly."
      />
      <CalendarView posts={serializedPosts} availableClips={availableClips} />
    </div>
  )
}
