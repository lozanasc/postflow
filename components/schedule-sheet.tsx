"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { format, addDays, setHours, setMinutes, startOfDay } from "date-fns"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"
import "react-day-picker/style.css"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CalendarIcon, ClockIcon, SendIcon, XIcon } from "lucide-react"

export type Platform = "instagram" | "tiktok" | "youtube" | "x"

export interface SchedulableClip {
  id: string
  hookText?: string
  duration?: number
}

interface ScheduleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clips: SchedulableClip[]
  onScheduled?: (created: any[]) => void
}

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
]

export function ScheduleSheet({
  open,
  onOpenChange,
  clips,
  onScheduled,
}: ScheduleSheetProps) {
  const [platform, setPlatform] = useState<Platform>("instagram")
  const [caption, setCaption] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState("09:00")
  const [isSaving, setIsSaving] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const isMulti = clips.length > 1

  // Initialize sensible defaults when sheet opens or clips change
  useEffect(() => {
    if (!open) return

    // Default caption: use hook for single, or empty for multi
    const defaultCaption = clips.length === 1 ? (clips[0]?.hookText ?? "") : ""
    setCaption(defaultCaption)

    // Default platform stays or reset to first
    setPlatform("instagram")
    setSelectedAccountId(null)

    // Default to tomorrow at 09:00 (or later today + few hours if after)
    const base = addDays(startOfDay(new Date()), 1)
    setSelectedDate(base)
    setTime("09:00")

    // Load connected accounts
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((d) => setConnectedAccounts(Array.isArray(d) ? d : []))
      .catch(() => setConnectedAccounts([]))
  }, [open, clips])

  function combineDateTime(date: Date | undefined, timeStr: string): Date | null {
    if (!date) return null
    const [hours, minutes] = timeStr.split(":").map((n) => parseInt(n, 10))
    if (isNaN(hours) || isNaN(minutes)) return null
    return setMinutes(setHours(date, hours), minutes)
  }

  const scheduledAtPreview = React.useMemo(() => {
    const dt = combineDateTime(selectedDate, time)
    return dt ? format(dt, "PPP 'at' p") : "No date selected"
  }, [selectedDate, time])

  async function handleSave() {
    if (!platform) {
      toast.error("Please select a platform")
      return
    }
    if (clips.length === 0) {
      toast.error("No clips selected")
      return
    }

    const scheduledAt = combineDateTime(selectedDate, time)

    setIsSaving(true)
    const createdPosts: any[] = []
    let hadError = false

    try {
      for (const clip of clips) {
        const res = await fetch("/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipId: clip.id,
            platform,
            caption: caption.trim(),
            scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
            socialAccountId: selectedAccountId,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({} as any))
          throw new Error(data?.error || `Failed to schedule clip ${clip.id}`)
        }

        const created = await res.json()
        createdPosts.push(created)
      }

      toast.success(
        createdPosts.length === 1
          ? "Clip scheduled (draft)"
          : `${createdPosts.length} clips scheduled as drafts`
      )

      onScheduled?.(createdPosts)
      onOpenChange(false)
    } catch (err: any) {
      hadError = true
      toast.error(err?.message || "Failed to create scheduled posts")
    } finally {
      setIsSaving(false)
      if (hadError && createdPosts.length > 0) {
        // partial success case (rare)
        onScheduled?.(createdPosts)
      }
    }
  }

  function resetAndClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {isMulti ? `Schedule ${clips.length} clips` : "Schedule clip"}
          </SheetTitle>
          <SheetDescription>
            Create draft ScheduledPost records. You can edit or publish later from the calendar.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-5">
          {/* Clips summary for multi or single */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Clips</Label>
            <div className="mt-1.5 rounded-lg border bg-muted/30 p-2.5 text-sm max-h-28 overflow-auto space-y-0.5">
              {clips.length === 0 ? (
                <span className="text-muted-foreground">No clips selected</span>
              ) : (
                clips.map((c, idx) => (
                  <div key={c.id} className="truncate text-foreground/90 leading-snug flex items-baseline gap-1.5">
                    <span className="text-muted-foreground/70 tabular-nums shrink-0">{idx + 1}.</span>
                    <span className="truncate">
                      {c.hookText ? `“${c.hookText}”` : "Untitled clip"}
                    </span>
                    {typeof c.duration === "number" && (
                      <span className="text-muted-foreground/70 ml-auto text-[10px] tabular-nums shrink-0">({c.duration.toFixed(0)}s)</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Platform picker (visual, not native select for nicer feel) */}
          <div>
            <Label htmlFor="platform" className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Platform
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLATFORM_OPTIONS.map((opt) => {
                const active = platform === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlatform(opt.value)}
                    className={[
                      "flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border text-foreground",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Caption */}
          <div>
            <Label htmlFor="caption" className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Caption
            </Label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption... (shared for bulk schedules; edit per post later)"
              className="w-full min-h-[92px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none resize-y"
              disabled={isSaving}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Caption is optional and applied to all selected clips for this schedule action.</p>
          </div>

          {/* Date + Time picker */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" /> Schedule date &amp; time
            </Label>

            <div className="rounded-xl border p-3 bg-background">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={{ before: startOfDay(new Date()) }}
                className="mx-auto"
                classNames={{
                  root: "rdp-root",
                  months: "flex flex-col",
                  month: "space-y-2",
                  caption_label: "text-sm font-medium",
                  nav: "flex items-center gap-1 absolute right-1",
                  button_previous: "h-6 w-6 inline-flex items-center justify-center rounded-md border hover:bg-muted text-sm mr-1",
                  button_next: "h-6 w-6 inline-flex items-center justify-center rounded-md border hover:bg-muted text-sm",
                  month_grid: "w-full border-collapse",
                  weekdays: "flex",
                  weekday: "text-muted-foreground rounded-md w-8 font-normal text-[10px] uppercase tracking-[0.5px] text-center",
                  week: "flex w-full mt-1",
                  day: "relative p-0 text-center text-sm h-8 w-8",
                  day_button: "h-8 w-8 p-0 font-normal rounded-md hover:bg-muted aria-selected:opacity-100 flex items-center justify-center",
                }}
              />

              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <div className="flex items-center gap-1.5 flex-1">
                  <ClockIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Label htmlFor="schedule-time" className="text-xs text-muted-foreground sr-only">Time</Label>
                  <input
                    id="schedule-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    disabled={isSaving}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums min-w-[150px] text-right">
                  {scheduledAtPreview}
                </div>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Time is local. Set to draft without time by choosing a past date? (future dates recommended)</p>
          </div>

          {/* Social account selector */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Publish using
            </Label>
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              disabled={isSaving}
            >
              <option value="">Any connected account for {platform}</option>
              {connectedAccounts
                .filter((a) => a.platform === platform)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.platformUsername}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Connect more accounts in <a href="/dashboard/settings/integrations" className="underline">Integrations</a>.
            </p>
          </div>
        </div>

        <SheetFooter className="p-4 pt-0 border-t mt-auto gap-2 sm:gap-2">
          <SheetClose
            render={
              <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>
                Cancel
              </Button>
            }
          />
          <Button onClick={handleSave} disabled={isSaving || clips.length === 0 || !platform} className="flex-1 sm:flex-none">
            {isSaving ? "Scheduling..." : (
              <>
                <SendIcon className="mr-1.5 h-3.5 w-3.5" />
                {isMulti ? `Schedule ${clips.length} clips` : "Schedule clip"}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
