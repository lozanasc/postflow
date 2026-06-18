"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipCard } from "@/components/jobs/clip-card"
import { ScheduleSheet, type SchedulableClip } from "@/components/schedule-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/empty-state"
import { toast } from "sonner"
import {
  SearchIcon,
  Grid3X3Icon,
  ListIcon,
  XIcon,
  CalendarIcon,
  CheckSquareIcon,
  CheckIcon,
  UploadIcon,
} from "lucide-react"

// Extended for Phase 3 filters (date + local state)
interface Clip {
  id: string
  wasabiUrl: string
  wasabiKey?: string | null
  duration: number
  viralityScore: number
  hookText: string
  layout: string
  approved: boolean
  start: number
  end: number
  createdAt?: string | Date
}

interface LibraryClipsProps {
  clips: Clip[]
  // Accept + forward handlers for select/schedule/approve (Phase 3)
  onSelect?: (id: string) => void
  onSchedule?: (id: string) => void
  onApprove?: (id: string) => void
}

type ViewMode = "grid" | "list"
type SortMode = "newest" | "oldest" | "virality-high" | "virality-low" | "duration-long" | "duration-short" | "hook-az"

export function LibraryClips({ clips: initialClips, onSelect, onSchedule, onApprove }: LibraryClipsProps) {
  const router = useRouter()

  // Local copy for optimistic mutations (approve/unapprove) + filter/sort
  const [localClips, setLocalClips] = useState<Clip[]>(() =>
    initialClips.map((c) => ({ ...c, createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined }))
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [clipsToSchedule, setClipsToSchedule] = useState<SchedulableClip[]>([])

  // Client filter state (Phase 3 full filter bar, mobile-first restrained)
  const [search, setSearch] = useState("")
  const [viralityMin, setViralityMin] = useState(0)
  const [viralityMax, setViralityMax] = useState(10)
  const [durMin, setDurMin] = useState(0)
  const [durMax, setDurMax] = useState(600)
  const [layoutFilter, setLayoutFilter] = useState<"all" | "single" | "dual">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState<SortMode>("newest")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  // Lifted playing state so only one video plays at a time across cards (library)
  const [playingClipId, setPlayingClipId] = useState<string | null>(null)

  // Keep local in sync when parent re-fetches (e.g. after external mutations)
  useEffect(() => {
    setLocalClips(
      initialClips.map((c) => ({ ...c, createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined }))
    )
    // Reset selection on data refresh to avoid stale ids
    setSelectedIds(new Set())
  }, [initialClips])

  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0

  function updateClip(id: string, patch: Partial<Clip>) {
    setLocalClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  // Real approve/unapprove with optimistic + API (supports curation even for "library" view)
  async function handleApprove(id: string) {
    const current = localClips.find((c) => c.id === id)
    if (!current) return
    const newApproved = !current.approved
    updateClip(id, { approved: newApproved })

    try {
      const res = await fetch(`/api/clips/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: newApproved }),
      })
      if (!res.ok) throw new Error("approve failed")
      toast.success(newApproved ? "Clip approved" : "Clip unapproved")
      onApprove?.(id)
    } catch {
      updateClip(id, { approved: current.approved })
      toast.error("Failed to update approval")
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    onSelect?.(id)
  }

  function selectAllVisible(visibleIds: string[]) {
    setSelectedIds(new Set(visibleIds))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function openScheduleForSingle(clipId: string) {
    const clip = localClips.find((c) => c.id === clipId)
    if (!clip) return
    const schedClip: SchedulableClip = {
      id: clip.id,
      hookText: clip.hookText,
      duration: clip.duration,
    }
    setClipsToSchedule([schedClip])
    setSheetOpen(true)
    onSchedule?.(clipId)
  }

  function openBulkSchedule() {
    if (selectedCount === 0) return
    const toSched: SchedulableClip[] = localClips
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ id: c.id, hookText: c.hookText, duration: c.duration }))
    setClipsToSchedule(toSched)
    setSheetOpen(true)
    // Forward first or just let sheet handle; parent onSchedule not bulk-specific
    if (onSchedule) selectedIds.forEach((id) => onSchedule(id))
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    // Optimistic for all to true
    ids.forEach((id) => updateClip(id, { approved: true }))

    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/clips/${id}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved: true }),
          })
        )
      )
      const succeeded = results.filter((r) => r.status === "fulfilled").length
      toast.success(`Approved ${succeeded} clip(s)`)
      ids.forEach((id) => onApprove?.(id))
    } catch {
      toast.error("Bulk approve partially failed — data refreshed")
    } finally {
      clearSelection()
      router.refresh()
    }
  }

  async function handleBulkUnapprove() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    ids.forEach((id) => updateClip(id, { approved: false }))

    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/clips/${id}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved: false }),
          })
        )
      )
      const succeeded = results.filter((r) => r.status === "fulfilled").length
      toast.success(`Unapproved ${succeeded} clip(s)`)
      ids.forEach((id) => onApprove?.(id))
    } catch {
      toast.error("Bulk unapprove partially failed")
    } finally {
      clearSelection()
      router.refresh()
    }
  }

  function handleScheduled(created: any[]) {
    clearSelection()
    setPlayingClipId(null)
    router.refresh()
  }

  function resetFilters() {
    setSearch("")
    setViralityMin(0)
    setViralityMax(10)
    setDurMin(0)
    setDurMax(600)
    setLayoutFilter("all")
    setDateFrom("")
    setDateTo("")
    setSort("newest")
  }

  // Derived: filtered + sorted list (instant client, per jobs-table pattern)
  const filtered = useMemo(() => {
    let result = [...localClips]

    // Text search on hookText (Phase 3)
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((c) => (c.hookText || "").toLowerCase().includes(q))
    }

    // Virality range/slider (native range + input sync)
    result = result.filter((c) => c.viralityScore >= viralityMin && c.viralityScore <= viralityMax)

    // Duration (min/max inputs)
    result = result.filter((c) => {
      const d = c.duration || 0
      return d >= durMin && d <= durMax
    })

    // Layout select
    if (layoutFilter !== "all") {
      result = result.filter((c) => c.layout === layoutFilter)
    }

    // Date filter (easy native date inputs)
    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime()
      result = result.filter((c) => {
        if (!c.createdAt) return true
        return new Date(c.createdAt).getTime() >= fromTs
      })
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59.999").getTime()
      result = result.filter((c) => {
        if (!c.createdAt) return true
        return new Date(c.createdAt).getTime() <= toTs
      })
    }

    // Sort dropdown
    result.sort((a, b) => {
      switch (sort) {
        case "newest":
          return (
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
        case "oldest":
          return (
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          )
        case "virality-high":
          return b.viralityScore - a.viralityScore
        case "virality-low":
          return a.viralityScore - b.viralityScore
        case "duration-long":
          return b.duration - a.duration
        case "duration-short":
          return a.duration - b.duration
        case "hook-az":
          return (a.hookText || "").localeCompare(b.hookText || "")
        default:
          return 0
      }
    })

    return result
  }, [localClips, search, viralityMin, viralityMax, durMin, durMax, layoutFilter, dateFrom, dateTo, sort])

  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered])

  const anyActiveFilter =
    search ||
    viralityMin > 0 ||
    viralityMax < 10 ||
    durMin > 0 ||
    durMax < 600 ||
    layoutFilter !== "all" ||
    dateFrom ||
    dateTo ||
    sort !== "newest"

  return (
    <>
      {/* Full filter bar (Phase 3: virality range/slider native, duration, layout select, hookText search, date if easy, sort) — restrained minimalist, mobile-first responsive */}
      <div className="mb-3 flex flex-col gap-3 rounded-xl border bg-background/50 p-3">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
          {/* Search on hookText */}
          <div className="w-full min-w-[180px] sm:w-64">
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Search hook</div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search hook text…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8"
              />
            </div>
          </div>

          {/* Virality range / slider using native inputs */}
          <div>
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Virality</div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={viralityMin}
                onChange={(e) => {
                  const v = Math.min(parseInt(e.target.value, 10), viralityMax)
                  setViralityMin(v)
                }}
                className="w-14 accent-primary"
                aria-label="Min virality"
              />
              <span className="w-4 text-center text-xs tabular-nums font-medium">{viralityMin}</span>
              <span className="text-muted-foreground/70">–</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={viralityMax}
                onChange={(e) => {
                  const v = Math.max(parseInt(e.target.value, 10), viralityMin)
                  setViralityMax(v)
                }}
                className="w-14 accent-primary"
                aria-label="Max virality"
              />
              <span className="w-4 text-center text-xs tabular-nums font-medium">{viralityMax}</span>
            </div>
          </div>

          {/* Duration (inputs) */}
          <div className="flex gap-1.5">
            <div>
              <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Dur min</div>
              <Input
                type="number"
                min={0}
                value={durMin}
                onChange={(e) => setDurMin(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="h-8 w-16 text-xs"
                aria-label="Minimum duration seconds"
              />
            </div>
            <div>
              <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">max</div>
              <Input
                type="number"
                min={0}
                value={durMax}
                onChange={(e) => setDurMax(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="h-8 w-16 text-xs"
                aria-label="Maximum duration seconds"
              />
            </div>
          </div>

          {/* Layout select */}
          <div>
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Layout</div>
            <select
              value={layoutFilter}
              onChange={(e) => setLayoutFilter(e.target.value as any)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              aria-label="Filter by layout"
              suppressHydrationWarning
            >
              <option value="all">All</option>
              <option value="single">Single</option>
              <option value="dual">Dual</option>
            </select>
          </div>

          {/* Date filter (easy native) */}
          <div className="flex gap-1.5">
            <div>
              <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">From</div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs w-[126px]"
              />
            </div>
            <div>
              <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">To</div>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs w-[126px]"
              />
            </div>
          </div>

          {/* Sort dropdown */}
          <div>
            <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              aria-label="Sort clips"
              suppressHydrationWarning
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="virality-high">Highest virality</option>
              <option value="virality-low">Lowest virality</option>
              <option value="duration-long">Longest</option>
              <option value="duration-short">Shortest</option>
              <option value="hook-az">Hook A–Z</option>
            </select>
          </div>

          {/* View toggle (grid/list) + reset */}
          <div className="ml-auto flex items-center gap-1.5 pt-4 sm:pt-0">
            <div className="flex rounded-lg border bg-background p-0.5">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Grid3X3Icon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <ListIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
            {anyActiveFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Selection header + count (select-all on current filtered view) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={hasSelection && selectedCount === visibleIds.length && visibleIds.length > 0}
              onChange={() => {
                if (hasSelection && selectedCount === visibleIds.length) {
                  clearSelection()
                } else {
                  selectAllVisible(visibleIds)
                }
              }}
              disabled={visibleIds.length === 0}
            />
            <span>
              {hasSelection ? `${selectedCount} selected` : "Select"} · {filtered.length} / {localClips.length} shown
            </span>
          </label>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {anyActiveFilter && <span>Filters active</span>}
          </div>
        </div>
      </div>

      {/* Bulk action bar (approve/unapprove selected, schedule selected — opens scheduling UI) */}
      {hasSelection && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm shadow-sm">
          <span className="mr-1 font-medium tabular-nums">{selectedCount} selected</span>

          <Button size="sm" onClick={handleBulkApprove}>
            <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkUnapprove}>
            Unapprove
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={openBulkSchedule}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            Schedule selected
          </Button>

          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <XIcon className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Results: grid or list (using variant on ClipCard) or EmptyState for no matches */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={search || anyActiveFilter ? "No clips match your filters" : "No clips"}
          description={
            search || anyActiveFilter
              ? "Try adjusting the virality range, search, dates, or layout."
              : "Upload videos to generate clips for curation and scheduling."
          }
          action={
            anyActiveFilter ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button variant="outline" nativeButton={false} render={<a href="/dashboard/upload" />}>
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload your first video
              </Button>
            )
          }
          variant="compact"
        />
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "flex flex-col gap-2"
          }
        >
          {filtered.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onApprove={handleApprove}
              onSchedule={openScheduleForSingle}
              playingClipId={playingClipId}
              onPlay={setPlayingClipId}
              // Phase 3 multi-select forwarding
              selectable
              selected={selectedIds.has(clip.id)}
              onToggleSelect={toggleSelect}
              // Grid/list
              variant={viewMode}
            />
          ))}
        </div>
      )}

      {/* ScheduleSheet (existing, used for single + bulk schedule selected; no changes here per no-creep rule) */}
      <ScheduleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        clips={clipsToSchedule}
        onScheduled={handleScheduled}
      />
    </>
  )
}

