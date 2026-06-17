"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { TemplateForm } from "@/components/templates/template-form"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"
import type { TemplateConfig } from "@/lib/template-types"

export default function NewTemplatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const copyFrom = searchParams.get("copyFrom")

  const [initial, setInitial] = useState<any>(null)

  useEffect(() => {
    if (!copyFrom) {
      setInitial(null)
      return
    }
    async function loadCopy() {
      const res = await fetch("/api/templates")
      if (res.ok) {
        const data = await res.json()
        const all = [...(data.system || []), ...(data.user || [])]
        const found = all.find((t: any) => t.id === copyFrom)
        if (found) {
          setInitial({ ...found, name: `${found.name} (copy)`, id: "" })
        }
      }
    }
    loadCopy()
  }, [copyFrom])

  async function handleSave(data: { name: string; description: string; config: TemplateConfig }) {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error("Failed to create template")
      return
    }
    toast.success("Template created")
    router.push("/dashboard/templates")
  }

  function handleCancel() {
    router.push("/dashboard/templates")
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title={copyFrom ? "Duplicate Template" : "New Template"}
        description={
          copyFrom
            ? "Duplicate and customize this template. The preview updates live."
            : "Create a custom template. The preview updates live as you change settings."
        }
      >
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/templates" />}>
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
          Back to templates
        </Button>
      </PageHeader>
      <TemplateForm
        key={initial ? initial.id || "copy" : "new"}
        initial={initial}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
