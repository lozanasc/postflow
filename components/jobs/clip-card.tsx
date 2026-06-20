"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { CalendarIcon, CheckIcon, PlayIcon } from "lucide-react"

interface Clip {
  id: string
  wasabiUrl: string
  wasabiKey?: string | null
  thumbnailUrl?: string | null
  duration: number
  viralityScore: number
  hookText: string
  layout: string
  approved: boolean
  start: number
  end: number
}

interface ClipCardProps {
  clip: Clip
  onApprove: (id: string) => void
  onSchedule: (id: string) => void
  // Optional controlled playing id (lifted in parent) to prevent multiple auto-plays across cards
  playingClipId?: string | null
  onPlay?: (id: string | null) => void
  // Selection support for Library bulk scheduling (Phase 3)
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  // Grid / list view toggle support (Phase 3 library)
  variant?: "grid" | "list"
}

export function ClipCard({ clip, onApprove, onSchedule, playingClipId, onPlay, selectable, selected, onToggleSelect, variant = "grid" }: ClipCardProps) {
  const [localPlaying, setLocalPlaying] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)

  // Controlled or local playing state
  const playing = playingClipId !== undefined ? playingClipId === clip.id : localPlaying
  const setPlaying = (val: boolean) => {
    if (onPlay) {
      onPlay(val ? clip.id : null)
    } else {
      setLocalPlaying(val)
    }
    if (val) setVideoError(false)
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.round(s % 60)
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.round(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const viralityColor =
    clip.viralityScore >= 8
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : clip.viralityScore >= 5
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-muted text-muted-foreground"

  // Keyboard support: esc closes player; space handled by native controls (prevent page scroll when focused)
  useEffect(() => {
    if (!playing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlaying(false)
      }
      // Space for pause/play is handled by the <video> element when focused; prevent scroll as courtesy
      if (e.key === " " && document.activeElement?.tagName === "VIDEO") {
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [playing])

  // Prevent multiple simultaneous auto-plays
  async function startPlaying() {
    document.querySelectorAll("video").forEach((v) => {
      if (!v.paused) {
        v.pause()
      }
    })

    // EVERY TIME the user clicks play, fetch a fresh presigned URL
    await ensureFreshPresigned()
    setPlaying(true)
  }

  async function ensureFreshPresigned() {
    let playUrl = clip.wasabiUrl
    if (clip.wasabiKey) {
      try {
        const res = await fetch(`/api/presign?key=${encodeURIComponent(clip.wasabiKey)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.url) playUrl = data.url
        }
      } catch (e) {
        console.warn("Failed to fetch fresh presigned URL, falling back", e)
      }
    }
    setActiveSrc(playUrl)
  }

  // If playing prop turns on (e.g. from parent lifting), still ensure fresh URL
  useEffect(() => {
    if (playing) {
      ensureFreshPresigned()
    }
  }, [playing])

  const isList = variant === "list"

  // Position tweaks: when list + selectable, shift approved badge right of checkbox to avoid overlap
  const approvedLeftClass = (selectable && onToggleSelect) ? (isList ? "left-9" : "left-9") : "left-2"

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-200 hover:shadow-sm",
        clip.approved
          ? "ring-2 ring-primary/80 border-primary/40"
          : "border-border",
        isList && "flex flex-row"
      )}
    >
      {/* Video preview (poster-like when idle + enhanced play UX) */}
      <div
        className={cn(
          "relative overflow-hidden bg-black",
          isList
            ? "w-20 sm:w-24 flex-shrink-0 aspect-[9/16] rounded-l-xl"
            : "aspect-[9/16] w-full rounded-t-xl"
        )}
      >
        {playing ? (
          videoError ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-black/80 text-center p-2 text-xs text-white/80">
              <p>Failed to load video (403 or expired URL).</p>
              <a
                href={activeSrc || clip.wasabiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 underline text-primary-foreground/80 hover:text-white"
              >
                Open in new tab / download
              </a>
            </div>
          ) : (
            <video
              key={activeSrc || clip.wasabiUrl}
              src={activeSrc || clip.wasabiUrl}
              autoPlay
              controls
              playsInline
              crossOrigin="anonymous"
              poster={clip.thumbnailUrl || undefined}
              className="h-full w-full object-contain focus:outline-none"
              onEnded={() => setPlaying(false)}
              onError={() => setVideoError(true)}
              onPause={() => {
                // keep state in sync if user uses native pause
              }}
            />
          )
        ) : (
          <button
            className="group/play flex h-full w-full items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={startPlaying}
            aria-label={`Play clip ${clip.hookText ? `"${clip.hookText}"` : ""}`}
          >
            {/* Real thumbnail or fallback poster */}
            {clip.thumbnailUrl ? (
              <img
                src={clip.thumbnailUrl}
                alt={clip.hookText || "clip thumbnail"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_0.6px,transparent_1px)] bg-[length:4px_4px]" />
              </>
            )}
            {/* Play control — larger tap target, nice hover scale */}
            <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/30 transition-all group-hover/play:scale-105 group-hover/play:bg-white/30 group-active/play:scale-95">
              <PlayIcon className="h-6 w-6 fill-white text-white drop-shadow" />
            </div>
            {/* Small duration hint on poster for delight */}
            <div className="absolute bottom-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white/80 tabular-nums">
              {formatDuration(clip.duration)}
            </div>
          </button>
        )}

        {/* Virality score badge */}
        <div className={cn("absolute right-2 top-2 z-10", isList && "right-1 top-1")}>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${viralityColor}`}>
            {clip.viralityScore}/10
          </span>
        </div>

        {/* Selection checkbox (for Library bulk actions) - Phase 3 */}
        {selectable && onToggleSelect && (
          <label
            className="absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded bg-black/60 backdrop-blur-sm ring-1 ring-white/30"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={selected ? "Deselect clip" : "Select clip for bulk schedule"}
          >
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect(clip.id)}
              className="h-3.5 w-3.5 cursor-pointer accent-primary rounded-sm border border-white/70 bg-white/90"
              aria-label={selected ? "Deselect" : "Select"}
            />
          </label>
        )}

        {/* Stronger approved visual indicator (beyond ring) - shift when selectable to avoid overlap */}
        {clip.approved && (
          <div className={cn(
            "absolute z-10 flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm",
            approvedLeftClass,
            isList ? "top-1" : "top-2"
          )}>
            <CheckIcon className="h-3 w-3" />
            <span>Approved</span>
          </div>
        )}
      </div>

      {isList ? (
        // List row body (restrained, info dense + actions)
        <div className="flex flex-1 flex-col justify-between p-2.5 min-w-0">
          <div className="min-w-0">
            {clip.hookText && (
              <p className="text-sm font-medium leading-snug line-clamp-2">&ldquo;{clip.hookText}&rdquo;</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{formatTime(clip.start)} → {formatTime(clip.end)}</span>
              <Separator orientation="vertical" className="h-2.5" />
              <span>{formatDuration(clip.duration)}</span>
              <Separator orientation="vertical" className="h-2.5" />
              <Badge variant="outline" className="text-[10px] py-0 capitalize h-4">{clip.layout}</Badge>
            </div>
          </div>

          <div className="mt-3 flex gap-1.5">
            <Button
              variant={clip.approved ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-xs flex-1"
              onClick={() => onApprove(clip.id)}
            >
              {clip.approved ? (
                <><CheckIcon className="mr-1 h-3 w-3" />Approved</>
              ) : (
                "Approve"
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs flex-1"
              onClick={() => onSchedule(clip.id)}
              disabled={!clip.approved}
            >
              <CalendarIcon className="mr-1 h-3 w-3" />
              Schedule
            </Button>
          </div>
        </div>
      ) : (
        <>
          <CardContent className="flex flex-col gap-2 pt-3">
            {clip.hookText && (
              <p className="text-sm font-medium leading-snug">&ldquo;{clip.hookText}&rdquo;</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatTime(clip.start)} → {formatTime(clip.end)}</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{formatDuration(clip.duration)}</span>
              <Separator orientation="vertical" className="h-3" />
              <Badge variant="outline" className="text-xs capitalize">{clip.layout}</Badge>
            </div>
          </CardContent>

          <CardFooter className="pt-0">
            <div className="mt-2 flex w-full gap-2">
              <Button
                variant={clip.approved ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onApprove(clip.id)}
              >
                {clip.approved ? (
                  <><CheckIcon className="mr-1.5 h-3.5 w-3.5" />Approved</>
                ) : (
                  "Approve"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onSchedule(clip.id)}
                disabled={!clip.approved}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                Schedule
              </Button>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
