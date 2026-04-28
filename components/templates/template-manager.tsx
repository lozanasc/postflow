"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { PlusIcon, PencilIcon, TrashIcon, CopyIcon } from "lucide-react"
import { TemplateForm } from "./template-form"
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
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug">{template.name}</CardTitle>
          {template.isSystem && (
            <Badge variant="secondary" className="shrink-0 text-xs">Built-in</Badge>
          )}
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground leading-snug">{template.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-xs text-muted-foreground font-mono">{configSummary(template.config as TemplateConfig)}</p>
        <div className="flex gap-1.5">
          {template.isSystem ? (
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onDuplicate}>
              <CopyIcon className="mr-1.5 h-3 w-3" />
              Duplicate
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onEdit}>
                <PencilIcon className="mr-1.5 h-3 w-3" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={onDuplicate}>
                <CopyIcon className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="text-xs text-destructive hover:text-destructive" onClick={onDelete}>
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
  const [userTemplates, setUserTemplates] = useState<ClipTemplate[]>(initialUserTemplates)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ClipTemplate | null>(null)
  const [duplicateBase, setDuplicateBase] = useState<ClipTemplate | null>(null)

  function openNew() {
    setEditing(null)
    setDuplicateBase(null)
    setSheetOpen(true)
  }

  function openEdit(tpl: ClipTemplate) {
    setEditing(tpl)
    setDuplicateBase(null)
    setSheetOpen(true)
  }

  function openDuplicate(tpl: ClipTemplate) {
    setEditing(null)
    setDuplicateBase(tpl)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(null)
    setDuplicateBase(null)
  }

  async function handleSave(data: { name: string; description: string; config: TemplateConfig }) {
    if (editing) {
      const res = await fetch(`/api/templates/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) return
      const updated = await res.json()
      setUserTemplates((prev) => prev.map((t) => (t.id === updated.id ? { ...updated, isSystem: false } : t)))
    } else {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) return
      const created = await res.json()
      setUserTemplates((prev) => [...prev, { ...created, isSystem: false }])
    }
    closeSheet()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" })
    if (res.ok) setUserTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  const sheetInitial = editing ?? (duplicateBase ? { ...duplicateBase, name: `${duplicateBase.name} (copy)`, id: "" } : null)

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
            <Button size="sm" onClick={openNew}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Template
            </Button>
          </div>

          {userTemplates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">No custom templates yet.</p>
              <Button size="sm" variant="outline" onClick={openNew}>
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

      {/* Create / edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { if (!o) closeSheet() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>
              {editing ? "Edit template" : duplicateBase ? "Duplicate template" : "New template"}
            </SheetTitle>
            <SheetDescription>
              Configure how generated clips will look.
            </SheetDescription>
          </SheetHeader>
          <TemplateForm
            initial={sheetInitial}
            onSave={handleSave}
            onCancel={closeSheet}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
