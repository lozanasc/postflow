import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SYSTEM_TEMPLATES } from "@/lib/template-types"
import { TemplateManager } from "@/components/templates/template-manager"
import { PageHeader } from "@/components/page-header"

export default async function TemplatesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const userTemplates = await db.clipTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  const serialised = userTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isSystem: false,
    userId: t.userId,
    config: t.config,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Templates"
        description="Define how your clips look — subtitles, layout, aspect ratio, and more."
      />
      <TemplateManager systemTemplates={SYSTEM_TEMPLATES} initialUserTemplates={serialised} />
    </div>
  )
}
