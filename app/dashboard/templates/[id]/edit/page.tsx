"use client"

import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { TemplateForm } from "@/components/templates/template-form"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"
import type { TemplateConfig } from "@/lib/template-types"

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [initial, setInitial] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/templates")
      if (res.ok) {
        const data = await res.json()
        const all = [...(data.system || []), ...(data.user || [])]
        const found = all.find((t: any) => t.id === id && !t.isSystem)
        if (found) {
          setInitial(found)
        } else {
          router.push("/dashboard/templates")
        }
      }
      setLoading(false)
    }
    if (id) load()
  }, [id, router])

  async function handleSave(data: { name: string; description: string; config: TemplateConfig }) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error("Failed to update template")
      return
    }
    toast.success("Template updated")
    router.push("/dashboard/templates")
  }

  function handleCancel() {
    router.push("/dashboard/templates")
  }

  if (loading || !initial) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <PageHeader title="Edit Template" />
        <div className="text-sm text-muted-foreground">Loading template...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Edit Template"
        description="Edit your custom template. The preview updates live as you change settings."
      >
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/templates" />}>
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
          Back to templates
        </Button>
      </PageHeader>
      <TemplateForm
        initial={initial}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
