"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { format, addDays, setHours, setMinutes, startOfDay } from "date-fns"
import { DayPicker } from "react-day-picker"
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faClock, faPaperPlane, faTimes } from '@fortawesome/free-solid-svg-icons';

export type Platform = "instagram" | "tiktok" | "youtube" | "x"

export interface SchedulableClip {
  id: string
  hookText?: string
  duration?: number
  thumbnailUrl?: string | null
}

interface ScheduleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clips: SchedulableClip[]
  availableClips?: SchedulableClip[]   // when provided and clips is empty, show internal picker (used from Calendar)
  defaultDate?: Date | null            // preselect a date (e.g. clicked day from calendar)
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
  availableClips,
  defaultDate,
  onScheduled,
}: ScheduleSheetProps) {
  const [platform, setPlatform] = useState<Platform>("instagram")
  const [caption, setCaption] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState("09:00")
  const [isSaving, setIsSaving] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  // Internal multi-select when using availableClips picker (calendar flow)
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())

  const isUsingPicker = (!clips || clips.length === 0) && !!availableClips && availableClips.length > 0
  const effectiveClips = isUsingPicker
    ? (availableClips || []).filter((c) => pickedIds.has(c.id))
    : clips
  const isMulti = effectiveClips.length > 1

  // Initialize sensible defaults when sheet opens or clips change
  useEffect(() => {
    if (!open) return

    // Reset internal picker selection
    setPickedIds(new Set())

    // Default caption: use hook for single, or empty for multi
    const source = clips.length > 0 ? clips : []
    const defaultCaption = source.length === 1 ? (source[0]?.hookText ?? "") : ""
    setCaption(defaultCaption)

    // Default platform stays or reset to first
    setPlatform("instagram")
    setSelectedAccountId(null)

    // Default to tomorrow, or use provided defaultDate (calendar clicked day)
    if (defaultDate) {
      setSelectedDate(defaultDate)
    } else {
      const base = addDays(startOfDay(new Date()), 1)
      setSelectedDate(base)
    }
    setTime("09:00")

    // Load connected accounts
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((d) => setConnectedAccounts(Array.isArray(d) ? d : []))
      .catch(() => setConnectedAccounts([]))
  }, [open, clips, defaultDate])

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
    const toSchedule = effectiveClips
    if (toSchedule.length === 0) {
      toast.error("No clips selected")
      return
    }

    const scheduledAt = combineDateTime(selectedDate, time)

    setIsSaving(true)
    const createdPosts: any[] = []
    let hadError = false

    try {
      for (const clip of toSchedule) {
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
        onScheduled?.(createdPosts)
      }
    }
  }

  function resetAndClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[480px] md:w-1/2 lg:w-[45%] xl:w-[42%] max-w-[720px] overflow-y-auto p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendar} className="h-4 w-4" />
            {isMulti ? `Schedule ${effectiveClips.length} clips` : effectiveClips.length === 1 ? "Schedule clip" : "Schedule clips"}
          </SheetTitle>
          <SheetDescription>
            Create draft ScheduledPost records. You can edit or publish later from the calendar.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-5">
          {/* Clips section: either summary (normal) or interactive picker (from calendar) */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {isUsingPicker ? "Select clips to schedule" : "Clips"}
            </Label>

            {isUsingPicker ? (
              <div className="mt-1.5 rounded-xl border bg-muted/20 p-2 max-h-80 overflow-auto space-y-2">
                {(availableClips || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No ready clips available. Add some from the Library.</div>
                ) : (
                  (availableClips || []).map((c) => {
                    const active = pickedIds.has(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setPickedIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(c.id)) next.delete(c.id)
                            else next.add(c.id)
                            return next
                          })
                        }}
                        className={[
                          "w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition hover:shadow-sm",
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
                        ].join(" ")}
                      >
                        {c.thumbnailUrl ? (
                          <img
                            src={c.thumbnailUrl}
                            alt=""
                            className="h-14 w-9 flex-shrink-0 rounded object-cover border border-white/20"
                          />
                        ) : (
                          <div className="h-14 w-9 flex-shrink-0 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                            clip
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium leading-snug line-clamp-2">
                            {c.hookText ? `“${c.hookText}”` : "Untitled clip"}
                          </div>
                          {typeof c.duration === "number" && (
                            <div className="mt-0.5 text-[11px] opacity-70 tabular-nums">
                              {c.duration.toFixed(0)}s
                            </div>
                          )}
                        </div>
                        <div className={["mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center text-xs", active ? "bg-white text-primary border-white" : "border-muted-foreground/40"].join(" ")}>
                          {active ? "✓" : ""}
                        </div>
                      </button>
                    )
                  })
                )}
                <div className="pt-1 text-xs text-muted-foreground px-1">
                  {effectiveClips.length} selected — click to toggle
                </div>
              </div>
            ) : (
              <div className="mt-1.5 rounded-xl border bg-muted/30 p-2 max-h-40 overflow-auto space-y-1.5">
                {clips.length === 0 ? (
                  <span className="text-muted-foreground px-1">No clips selected</span>
                ) : (
                  clips.map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-2.5 text-foreground/90 px-1">
                      {c.thumbnailUrl ? (
                        <img src={c.thumbnailUrl} alt="" className="h-10 w-7 flex-shrink-0 rounded object-cover border" />
                      ) : (
                        <div className="h-10 w-7 flex-shrink-0 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">clip</div>
                      )}
                      <div className="min-w-0 flex-1 leading-snug">
                        <span className="text-muted-foreground/70 tabular-nums text-xs mr-1">{idx + 1}.</span>
                        <span className="font-medium">{c.hookText ? `“${c.hookText}”` : "Untitled clip"}</span>
                      </div>
                      {typeof c.duration === "number" && (
                        <span className="text-muted-foreground/70 text-xs tabular-nums shrink-0 ml-2">({c.duration.toFixed(0)}s)</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
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
              <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5" /> Schedule date &amp; time
            </Label>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs font-semibold text-foreground/80">Pick a date</div>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(undefined)}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={{ before: startOfDay(new Date()) }}
                className="mx-auto"
                classNames={{
                  root: "rdp-root rdp-schedule",
                  months: "flex flex-col",
                  month: "space-y-2",
                  caption_label: "text-sm font-semibold tracking-tight",
                  nav: "flex items-center gap-1 absolute right-1 top-1",
                  button_previous: "h-7 w-7 inline-flex items-center justify-center rounded-lg border border-border/70 hover:bg-accent text-muted-foreground",
                  button_next: "h-7 w-7 inline-flex items-center justify-center rounded-lg border border-border/70 hover:bg-accent text-muted-foreground",
                  month_grid: "w-full border-collapse",
                  weekdays: "flex",
                  weekday: "text-muted-foreground w-9 font-medium text-[10px] uppercase tracking-[0.5px] text-center pb-1",
                  week: "flex w-full mt-0.5",
                  day: "relative p-0.5 text-center text-sm h-9 w-9",
                  day_button: "h-9 w-9 p-0 font-medium rounded-xl transition-all hover:bg-accent aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:shadow-sm flex items-center justify-center border border-transparent",
                }}
              />

              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <div className="flex items-center gap-1.5 flex-1">
                  <FontAwesomeIcon icon={faClock} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Label htmlFor="schedule-time" className="text-xs text-muted-foreground sr-only">Time</Label>
                  <input
                    id="schedule-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="flex h-8 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    disabled={isSaving}
                  />
                </div>
                <div className="text-xs font-medium text-foreground/80 whitespace-nowrap tabular-nums min-w-[160px] text-right bg-muted/60 rounded-lg px-2 py-1">
                  {scheduledAtPreview}
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">Leave date empty or clear for a draft. Time is your local time.</p>
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
          <Button onClick={handleSave} disabled={isSaving || effectiveClips.length === 0 || !platform} className="flex-1 sm:flex-none">
            {isSaving ? "Scheduling..." : (
              <>
                <FontAwesomeIcon icon={faPaperPlane} className="mr-1.5 h-3.5 w-3.5" />
                {isMulti ? `Schedule ${effectiveClips.length} clips` : "Schedule clip"}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
