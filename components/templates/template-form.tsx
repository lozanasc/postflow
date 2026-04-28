"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  DEFAULT_CONFIG,
  type TemplateConfig,
  type ClipTemplate,
  type AspectRatio,
  type Layout,
  type BackgroundType,
  type SubtitleStyle,
  type SubtitlePosition,
  type WatermarkPosition,
} from "@/lib/template-types"

interface TemplateFormProps {
  initial?: ClipTemplate | null
  onSave: (data: { name: string; description: string; config: TemplateConfig }) => Promise<void>
  onCancel: () => void
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TemplateForm({ initial, onSave, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [config, setConfig] = useState<TemplateConfig>(
    (initial?.config as TemplateConfig) ?? DEFAULT_CONFIG
  )
  const [saving, setSaving] = useState(false)

  function patch(partial: Partial<TemplateConfig>) {
    setConfig((c) => ({ ...c, ...partial }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ name, description, config })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 overflow-y-auto flex-1">
      {/* Basic info */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-name">Name</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My template"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-desc">Description</Label>
          <Input
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional short description"
          />
        </div>
      </div>

      <Separator />

      {/* Format */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold">Format</span>
        <OptionGroup<AspectRatio>
          label="Aspect ratio"
          value={config.aspectRatio}
          options={[
            { value: "9:16", label: "9:16 Vertical" },
            { value: "1:1", label: "1:1 Square" },
            { value: "16:9", label: "16:9 Landscape" },
          ]}
          onChange={(v) => patch({ aspectRatio: v })}
        />
        <OptionGroup<Layout>
          label="Layout"
          value={config.layout}
          options={[
            { value: "single", label: "Single" },
            { value: "dual", label: "Dual screen" },
            { value: "pip", label: "Picture-in-picture" },
          ]}
          onChange={(v) => patch({ layout: v })}
        />
      </div>

      <Separator />

      {/* Background */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold">Background</span>
        <OptionGroup<BackgroundType>
          label="Type"
          value={config.background.type}
          options={[
            { value: "blur", label: "Blurred video" },
            { value: "color", label: "Solid color" },
            { value: "none", label: "None / transparent" },
          ]}
          onChange={(v) => patch({ background: { ...config.background, type: v } })}
        />
        {config.background.type === "color" && (
          <div className="flex items-center gap-3">
            <Label htmlFor="bg-color" className="text-xs text-muted-foreground">Color</Label>
            <input
              id="bg-color"
              type="color"
              value={config.background.color ?? "#000000"}
              onChange={(e) =>
                patch({ background: { ...config.background, color: e.target.value } })
              }
              className="h-8 w-16 cursor-pointer rounded border border-border bg-transparent"
            />
            <span className="text-sm text-muted-foreground">{config.background.color ?? "#000000"}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Subtitles */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Subtitles</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.subtitles.enabled}
              onChange={(e) =>
                patch({ subtitles: { ...config.subtitles, enabled: e.target.checked } })
              }
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">Enabled</span>
          </label>
        </div>

        {config.subtitles.enabled && (
          <>
            <OptionGroup<SubtitleStyle>
              label="Style"
              value={config.subtitles.style}
              options={[
                { value: "default", label: "Default" },
                { value: "bold", label: "Bold" },
                { value: "karaoke", label: "Karaoke" },
                { value: "outline", label: "Outline" },
              ]}
              onChange={(v) => patch({ subtitles: { ...config.subtitles, style: v } })}
            />
            <OptionGroup<SubtitlePosition>
              label="Position"
              value={config.subtitles.position}
              options={[
                { value: "top", label: "Top" },
                { value: "center", label: "Center" },
                { value: "bottom", label: "Bottom" },
              ]}
              onChange={(v) => patch({ subtitles: { ...config.subtitles, position: v } })}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="font-size" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Font size: {config.subtitles.fontSize}px
              </Label>
              <input
                id="font-size"
                type="range"
                min={16}
                max={72}
                value={config.subtitles.fontSize}
                onChange={(e) =>
                  patch({ subtitles: { ...config.subtitles, fontSize: Number(e.target.value) } })
                }
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>16px</span>
                <span>72px</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Text color</span>
              <input
                type="color"
                value={config.subtitles.color}
                onChange={(e) =>
                  patch({ subtitles: { ...config.subtitles, color: e.target.value } })
                }
                className="h-8 w-16 cursor-pointer rounded border border-border bg-transparent"
              />
              <span className="text-sm text-muted-foreground">{config.subtitles.color}</span>
            </div>
            {config.subtitles.style === "karaoke" && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Highlight color</span>
                <input
                  type="color"
                  value={config.subtitles.highlightColor ?? "#ffff00"}
                  onChange={(e) =>
                    patch({ subtitles: { ...config.subtitles, highlightColor: e.target.value } })
                  }
                  className="h-8 w-16 cursor-pointer rounded border border-border bg-transparent"
                />
                <span className="text-sm text-muted-foreground">{config.subtitles.highlightColor ?? "#ffff00"}</span>
              </div>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Watermark */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Watermark</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.watermark.enabled}
              onChange={(e) =>
                patch({ watermark: { ...config.watermark, enabled: e.target.checked } })
              }
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">Enabled</span>
          </label>
        </div>

        {config.watermark.enabled && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wm-text">Text</Label>
              <Input
                id="wm-text"
                value={config.watermark.text}
                onChange={(e) =>
                  patch({ watermark: { ...config.watermark, text: e.target.value } })
                }
                placeholder="@yourhandle"
              />
            </div>
            <OptionGroup<WatermarkPosition>
              label="Position"
              value={config.watermark.position}
              options={[
                { value: "top-left", label: "Top left" },
                { value: "top-right", label: "Top right" },
                { value: "bottom-left", label: "Bottom left" },
                { value: "bottom-right", label: "Bottom right" },
              ]}
              onChange={(v) => patch({ watermark: { ...config.watermark, position: v } })}
            />
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 mt-auto sticky bottom-0 bg-popover pb-1">
        <Button type="submit" disabled={saving || !name.trim()} className="flex-1">
          {saving ? "Saving..." : "Save template"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
