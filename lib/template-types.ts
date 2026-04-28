export type AspectRatio = "9:16" | "1:1" | "16:9"
export type Layout = "single" | "dual" | "pip"
export type BackgroundType = "blur" | "color" | "none"
export type SubtitleStyle = "default" | "bold" | "karaoke" | "outline"
export type SubtitlePosition = "bottom" | "center" | "top"
export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface TemplateConfig {
  aspectRatio: AspectRatio
  layout: Layout
  background: {
    type: BackgroundType
    color?: string
  }
  subtitles: {
    enabled: boolean
    style: SubtitleStyle
    position: SubtitlePosition
    fontSize: number
    color: string
    highlightColor?: string
  }
  watermark: {
    enabled: boolean
    text: string
    position: WatermarkPosition
  }
}

export interface ClipTemplate {
  id: string
  name: string
  description: string
  isSystem: boolean
  config: TemplateConfig
  userId: string | null
  createdAt: string
  updatedAt: string
}

export const DEFAULT_CONFIG: TemplateConfig = {
  aspectRatio: "9:16",
  layout: "single",
  background: { type: "blur" },
  subtitles: {
    enabled: true,
    style: "default",
    position: "bottom",
    fontSize: 32,
    color: "#ffffff",
    highlightColor: "#ffff00",
  },
  watermark: {
    enabled: false,
    text: "",
    position: "bottom-right",
  },
}

export const SYSTEM_TEMPLATES: ClipTemplate[] = [
  {
    id: "system-default",
    name: "Default",
    description: "Standard subtitles with blurred background. The go-to for most content.",
    isSystem: true,
    userId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    config: {
      aspectRatio: "9:16",
      layout: "single",
      background: { type: "blur" },
      subtitles: { enabled: true, style: "default", position: "bottom", fontSize: 32, color: "#ffffff" },
      watermark: { enabled: false, text: "", position: "bottom-right" },
    },
  },
  {
    id: "system-bold",
    name: "Bold Captions",
    description: "Large bold subtitles centred on screen for maximum impact and readability.",
    isSystem: true,
    userId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    config: {
      aspectRatio: "9:16",
      layout: "single",
      background: { type: "blur" },
      subtitles: { enabled: true, style: "bold", position: "center", fontSize: 48, color: "#ffffff" },
      watermark: { enabled: false, text: "", position: "bottom-right" },
    },
  },
  {
    id: "system-karaoke",
    name: "Karaoke",
    description: "Word-by-word highlighted captions that follow the speaker in real time.",
    isSystem: true,
    userId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    config: {
      aspectRatio: "9:16",
      layout: "single",
      background: { type: "blur" },
      subtitles: { enabled: true, style: "karaoke", position: "bottom", fontSize: 36, color: "#ffffff", highlightColor: "#ffff00" },
      watermark: { enabled: false, text: "", position: "bottom-right" },
    },
  },
  {
    id: "system-no-subs",
    name: "No Subtitles",
    description: "Clean clips with just the video — no text overlays.",
    isSystem: true,
    userId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    config: {
      aspectRatio: "9:16",
      layout: "single",
      background: { type: "blur" },
      subtitles: { enabled: false, style: "default", position: "bottom", fontSize: 32, color: "#ffffff" },
      watermark: { enabled: false, text: "", position: "bottom-right" },
    },
  },
  {
    id: "system-square",
    name: "Square",
    description: "1:1 format with black background — ideal for Instagram feed posts.",
    isSystem: true,
    userId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    config: {
      aspectRatio: "1:1",
      layout: "single",
      background: { type: "color", color: "#000000" },
      subtitles: { enabled: true, style: "default", position: "bottom", fontSize: 28, color: "#ffffff" },
      watermark: { enabled: false, text: "", position: "bottom-right" },
    },
  },
  {
    id: "system-landscape",
    name: "Landscape",
    description: "16:9 widescreen format for YouTube and Twitter/X.",
    isSystem: true,
    userId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    config: {
      aspectRatio: "16:9",
      layout: "single",
      background: { type: "blur" },
      subtitles: { enabled: true, style: "default", position: "bottom", fontSize: 28, color: "#ffffff" },
      watermark: { enabled: false, text: "", position: "bottom-right" },
    },
  },
]
