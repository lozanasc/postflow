"use client"

import { useState, useMemo, useEffect } from "react"

import { 
  format, 
  isSameDay, 
  startOfDay, 
  addDays, 
  addWeeks, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  addMonths, 
  subMonths 
} from "date-fns"
import { toast } from "sonner"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendar,
  faClock,
  faTrash,
  faSave,
  faTimes,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faList,
  faSearch,
  faPlay,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { ScheduleSheet, type SchedulableClip } from "@/components/schedule-sheet"
import { ScheduleOnDaySheet } from "@/components/schedule-on-day-sheet"

// Types matching serialized server data
interface Clip {
  id: string
  wasabiUrl: string
  wasabiKey?: string | null
  thumbnailUrl?: string | null
  duration: number
  viralityScore: number
  hookText: string
  layout: string
  job?: { id: string; youtubeUrl: string | null } | null
}

interface ScheduledPost {
  id: string
  clipId: string
  platform: string
  caption: string
  scheduledAt: string | null
  status: string
  createdAt: string
  updatedAt: string
  clip: Clip
}

const PLATFORMS = ["instagram", "tiktok", "youtube", "x"] as const
type Platform = (typeof PLATFORMS)[number] | "all"

const STATUSES = ["all", "draft", "scheduled", "published", "failed"] as const
type StatusFilter = (typeof STATUSES)[number]

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function formatScheduled(dt: string | null) {
  if (!dt) return "Unscheduled (draft)"
  const d = new Date(dt)
  return format(d, "MMM d, yyyy • h:mm a")
}

function getPlatformBadgeClass(platform: string) {
  // Subtle color hints per platform (keeps minimalist)
  switch (platform) {
    case "instagram":
      return "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-400 border-pink-200 dark:border-pink-900"
    case "tiktok":
      return "bg-black text-white dark:bg-white dark:text-black border-border"
    case "youtube":
      return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900"
    case "x":
      return "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-800 dark:border-zinc-200"
    default:
      return ""
  }
}

interface CalendarViewProps {
  posts: ScheduledPost[]
  availableClips?: SchedulableClip[]
}

export function CalendarView({ posts: initialPosts, availableClips = [] }: CalendarViewProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts)
  const [month, setMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [platformFilter, setPlatformFilter] = useState<Platform>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // New: view mode + search + connected accounts for picker
  const [viewMode, setViewMode] = useState<"month" | "agenda">("month")
  const [search, setSearch] = useState("")
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((data) => setConnectedAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Editor sheet state
  const [editing, setEditing] = useState<ScheduledPost | null>(null)
  const [editPlatform, setEditPlatform] = useState<string>("")
  const [editScheduled, setEditScheduled] = useState<string>("") // datetime-local string
  const [editCaption, setEditCaption] = useState<string>("")
  const [editStatus, setEditStatus] = useState<string>("")
  const [editSocialAccountId, setEditSocialAccountId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // General schedule sheet (top button)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [clipsToSchedule, setClipsToSchedule] = useState<SchedulableClip[]>([])

  // Dedicated sheet for "Schedule on this day" / + buttons (always fresh + fixed date)
  const [onDayOpen, setOnDayOpen] = useState(false)
  const [onDayDate, setOnDayDate] = useState<Date | null>(null)

  // Days that have at least one scheduled post (for modifier dots) + counts for richer calendar
  const { daysWithPosts, dayCounts } = useMemo(() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()
    posts.forEach((p) => {
      if (p.scheduledAt) {
        const d = new Date(p.scheduledAt)
        const key = format(d, "yyyy-MM-dd")
        set.add(key)
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    })
    return { daysWithPosts: set, dayCounts: counts }
  }, [posts])

  // Filtered + sorted list for the right pane / below calendar
  const filteredPosts = useMemo(() => {
    let result = [...posts]

    // Day filter (clicking a calendar day narrows the list)
    if (selectedDate) {
      result = result.filter((p) =>
        p.scheduledAt ? isSameDay(new Date(p.scheduledAt), selectedDate) : false
      )
    } else {
      // Default: upcoming-ish view (future/today scheduled + drafts)
      const today = startOfDay(new Date())
      result = result.filter((p) => {
        if (!p.scheduledAt) return true // drafts always visible in "upcoming"
        return new Date(p.scheduledAt) >= today
      })
    }

    // Platform filter
    if (platformFilter !== "all") {
      result = result.filter((p) => p.platform === platformFilter)
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter)
    }

    // Search (hook, caption, platform)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((p) => {
        const hook = (p.clip?.hookText || "").toLowerCase()
        const cap = (p.caption || "").toLowerCase()
        const plat = (p.platform || "").toLowerCase()
        return hook.includes(q) || cap.includes(q) || plat.includes(q)
      })
    }

    // Sort: scheduledAt asc (nulls/drafts last), then created
    result.sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      }
      if (a.scheduledAt) return -1
      if (b.scheduledAt) return 1
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    return result
  }, [posts, selectedDate, platformFilter, statusFilter, search])

  // Posts for the calendar grid: apply platform/status/search but show the full month (ignore selectedDate + upcoming filter)
  const calendarPosts = useMemo(() => {
    let result = [...posts]

    // Platform filter
    if (platformFilter !== "all") {
      result = result.filter((p) => p.platform === platformFilter)
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((p) => {
        const hook = (p.clip?.hookText || "").toLowerCase()
        const cap = (p.caption || "").toLowerCase()
        const plat = (p.platform || "").toLowerCase()
        return hook.includes(q) || cap.includes(q) || plat.includes(q)
      })
    }

    return result
  }, [posts, platformFilter, statusFilter, search])

  // Has any scheduled (for empty states)
  const hasAnyScheduled = posts.some((p) => !!p.scheduledAt)

  // Full calendar grid days for current month (including leading/trailing)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [month])

  // Posts grouped by day string for the grid (using calendarPosts so filters apply)
  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>()
    calendarPosts.forEach((p) => {
      if (p.scheduledAt) {
        const key = format(new Date(p.scheduledAt), "yyyy-MM-dd")
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(p)
      }
    })
    return map
  }, [calendarPosts])

  // Open editor sheet for a post (pre-populate form fields)
  function openEditor(post: ScheduledPost) {
    setEditing(post)
    setEditPlatform(post.platform)
    setEditCaption(post.caption || "")
    setEditStatus(post.status)
    setEditSocialAccountId((post as any).socialAccountId ?? null)

    if (post.scheduledAt) {
      // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
      const d = new Date(post.scheduledAt)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setEditScheduled(local)
    } else {
      setEditScheduled("")
    }

    // Also select the day in calendar if it has a date (improves UX sync)
    if (post.scheduledAt) {
      setSelectedDate(new Date(post.scheduledAt))
    }
  }

  function closeEditor() {
    setEditing(null)
    setEditSocialAccountId(null)
    setSaving(false)
    setDeleting(false)
  }

  // Day click on calendar → filter list to that day (toggle off if same day)
  const handleDayClick = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null)
    } else {
      setSelectedDate(day)
      // Reset other filters when drilling into a specific day for clarity
      // (keep platform/status if user had them — they still apply)
    }
  }

  // Platform chip filter toggle
  function togglePlatform(p: Platform) {
    setPlatformFilter((cur) => (cur === p ? "all" : p))
  }

  // Update local posts list (optimistic/patch after API)
  function patchPost(id: string, patch: Partial<ScheduledPost>) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    )
  }

  function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  // After successful scheduling from the sheet in calendar context: add the returned posts locally
  function handleNewScheduled(created: any[]) {
    if (!created || created.length === 0) return
    const newOnes: ScheduledPost[] = created.map((c: any) => ({
      id: c.id,
      clipId: c.clipId,
      platform: c.platform,
      caption: c.caption || "",
      scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : null,
      status: c.status || "draft",
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
      clip: c.clip || { id: c.clipId, duration: 0, viralityScore: 0, hookText: "", layout: "single", wasabiUrl: "" },
    }))
    setPosts((prev) => {
      // de-dup by id
      const existingIds = new Set(prev.map((p) => p.id))
      const merged = [...prev]
      for (const n of newOnes) {
        if (!existingIds.has(n.id)) merged.push(n)
      }
      return merged
    })
  }

  // Quick reschedule helpers (optimistic + API)
  async function quickReschedule(post: ScheduledPost, newDate: Date | null) {
    const original = { ...post }

    patchPost(post.id, {
      scheduledAt: newDate ? newDate.toISOString() : null,
    })

    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: newDate ? newDate.toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to reschedule")
      toast.success(newDate ? "Rescheduled" : "Moved to drafts")
    } catch {
      // rollback
      patchPost(post.id, { scheduledAt: original.scheduledAt })
      toast.error("Failed to reschedule")
    }
  }

  // Save edits via existing API
  async function handleSave() {
    if (!editing) return
    setSaving(true)

    const payload: Record<string, unknown> = {
      platform: editPlatform || editing.platform,
      caption: editCaption?.trim() ?? "",
      status: editStatus || editing.status,
      socialAccountId: editSocialAccountId || null,
    }

    if (editScheduled) {
      // datetime-local is local time; convert to ISO (server expects parsable)
      const localDate = new Date(editScheduled)
      payload.scheduledAt = localDate.toISOString()
    } else {
      payload.scheduledAt = null
    }

    try {
      const res = await fetch(`/api/scheduled-posts/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to update")
      }

      const updated = await res.json()

      // Patch local (note: PUT response lacks full clip, keep existing)
      patchPost(editing.id, {
        platform: updated.platform,
        caption: updated.caption,
        scheduledAt: updated.scheduledAt ? new Date(updated.scheduledAt).toISOString() : null,
        status: updated.status,
        updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : editing.updatedAt,
      })

      toast.success("Scheduled post updated")
      // If we changed the date, keep or clear the day filter intelligently
      if (selectedDate && updated.scheduledAt) {
        const newD = new Date(updated.scheduledAt)
        if (!isSameDay(newD, selectedDate)) {
          setSelectedDate(newD)
        }
      }
      closeEditor()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  // Delete via API
  async function handleDelete() {
    if (!editing) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/scheduled-posts/${editing.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      removePost(editing.id)
      toast.success("Scheduled post deleted")
      closeEditor()
      // If we deleted the last item for the selected day, clear the filter
      if (selectedDate) {
        const stillHasOnDay = posts.some(
          (p) =>
            p.id !== editing.id &&
            p.scheduledAt &&
            isSameDay(new Date(p.scheduledAt), selectedDate)
        )
        if (!stillHasOnDay) setSelectedDate(null)
      }
    } catch {
      toast.error("Failed to delete post")
    } finally {
      setDeleting(false)
    }
  }

  // Reset all filters
  function resetFilters() {
    setSelectedDate(null)
    setPlatformFilter("all")
    setStatusFilter("all")
    setSearch("")
  }

  // Open the *dedicated* on-day schedule sheet (fixed date, always fresh)
  function scheduleOnDate(date: Date) {
    setSelectedDate(date)
    setOnDayDate(date)
    setOnDayOpen(false)
    requestAnimationFrame(() => {
      setTimeout(() => setOnDayOpen(true), 10)
    })
  }

  // Small playable video preview (much better than static)
  function VideoPreview({ clip, className }: { clip: Clip; className?: string }) {
    const url = clip.wasabiUrl
    const thumb = clip.thumbnailUrl
    return (
      <div className={cn("relative overflow-hidden rounded-md bg-black flex-shrink-0 border border-white/10 group/video", className)}>
        {thumb ? (
          <img
            src={thumb}
            alt={clip.hookText || "clip thumbnail"}
            className="h-full w-full object-cover"
          />
        ) : url ? (
          <video
            src={url}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
            onMouseLeave={(e) => {
              const v = e.currentTarget as HTMLVideoElement
              v.pause()
              // seek back near beginning on leave (best effort)
              if (v.duration) v.currentTime = 0.2
            }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-950 via-black to-zinc-900" />
        )}
        <div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-black/70 px-1 py-px text-[9px] font-mono text-white/80 tabular-nums leading-none">
          {formatDuration(clip.duration)}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-70 transition">
          <FontAwesomeIcon icon={faPlay} className="h-4 w-4 text-white drop-shadow" />
        </div>
      </div>
    )
  }

  // Render a row/item for the list — now with video + quick reschedule
  function ScheduledItem({ post }: { post: ScheduledPost }) {
    const statusColor =
      post.status === "published"
        ? "default"
        : post.status === "failed"
        ? "destructive"
        : post.status === "scheduled"
        ? "secondary"
        : "outline"

    return (
      <div className="group flex flex-col gap-3 rounded-xl border bg-card p-3 transition-all hover:border-primary/60 hover:shadow-sm sm:flex-row sm:items-center sm:gap-4">
        {/* Clickable video area */}
        <div onClick={() => openEditor(post)} className="cursor-pointer">
          <VideoPreview clip={post.clip} className="h-14 w-9 sm:h-16 sm:w-10" />
        </div>

        {/* Main content (clickable) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openEditor(post)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openEditor(post)
            }
          }}
          className="min-w-0 flex-1 space-y-1 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {post.clip.hookText ? `“${post.clip.hookText}”` : "Scheduled clip"}
            </p>
            <Badge
              variant={statusColor}
              className="shrink-0 capitalize text-[10px] px-1.5 py-0.5"
            >
              {post.status}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] font-medium", getPlatformBadgeClass(post.platform))}>
              {PLATFORM_LABEL[post.platform] ?? post.platform}
            </span>
            <span className="inline-flex items-center gap-1">
              <FontAwesomeIcon icon={faClock} className="h-3 w-3" />
              {formatScheduled(post.scheduledAt)}
            </span>
            <span className="text-[10px] opacity-60">· {formatDuration(post.clip.duration)}</span>
            {post.caption && (
              <span className="hidden sm:inline text-[10px] italic opacity-70 truncate max-w-[180px]">
                “{post.caption.slice(0, 60)}{post.caption.length > 60 ? "…" : ""}”
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-center text-[10px]">
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              quickReschedule(post, post.scheduledAt ? addDays(new Date(post.scheduledAt), 1) : addDays(new Date(), 1))
            }}
          >
            +1d
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              quickReschedule(post, addWeeks(new Date(), 1))
            }}
          >
            +1w
          </Button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEditor(post)
            }}
            className="rounded-md border px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  // Helper to get a nice tiny dot color per platform
  function getPlatformDotClass(platform: string) {
    switch (platform) {
      case "instagram": return "bg-pink-500"
      case "tiktok": return "bg-white border border-black"
      case "youtube": return "bg-red-500"
      case "x": return "bg-black dark:bg-white"
      default: return "bg-muted-foreground"
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Full-screen Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))} className="h-8 w-8">
            <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-xl min-w-[170px] text-center tabular-nums tracking-tight">
            {format(month, "MMMM yyyy")}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))} className="h-8 w-8">
            <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="ml-1 h-8"
            onClick={() => {
              setMonth(new Date())
              setSelectedDate(null)
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border p-0.5 text-xs">
            <button
              onClick={() => setViewMode("month")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition ${viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition ${viewMode === "agenda" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <FontAwesomeIcon icon={faList} className="h-3.5 w-3.5" /> List
            </button>
          </div>

          <Button 
            size="sm" 
            onClick={() => {
              setClipsToSchedule([])
              setScheduleOpen(false)
              requestAnimationFrame(() => setTimeout(() => setScheduleOpen(true), 10))
            }}
          >
            <FontAwesomeIcon icon={faCalendar} className="mr-1.5 h-4 w-4" />
            Schedule clips
          </Button>
        </div>
      </div>

      {/* Filters (search + platform + status) — compact for calendar */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative max-w-md">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hooks, captions..."
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status tabs */}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList variant="default" className="h-8">
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s} className="capitalize text-xs px-3">
                  {s}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Platform chips */}
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...PLATFORMS] as Platform[]).map((p) => {
              const active = platformFilter === p
              const label = p === "all" ? "All" : PLATFORM_LABEL[p] ?? p
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted/60 text-foreground border-border"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {(selectedDate || platformFilter !== "all" || statusFilter !== "all" || search) && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={resetFilters}>
              <FontAwesomeIcon icon={faTimes} className="mr-1 h-3 w-3" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Calendar Content */}
      {viewMode === "month" ? (
        <div className="flex flex-col lg:flex-row gap-4 min-h-[560px]">
          {/* THE FULL SCREEN CALENDAR GRID */}
          <div className="flex-1 min-w-0 min-w-[280px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-[10px] font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1 px-1 select-none">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                <div key={w} className="text-center py-1">{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded-2xl overflow-hidden border">
              {calendarDays.map((day) => {
                const key = format(day, "yyyy-MM-dd")
                const dayEvents = postsByDay.get(key) || []
                const isOutside = !isSameMonth(day, month)
                const isToday = isSameDay(day, new Date())
                const isSel = !!selectedDate && isSameDay(day, selectedDate)

                return (
                  <div
                    key={key}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "bg-background p-2 flex flex-col border-r border-b min-h-[118px] last:border-r-0 hover:bg-accent/40 transition-colors cursor-pointer group",
                      isOutside && "bg-muted/30 text-muted-foreground",
                      isSel && "ring-2 ring-primary ring-inset bg-accent/10 z-10",
                      isToday && !isSel && "bg-accent/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          "text-[13px] font-semibold tabular-nums leading-none pt-0.5",
                          isToday && "text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </span>

                      {dayEvents.length === 0 && !isOutside && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            scheduleOnDate(day)
                          }}
                          className="text-lg leading-none text-muted-foreground/50 hover:text-foreground px-0.5 -mt-0.5 rounded hover:bg-muted/70 opacity-0 group-hover:opacity-100 transition"
                          title="Schedule here"
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* Events inside the day cell */}
                    <div className="mt-1.5 space-y-px text-[10px] leading-tight flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((post) => (
                        <div
                          key={post.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditor(post)
                          }}
                          className="flex items-center gap-1.5 rounded px-1 py-0.5 bg-muted/70 hover:bg-primary hover:text-primary-foreground active:bg-primary transition truncate group/event"
                        >
                          {post.scheduledAt && (
                            <span className="font-mono text-[9px] tabular-nums text-muted-foreground/80 w-7 shrink-0 group-hover/event:text-primary-foreground/80">
                              {format(new Date(post.scheduledAt), "HH:mm")}
                            </span>
                          )}
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getPlatformDotClass(post.platform))} />
                          <span className="truncate">
                            {post.clip?.hookText ? post.clip.hookText : post.platform}
                          </span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="pl-1 text-[9px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                      )}
                    </div>

                    {dayEvents.length > 0 && (
                      <div className="text-right text-[9px] text-muted-foreground mt-auto pr-0.5 tabular-nums">
                        {dayEvents.length}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground px-1">
              Click day to focus it on the right. Click an item to edit. Hover days for + to schedule.
            </p>
          </div>

          {/* Right detail panel — shows posts for the selected day */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <div className="rounded-2xl border bg-card h-full p-4 flex flex-col">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">
                    {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Calendar"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedDate ? "Posts on this day" : "Select a day on the calendar"}
                  </div>
                </div>
                {selectedDate && (
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedDate(null)}>
                    Clear
                  </Button>
                )}
              </div>

              {selectedDate ? (
                (() => {
                  const dayKey = format(selectedDate, "yyyy-MM-dd")
                  const dayItems = calendarPosts.filter(
                    (p) => p.scheduledAt && format(new Date(p.scheduledAt), "yyyy-MM-dd") === dayKey
                  )
                  return dayItems.length > 0 ? (
                    <div className="space-y-2 overflow-auto flex-1 -mx-1 px-1">
                      {dayItems.map((post) => (
                        <ScheduledItem key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center text-sm text-muted-foreground">
                      No matching scheduled posts on this day.
                    </div>
                  )
                })()
              ) : (
                <div className="flex-1 text-sm text-muted-foreground">
                  Click any day in the calendar to see the scheduled clips for that day here.
                </div>
              )}

              {selectedDate && (
                <Button className="mt-4 w-full" variant="outline" size="sm" onClick={() => scheduleOnDate(selectedDate)}>
                  + Schedule on this day
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // AGENDA / LIST VIEW (kept as alternative)
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <EmptyState
              icon={({ className }) => <FontAwesomeIcon icon={faCalendar} className={className} />}
              title="No posts match"
              description="Adjust filters or schedule new clips."
              variant="compact"
            />
          ) : (
            <div className="space-y-6">
              {(() => {
                const groups = new Map<string, ScheduledPost[]>()
                filteredPosts.forEach((p) => {
                  const key = p.scheduledAt ? format(new Date(p.scheduledAt), "yyyy-MM-dd") : "unscheduled"
                  if (!groups.has(key)) groups.set(key, [])
                  groups.get(key)!.push(p)
                })
                return Array.from(groups.entries()).map(([key, groupPosts]) => {
                  const label = key === "unscheduled" ? "Unscheduled / Drafts" : format(new Date(key), "EEEE, MMM d")
                  return (
                    <div key={key}>
                      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
                        <span>{label}</span>
                        <span className="font-normal">({groupPosts.length})</span>
                      </div>
                      <div className="space-y-2">
                        {groupPosts.map((post) => (
                          <ScheduledItem key={post.id} post={post} />
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      )}

      {/* Edit scheduled post — side drawer */}
      <Sheet open={!!editing} onOpenChange={(open) => { if (!open) closeEditor() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCalendar} className="h-4 w-4" />
              Edit scheduled post
            </SheetTitle>
            <SheetDescription>
              {editing?.clip.hookText ? `“${editing.clip.hookText}”` : "Scheduled clip"}
            </SheetDescription>
          </SheetHeader>

          {editing && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Clip preview with video */}
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <VideoPreview clip={editing.clip} className="h-20 w-11" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium leading-snug line-clamp-3">
                    {editing.clip.hookText || "Approved clip"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{formatDuration(editing.clip.duration)}</span>
                    <span className="opacity-60">· {editing.clip.layout}</span>
                    <span className="opacity-60">· Score {editing.clip.viralityScore}/10</span>
                  </div>
                  {editing.clip.job && (
                    <div className="mt-1 text-[10px] text-muted-foreground/70">
                      From source video
                    </div>
                  )}
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Platform</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PLATFORMS.map((p) => {
                      const active = (editPlatform || editing.platform) === p
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditPlatform(p)}
                          className={[
                            "flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition-all",
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border text-foreground",
                          ].join(" ")}
                        >
                          {PLATFORM_LABEL[p]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Schedule date &amp; time</Label>
                  <Input
                    type="datetime-local"
                    value={editScheduled}
                    onChange={(e) => setEditScheduled(e.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Leave empty for draft (unscheduled).</p>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Caption / description</Label>
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    rows={3}
                    className="block w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                    placeholder="Optional caption for the post..."
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Status</Label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="block w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    suppressHydrationWarning
                  >
                    {["draft", "scheduled", "published", "failed"].map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>

                {/* Connected account picker */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Publish as (optional)</Label>
                  <select
                    value={editSocialAccountId || ""}
                    onChange={(e) => setEditSocialAccountId(e.target.value || null)}
                    className="block w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Use platform default / any connected</option>
                    {connectedAccounts
                      .filter((a) => a.platform === (editPlatform || editing.platform))
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.platformUsername}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Choose a specific connected account. You can connect more in Integrations.
                  </p>
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="p-4 pt-3 border-t gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={closeEditor}
              disabled={saving || deleting}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleting || !editing}
              className="flex-1 sm:flex-none"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting} className="flex-1 sm:flex-none">
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* General ScheduleSheet (used by top "Schedule clips" button) */}
      <ScheduleSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        clips={clipsToSchedule}
        availableClips={availableClips}
        defaultDate={selectedDate}
        onScheduled={handleNewScheduled}
      />

      {/* Dedicated full-screen modal for "Schedule on this day" — searchable + paginated table */}
      {onDayDate && (
        <ScheduleOnDaySheet
          open={onDayOpen}
          onOpenChange={setOnDayOpen}
          date={onDayDate}
          onScheduled={handleNewScheduled}
        />
      )}
    </div>
  )
}
