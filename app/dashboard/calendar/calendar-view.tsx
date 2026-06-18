"use client"

import { useState, useMemo, useEffect } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"
import { format, isSameDay, startOfDay, addDays, addWeeks } from "date-fns"
import { toast } from "sonner"
import {
  CalendarIcon,
  ClockIcon,
  Trash2Icon,
  SaveIcon,
  XIcon,
  FilterIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  SearchIcon,
  PlayIcon,
} from "lucide-react"

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

// Types matching serialized server data
interface Clip {
  id: string
  wasabiUrl: string
  wasabiKey?: string | null
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
}

export function CalendarView({ posts: initialPosts }: CalendarViewProps) {
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

  // Days that have at least one scheduled post (for modifier dots) — always based on full data
  const daysWithPosts = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((p) => {
      if (p.scheduledAt) {
        const d = new Date(p.scheduledAt)
        set.add(format(d, "yyyy-MM-dd"))
      }
    })
    return set
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

  // Has any scheduled (for empty states)
  const hasAnyScheduled = posts.some((p) => !!p.scheduledAt)

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

  // Small playable video preview (much better than static)
  function VideoPreview({ clip, className }: { clip: Clip; className?: string }) {
    const url = clip.wasabiUrl
    return (
      <div className={cn("relative overflow-hidden rounded-md bg-black flex-shrink-0 border border-white/10 group/video", className)}>
        {url ? (
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
          <PlayIcon className="h-4 w-4 text-white drop-shadow" />
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
              <ClockIcon className="h-3 w-3" />
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

  return (
    <div className="flex flex-col gap-6">
      {/* Responsive layout: stack on mobile, side-by-side on lg+ */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Calendar (shown in month mode) */}
        {viewMode === "month" && (
          <div className="lg:w-80 xl:w-[340px] shrink-0">
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    Month view
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {format(month, "MMMM yyyy")}
                  </div>
                </div>

                <DayPicker
                  month={month}
                  onMonthChange={setMonth}
                  onDayClick={handleDayClick}
                  modifiers={{
                    scheduled: (date) => daysWithPosts.has(format(date, "yyyy-MM-dd")),
                  }}
                  modifiersClassNames={{
                    scheduled: "rdp-day_scheduled",
                  }}
                  classNames={{
                    root: "rdp-root",
                    months: "flex flex-col sm:flex-row gap-4",
                    month: "space-y-3",
                    caption_label: "rdp-caption_label",
                    nav: "flex items-center gap-1 absolute right-0",
                    button_previous: "rdp-button_previous inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent text-muted-foreground",
                    button_next: "rdp-button_next inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent text-muted-foreground",
                    month_grid: "w-full border-collapse table-fixed",
                    weekdays: "grid grid-cols-7 text-center mb-1",
                    weekday: "rdp-weekday text-center",
                    week: "grid grid-cols-7",
                    day: "rdp-day text-center p-0.5",
                    day_button:
                      "rdp-day_button mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 aria-selected:bg-primary aria-selected:text-primary-foreground",
                    selected: "bg-primary text-primary-foreground",
                    today: "font-semibold text-primary",
                  }}
                  components={{
                    Chevron: (props) => {
                      if (props.orientation === "left") return <ChevronLeftIcon className="h-4 w-4" />
                      return <ChevronRightIcon className="h-4 w-4" />
                    },
                  }}
                  showOutsideDays
                  fixedWeeks
                />

                <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Has scheduled</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDate(null)
                      setMonth(new Date())
                    }}
                    className="hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Today
                  </button>
                </div>
              </CardContent>
            </Card>

            {selectedDate && (
              <div className="mt-2 text-xs px-1 flex items-center gap-2 text-muted-foreground">
                Filtering list to <span className="font-medium text-foreground">{format(selectedDate, "MMM d")}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedDate(null)}>
                  Clear day
                </Button>
              </div>
            )}
          </div>
        )}

        {/* List + filters */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Filters header + view switch + search */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                {selectedDate
                  ? `Posts on ${format(selectedDate, "MMM d, yyyy")}`
                  : "Upcoming & drafts"}
                <span className="font-normal text-muted-foreground">({filteredPosts.length})</span>
              </div>

              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="inline-flex rounded-lg border p-0.5 text-xs">
                  <button
                    onClick={() => setViewMode("month")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition ${viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" /> Month
                  </button>
                  <button
                    onClick={() => setViewMode("agenda")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition ${viewMode === "agenda" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <ListIcon className="h-3.5 w-3.5" /> Agenda
                  </button>
                </div>

                {(selectedDate || platformFilter !== "all" || statusFilter !== "all" || search) && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetFilters}>
                    <XIcon className="mr-1 h-3 w-3" /> Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search captions, hooks, or platforms..."
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1"
              />
            </div>

            {/* Status tabs (Phase 1 pattern) */}
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <TabsList variant="default" className="w-full sm:w-auto">
                {STATUSES.map((s) => (
                  <TabsTrigger key={s} value={s} className="capitalize text-xs">
                    {s}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Platform filter chips (mobile friendly, wrap) */}
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...PLATFORMS] as Platform[]).map((p) => {
                const active = platformFilter === p
                const label = p === "all" ? "All platforms" : PLATFORM_LABEL[p] ?? p
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
          </div>

          {/* The list — supports Month (flat) + Agenda (grouped by day) */}
          {filteredPosts.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title={
                selectedDate
                  ? `No posts on ${format(selectedDate, "MMM d")}`
                  : platformFilter !== "all" || statusFilter !== "all"
                  ? "No posts match filters"
                  : hasAnyScheduled
                  ? "No upcoming posts"
                  : "No scheduled posts yet"
              }
              description={
                selectedDate
                  ? "Try a different day or clear the day filter."
                  : "Clips you schedule will appear here with video previews, platforms, and dates."
              }
              action={
                !hasAnyScheduled ? (
                  <Button variant="outline" size="sm" onClick={() => (window.location.href = "/dashboard/library")}>
                    Go to Library
                  </Button>
                ) : undefined
              }
              variant="compact"
            />
          ) : viewMode === "agenda" ? (
            // Agenda view — grouped by day
            <div className="space-y-6">
              {(() => {
                const groups = new Map<string, ScheduledPost[]>()
                filteredPosts.forEach((p) => {
                  const key = p.scheduledAt
                    ? format(new Date(p.scheduledAt), "yyyy-MM-dd")
                    : "unscheduled"
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
          ) : (
            <div className="flex flex-col gap-2">
              {filteredPosts.map((post) => (
                <ScheduledItem key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* Helpful note */}
          <p className="text-[11px] text-muted-foreground/70 px-1">
            Click any day with a dot or any item to view &amp; edit (reschedule, change platform/status, caption). Changes sync to your queue.
          </p>
        </div>
      </div>

      {/* Edit scheduled post — side drawer */}
      <Sheet open={!!editing} onOpenChange={(open) => { if (!open) closeEditor() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
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
    </div>
  )
}
