import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { CalendarView } from "./calendar-view"

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
          wasabiUrl: true,
          duration: true,
          viralityScore: true,
          hookText: true,
          layout: true,
          job: { select: { id: true, youtubeUrl: true, wasabiKey: true } },
        },
      },
    },
  })

  // Serialize dates for client component (RSC -> client safe)
  const serialized = posts.map((p) => ({
    ...p,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Calendar"
        description="Schedule and manage your content queue."
      />
      <CalendarView posts={serialized} />
    </div>
  )
}
