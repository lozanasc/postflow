"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CalendarIcon, CheckIcon, PlayIcon } from "lucide-react"

interface Clip {
  id: string
  wasabiUrl: string
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
}

export function ClipCard({ clip, onApprove, onSchedule }: ClipCardProps) {
  const [playing, setPlaying] = useState(false)

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

  return (
    <Card className={clip.approved ? "ring-2 ring-primary" : ""}>
      {/* Video preview */}
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-t-xl bg-black">
        {playing ? (
          <video
            src={clip.wasabiUrl}
            autoPlay
            controls
            className="h-full w-full object-contain"
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <button
            className="flex h-full w-full items-center justify-center"
            onClick={() => setPlaying(true)}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform hover:scale-105">
              <PlayIcon className="h-6 w-6 fill-white text-white" />
            </div>
          </button>
        )}

        {/* Virality score badge */}
        <div className="absolute right-2 top-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${viralityColor}`}>
            {clip.viralityScore}/10
          </span>
        </div>
      </div>

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

      <CardFooter className="flex gap-2 pt-0">
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
      </CardFooter>
    </Card>
  )
}
