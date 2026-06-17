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

// Live simulated video preview pane (split view side panel / responsive top on mobile)
// Uses pure CSS + React state from parent config. No real video.
function LivePreview({ config }: { config: TemplateConfig }) {
  const ar = config.aspectRatio
  const aspectStyle: React.CSSProperties = {
    aspectRatio: ar === "9:16" ? "9 / 16" : ar === "1:1" ? "1 / 1" : "16 / 9",
  }
  // Much larger, realistic device chrome so it actually looks like a phone / laptop / monitor on screen
  const frameWidth = ar === "9:16" ? "460px" : ar === "1:1" ? "540px" : "720px"

  const isPhone = ar === "9:16";
  const isSquare = ar === "1:1";
  const isLandscape = ar === "16:9";
  const deviceLabel = isPhone
    ? "iPhone 16 Pro"
    : isSquare
    ? "iPad Pro"
    : "MacBook Pro 16";

  // Background simulation: blur = cinematic gradient (faded "video" feel), color = solid, none = dark
  let bgLayerStyle: React.CSSProperties
  if (config.background.type === "color" && config.background.color) {
    bgLayerStyle = { backgroundColor: config.background.color }
  } else if (config.background.type === "blur") {
    bgLayerStyle = {
      background: "linear-gradient(145deg, #0f172a 0%, #1e2937 35%, #334155 100%)",
    }
  } else {
    bgLayerStyle = { backgroundColor: "#0a0a0a" }
  }

  const subs = config.subtitles
  const wm = config.watermark

  // Sample subtitle content (short for preview frame)
  const sampleLine = "Live preview updates with every change."

  // Karaoke demo words (highlight simulates timed word-by-word)
  const karaokeWords = ["LIVE", "PREVIEW", "UPDATES", "INSTANTLY"]

  // Position for subtitles
  const subPos =
    subs.position === "top"
      ? "top-2"
      : subs.position === "center"
      ? "top-1/2 -translate-y-1/2"
      : "bottom-2"

  // Scaled font — now tuned for the much larger device frames (realistic subtitle size)
  const scaledFont = Math.max(8, Math.round(subs.fontSize / 2.75))

  // Subtitle text styles per type (use tokens + direct colors)
  const subBaseStyle: React.CSSProperties = {
    color: subs.color,
    fontSize: `${scaledFont}px`,
    lineHeight: 1.05,
    textAlign: "center",
  }

  let subExtraClass = "px-1.5 py-px rounded-sm inline-block max-w-[92%] truncate"
  let subExtraStyle: React.CSSProperties = { ...subBaseStyle }

  if (subs.style === "bold") {
    subExtraClass += " font-semibold"
    subExtraStyle.textShadow = "0 1px 2px rgba(0,0,0,0.85)"
  } else if (subs.style === "outline") {
    subExtraClass += " font-semibold"
    subExtraStyle.textShadow = "0 0 0 1px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.6)"
    // Outline via stroke simulation
    subExtraStyle.WebkitTextStroke = "0.6px #000"
  } else if (subs.style === "karaoke") {
    // handled specially below
  } else {
    // default
    subExtraStyle.textShadow = "0 1px 3px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.5)"
  }

  // Watermark position
  const wmClass = {
    "top-left": "top-1 left-1",
    "top-right": "top-1 right-1",
    "bottom-left": "bottom-1 left-1",
    "bottom-right": "bottom-1 right-1",
  }[wm.position] || "bottom-1 right-1"

  // Layout simulation: placeholder "face" boxes — sized for the bigger device frames
  const renderLayout = () => {
    const face = "rounded-sm border border-white/25 bg-white/8 text-[11px] text-white/65 flex items-center justify-center overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
    if (config.layout === "dual") {
      return (
        <div className="absolute inset-1.5 flex gap-1">
          <div className={`${face} flex-1`} aria-hidden>👤</div>
          <div className={`${face} flex-1`} aria-hidden>👤</div>
        </div>
      )
    }
    if (config.layout === "pip") {
      return (
        <>
          <div className={`absolute inset-1.5 ${face}`} style={{ fontSize: "12px" }} aria-hidden>👤 Main</div>
          <div className={`absolute bottom-3 right-3 w-[30%] aspect-[4/3] ${face}`} aria-hidden style={{ fontSize: "9px" }}>👤</div>
        </>
      )
    }
    // single
    return <div className={`absolute inset-2 ${face}`} style={{ fontSize: "13px" }} aria-hidden>👤 Speaker</div>
  }

  return (
    <div className="relative flex flex-col items-center mx-auto" style={{ width: frameWidth }}>
      {isPhone ? (
        // iPhone 16 Pro — tall, premium, realistic with side buttons + detailed island
        <div className="relative" style={{ width: "100%" }}>
          <div
            className="relative mx-auto bg-[#0a0a0a] rounded-[3.25rem] p-[9px] shadow-[0_30px_90px_-15px_rgb(0,0,0,0.6),0_10px_30px_-8px_rgb(0,0,0,0.5)] border-[13px] border-[#0f0f0f] ring-1 ring-inset ring-white/10"
            style={{ aspectRatio: "9/16" }}
          >
            {/* Left volume buttons */}
            <div className="absolute -left-[13px] top-[18%] h-[52px] w-[4px] bg-[#171717] rounded-l-full z-50" />
            <div className="absolute -left-[13px] top-[26%] h-[28px] w-[4px] bg-[#171717] rounded-l-full z-50" />

            {/* Right power button */}
            <div className="absolute -right-[13px] top-[22%] h-[78px] w-[4px] bg-[#171717] rounded-r-full z-50" />

            {/* Dynamic Island (pill + sensors) */}
            <div className="absolute top-[13px] left-1/2 -translate-x-1/2 w-[82px] h-[19px] bg-black rounded-full z-50 flex items-center justify-center gap-1 ring-1 ring-white/10">
              <div className="w-[5px] h-[5px] bg-zinc-800 rounded-full" />
              <div className="w-2 h-[3px] bg-zinc-700 rounded-full" />
              <div className="w-[5px] h-[5px] bg-zinc-800 rounded-full" />
            </div>

            {/* Screen content area */}
            <div className="relative w-full h-full rounded-[2.35rem] overflow-hidden shadow-inner" style={bgLayerStyle}>
              {/* Fine grain + cinematic layers */}
              {(config.background.type === "blur" || config.background.type === "none") && (
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.032)_0.7px,transparent_1px)] bg-[length:2.5px_2.5px] opacity-70" />
              )}
              {config.background.type === "blur" && (
                <div className="absolute inset-0 bg-gradient-to-b from-white/6 via-transparent to-black/25" />
              )}

              <div className="absolute inset-0">
                {renderLayout()}
              </div>

              {/* Subtitles */}
              {subs.enabled && (
                <div className={`absolute left-3 right-3 z-20 ${subPos}`}>
                  {subs.style === "karaoke" ? (
                    <div
                      className="inline-flex items-center justify-center rounded bg-black/85 px-2 py-px text-center font-medium tracking-[-0.25px]"
                      style={{ fontSize: `${scaledFont + 0.6}px`, color: subs.color }}
                    >
                      {karaokeWords.map((word, idx) => {
                        const isHighlight = idx === 1;
                        return (
                          <span
                            key={idx}
                            className="px-px"
                            style={{
                              color: isHighlight ? (subs.highlightColor || "#ffff00") : subs.color,
                              fontWeight: isHighlight ? 700 : 500,
                            }}
                          >
                            {word}
                            {idx < karaokeWords.length - 1 ? "\u00A0" : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`bg-black/75 ${subExtraClass}`} style={subExtraStyle}>
                      {sampleLine}
                    </div>
                  )}
                </div>
              )}

              {/* Watermark */}
              {wm.enabled && wm.text.trim() && (
                <div
                  className={`absolute z-30 px-1.5 py-0.5 rounded text-[8px] font-mono tracking-[0.6px] bg-black/65 text-white/80 ${wmClass}`}
                >
                  {wm.text}
                </div>
              )}
            </div>

            {/* Home indicator bar */}
            <div className="absolute bottom-[9px] left-1/2 -translate-x-1/2 w-[92px] h-[3.5px] bg-white/20 rounded-full z-50" />
          </div>
        </div>
      ) : isLandscape ? (
        // MacBook Pro 16 — real laptop with screen + aluminum chassis + keyboard + trackpad
        <div className="relative w-full" style={{ maxWidth: "100%" }}>
          {/* Screen + thin bezel */}
          <div className="relative mx-auto bg-zinc-950 rounded-[13px] p-[6px] shadow-[0_35px_100px_-20px_rgb(0,0,0,0.55),0_12px_40px_-10px_rgb(0,0,0,0.4)] border border-zinc-800">
            {/* Actual display surface */}
            <div
              className="relative w-full rounded-[7px] overflow-hidden bg-black ring-1 ring-inset ring-white/5"
              style={{ aspectRatio: "16/9" }}
            >
              <div className="relative w-full h-full overflow-hidden" style={bgLayerStyle}>
                {(config.background.type === "blur" || config.background.type === "none") && (
                  <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_0.6px,transparent_1px)] bg-[length:2.5px_2.5px]" />
                )}
                {config.background.type === "blur" && (
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/30" />
                )}

                <div className="absolute inset-0">
                  {renderLayout()}
                </div>

                {subs.enabled && (
                  <div className={`absolute left-3 right-3 z-20 ${subPos}`}>
                    {subs.style === "karaoke" ? (
                      <div
                        className="inline-flex items-center justify-center rounded bg-black/80 px-2 py-px text-center font-medium tracking-[-0.2px]"
                        style={{ fontSize: `${scaledFont + 0.5}px`, color: subs.color }}
                      >
                        {karaokeWords.map((word, idx) => {
                          const isHighlight = idx === 1;
                          return (
                            <span
                              key={idx}
                              className="px-px"
                              style={{
                                color: isHighlight ? (subs.highlightColor || "#ffff00") : subs.color,
                                fontWeight: isHighlight ? 700 : 500,
                              }}
                            >
                              {word}
                              {idx < karaokeWords.length - 1 ? "\u00A0" : ""}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`bg-black/70 ${subExtraClass}`} style={subExtraStyle}>
                        {sampleLine}
                      </div>
                    )}
                  </div>
                )}

                {wm.enabled && wm.text.trim() && (
                  <div className={`absolute z-30 px-1.5 py-0.5 rounded text-[8px] font-mono tracking-[0.5px] bg-black/55 text-white/80 ${wmClass}`}>
                    {wm.text}
                  </div>
                )}
              </div>

              {/* Notch-style camera bar */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[66px] h-[9px] bg-zinc-950 rounded-full flex items-center justify-center z-50">
                <div className="w-[4.5px] h-[4.5px] bg-zinc-700 rounded-full ring-1 ring-zinc-800" />
              </div>
            </div>
          </div>

          {/* Hinge + aluminum base with keyboard + trackpad */}
          <div className="mx-auto -mt-px h-[5px] w-[94%] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded-b" />
          <div className="mx-auto w-[96%] -mt-px bg-zinc-300 rounded-b-[18px] border border-zinc-400 shadow-inner px-4 pt-3 pb-3.5">
            {/* Keyboard row simulation */}
            <div className="mx-auto mb-1.5 h-5 w-[94%] bg-zinc-700/80 rounded-[3px] flex items-center justify-center gap-px">
              <div className="h-1.5 w-4 bg-zinc-500/60 rounded-[1px]" />
              <div className="h-1.5 w-4 bg-zinc-500/60 rounded-[1px]" />
              <div className="h-1.5 w-4 bg-zinc-500/60 rounded-[1px]" />
              <div className="h-1.5 w-4 bg-zinc-500/60 rounded-[1px]" />
              <div className="h-1.5 w-4 bg-zinc-500/60 rounded-[1px]" />
            </div>
            {/* Trackpad */}
            <div className="mx-auto h-[14px] w-[38%] rounded bg-zinc-400/70 border border-zinc-500/60" />
          </div>
        </div>
      ) : (
        // Square / iPad Pro style monitor frame (clean, modern, substantial)
        <div className="relative w-full">
          <div
            className="relative mx-auto bg-zinc-800 rounded-3xl p-[7px] shadow-2xl border border-zinc-700"
            style={{ aspectRatio: "1/1" }}
          >
            {/* Display */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden" style={bgLayerStyle}>
              {(config.background.type === "blur" || config.background.type === "none") && (
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_0.8px,transparent_1px)] bg-[length:3px_3px] opacity-80" />
              )}
              {config.background.type === "blur" && (
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20" />
              )}

              <div className="absolute inset-0">
                {renderLayout()}
              </div>

              {subs.enabled && (
                <div className={`absolute left-2.5 right-2.5 z-20 ${subPos}`}>
                  {subs.style === "karaoke" ? (
                    <div
                      className="inline-flex items-center justify-center rounded bg-black/80 px-1.5 py-px text-center font-medium tracking-[-0.2px]"
                      style={{ fontSize: `${scaledFont + 0.5}px`, color: subs.color }}
                    >
                      {karaokeWords.map((word, idx) => {
                        const isHighlight = idx === 1;
                        return (
                          <span
                            key={idx}
                            className="px-px"
                            style={{
                              color: isHighlight ? (subs.highlightColor || "#ffff00") : subs.color,
                              fontWeight: isHighlight ? 700 : 500,
                            }}
                          >
                            {word}
                            {idx < karaokeWords.length - 1 ? "\u00A0" : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`bg-black/70 ${subExtraClass}`} style={subExtraStyle}>
                      {sampleLine}
                    </div>
                  )}
                </div>
              )}

              {wm.enabled && wm.text.trim() && (
                <div className={`absolute z-30 px-1 py-0.5 rounded text-[8px] font-mono tracking-[0.5px] bg-black/55 text-white/80 ${wmClass}`}>
                  {wm.text}
                </div>
              )}
            </div>

            {/* Top camera dot */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[7px] h-[7px] bg-zinc-400 rounded-full z-50 ring-1 ring-zinc-700" />
          </div>

          {/* Monitor stand (substantial) */}
          <div className="mx-auto -mt-0.5 h-3.5 w-2/5 bg-zinc-700 rounded-b-2xl" />
          <div className="mx-auto h-1.5 w-[46%] bg-zinc-600 rounded" />
        </div>
      )}

      <div className="mt-3 inline-flex items-center rounded-full bg-muted/60 px-3 py-0.5 text-[10px] text-muted-foreground/80 font-mono tracking-[0.75px]">
        {deviceLabel} • {ar} {config.layout}
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
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col lg:flex-row overflow-hidden">
      {/* Preview side panel (first in DOM for mobile: top; lg: right side) — now much larger to show real device frames */}
      <div className="order-1 lg:order-2 flex flex-col p-5 bg-muted/20 overflow-y-auto flex-1 min-w-0 lg:min-w-[820px] border-b lg:border-b-0 lg:border-l border-border">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted-foreground">Live preview</span>
          <span className="text-[10px] text-muted-foreground/70 tabular-nums font-mono">{config.aspectRatio} · {config.layout}</span>
        </div>
        <div className="flex-1 flex items-center justify-center py-4">
          <LivePreview config={config} />
        </div>
        <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
          Real-time CSS device simulation
        </p>
      </div>

      {/* Config controls (scrollable, left on desktop) */}
      <div className="order-2 lg:order-1 flex flex-col gap-5 p-4 overflow-y-auto flex-1 lg:max-w-[260px] lg:flex-none">
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

        {/* Actions — pinned to bottom of controls column */}
        <div className="flex gap-2 pt-3 mt-auto sticky bottom-0 -mx-4 -mb-4 bg-popover px-4 pb-4 border-t lg:static lg:border-0 lg:bg-transparent lg:mx-0 lg:p-0 lg:pt-2">
          <Button type="submit" disabled={saving || !name.trim()} className="flex-1">
            {saving ? "Saving..." : "Save template"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  )
}
