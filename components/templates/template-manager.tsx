"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { PlusIcon, PencilIcon, TrashIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import type { ClipTemplate, TemplateConfig } from "@/lib/template-types"

interface TemplateManagerProps {
  systemTemplates: ClipTemplate[]
  initialUserTemplates: ClipTemplate[]
}

function configSummary(config: TemplateConfig) {
  const parts: string[] = [config.aspectRatio, config.layout]
  if (config.subtitles.enabled) parts.push(`${config.subtitles.style} subs`)
  else parts.push("no subs")
  if (config.watermark.enabled) parts.push("watermark")
  return parts.join(" · ")
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: ClipTemplate
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}) {
  const cfg = template.config as TemplateConfig
  const ar = cfg.aspectRatio
  const miniStyle: React.CSSProperties =
    ar === "9:16"
      ? { width: 14, height: 24, aspectRatio: "9/16" }
      : ar === "1:1"
      ? { width: 20, height: 20, aspectRatio: "1/1" }
      : { width: 26, height: 15, aspectRatio: "16/9" }

  return (
    <Card className="flex flex-col transition-all hover:shadow-sm hover:border-primary/30 group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mini aspect preview indicator (polish) */}
            <div
              className="shrink-0 rounded border border-muted-foreground/30 bg-muted/50"
              style={miniStyle}
              aria-hidden
            />
            <CardTitle className="text-sm leading-snug truncate">{template.name}</CardTitle>
          </div>
          {template.isSystem && (
            <Badge variant="secondary" className="shrink-0 text-xs">Built-in</Badge>
          )}
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{template.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-[10px] text-muted-foreground font-mono tracking-tight">{configSummary(cfg)}</p>
        <div className="flex gap-1.5">
          {template.isSystem ? (
            <Button size="sm" variant="outline" className="flex-1 text-xs group-hover:border-primary/50" onClick={onDuplicate}>
              <CopyIcon className="mr-1.5 h-3 w-3" />
              Duplicate
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1 text-xs group-hover:border-primary/50" onClick={onEdit}>
                <PencilIcon className="mr-1.5 h-3 w-3" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="text-xs hover:border-primary/50" onClick={onDuplicate} title="Duplicate">
                <CopyIcon className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="text-xs text-destructive hover:text-destructive hover:border-destructive/60" onClick={onDelete} title="Delete">
                <TrashIcon className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function TemplateManager({ systemTemplates, initialUserTemplates }: TemplateManagerProps) {
  const router = useRouter()
  const [userTemplates, setUserTemplates] = useState<ClipTemplate[]>(initialUserTemplates)

  function openEdit(tpl: ClipTemplate) {
    router.push(`/dashboard/templates/${tpl.id}/edit`)
  }

  function openDuplicate(tpl: ClipTemplate) {
    router.push(`/dashboard/templates/new?copyFrom=${tpl.id}`)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" })
    if (res.ok) {
      setUserTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Template deleted")
    } else {
      toast.error("Failed to delete template")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        {/* User templates */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">My Templates</h2>
              <p className="text-sm text-muted-foreground">Custom templates you&apos;ve created.</p>
            </div>
            <Button size="sm" nativeButton={false} render={<Link href="/dashboard/templates/new" />}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Template
            </Button>
          </div>

          {userTemplates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">No custom templates yet.</p>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/templates/new" />}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Create your first template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {userTemplates.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  onEdit={() => openEdit(tpl)}
                  onDelete={() => handleDelete(tpl.id)}
                  onDuplicate={() => openDuplicate(tpl)}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* System templates */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Built-in Templates</h2>
            <p className="text-sm text-muted-foreground">
              Ready-made presets. Duplicate any to customise it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {systemTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onDuplicate={() => openDuplicate(tpl)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
