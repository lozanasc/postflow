"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { format, setHours, setMinutes } from "date-fns"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faClock, faPaperPlane, faSearch, faTimes, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export type Platform = "instagram" | "tiktok" | "youtube" | "x"

export interface SchedulableClip {
  id: string
  hookText?: string
  duration?: number
  thumbnailUrl?: string | null
}

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
]

interface ScheduleOnDaySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date
  onScheduled?: (created: any[]) => void
}

// Type for paginated clip from API
interface PaginatedClip extends SchedulableClip {
  viralityScore: number
  layout: string
  createdAt: string
}

export function ScheduleOnDaySheet({
  open,
  onOpenChange,
  date,
  onScheduled,
}: ScheduleOnDaySheetProps) {
  const [platform, setPlatform] = useState<Platform>("instagram")
  const [caption, setCaption] = useState("")
  const [time, setTime] = useState("09:00")
  const [isSaving, setIsSaving] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  // Table state - server paginated + searchable
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [clips, setClips] = useState<PaginatedClip[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedClips, setSelectedClips] = useState<Record<string, PaginatedClip>>({})

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const selectedCount = Object.keys(selectedClips).length
  const isMulti = selectedCount > 1

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch clips with pagination + search (avoids loading thousands at once)
  const fetchClips = useCallback(async (currentPage: number, currentSearch: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })
      if (currentSearch) params.set("search", currentSearch)

      const res = await fetch(`/api/clips?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load clips")
      const data = await res.json()

      setClips(data.clips || [])
      setTotal(data.total || 0)
    } catch (e) {
      toast.error("Failed to load clips")
      setClips([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Reset and fetch when modal opens or search/page changes
  useEffect(() => {
    if (!open) return

    // Fresh state every time
    setSelectedClips({})
    setSearch("")
    setDebouncedSearch("")
    setPage(1)
    setCaption("")
    setPlatform("instagram")
    setSelectedAccountId(null)
    setTime("09:00")

    fetchClips(1, "")

    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((d) => setConnectedAccounts(Array.isArray(d) ? d : []))
      .catch(() => setConnectedAccounts([]))
  }, [open, fetchClips])

  // Refetch when page or debounced search changes
  useEffect(() => {
    if (!open) return
    fetchClips(page, debouncedSearch)
  }, [page, debouncedSearch, open, fetchClips])

  // Keep selection across pages using full clip objects
  const toggleClip = (clip: PaginatedClip) => {
    setSelectedClips((prev) => {
      const next = { ...prev }
      if (next[clip.id]) {
        delete next[clip.id]
      } else {
        next[clip.id] = clip
      }
      return next
    })
  }

  const clearSelection = () => setSelectedClips({})

  // Get selected clips data for save (persisted across pages)
  const selectedClipsForSave = Object.values(selectedClips)

  function combineFixedDateTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(":").map((n) => parseInt(n, 10))
    return setMinutes(setHours(date, hours || 9), minutes || 0)
  }

  const scheduledAtPreview = React.useMemo(() => {
    const dt = combineFixedDateTime(time)
    return format(dt, "PPP 'at' p")
  }, [time, date])

  async function handleSave() {
    if (!platform) {
      toast.error("Please select a platform")
      return
    }
    if (selectedCount === 0) {
      toast.error("No clips selected")
      return
    }

    const scheduledAt = combineFixedDateTime(time)

    setIsSaving(true)
    const createdPosts: any[] = []
    let hadError = false

    try {
      for (const clip of selectedClipsForSave) {
        const res = await fetch("/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipId: clip.id,
            platform,
            caption: caption.trim(),
            scheduledAt: scheduledAt.toISOString(),
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
          ? "Clip scheduled"
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

  if (!open) return null

  // Full screen modal (not sidebar)
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-[1400px] h-[95vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <FontAwesomeIcon icon={faCalendar} className="h-5 w-5" />
              Schedule on {format(date, "EEEE, MMM d, yyyy")}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select clips using the searchable paginated table below. Date is locked.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <FontAwesomeIcon icon={faTimes} className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Searchable Paginated Table */}
          <div className="flex-1 border-r flex flex-col min-w-0">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clips by hook text..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {total} clips • Page {page} of {totalPages}
              </div>
              {selectedCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear {selectedCount} selected
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">Loading clips...</div>
              ) : clips.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No clips found.</div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={clips.length > 0 && clips.every(c => !!selectedClips[c.id])}
                          onChange={() => {
                            const allSelected = clips.every(c => !!selectedClips[c.id])
                            setSelectedClips(prev => {
                              const next = { ...prev }
                              clips.forEach(c => {
                                if (allSelected) delete next[c.id]
                                else next[c.id] = c
                              })
                              return next
                            })
                          }}
                        />
                      </th>
                      <th className="text-left py-2 px-3">Clip</th>
                      <th className="text-left py-2 px-3 w-20">Duration</th>
                      <th className="text-left py-2 px-3 w-20">Score</th>
                      <th className="text-left py-2 px-3 w-20">Layout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clips.map((clip) => {
                      const selected = !!selectedClips[clip.id]
                      return (
                        <tr
                          key={clip.id}
                          className={`border-b hover:bg-muted/40 cursor-pointer ${selected ? "bg-primary/5" : ""}`}
                          onClick={() => toggleClip(clip)}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleClip(clip)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-3">
                              {clip.thumbnailUrl ? (
                                <img
                                  src={clip.thumbnailUrl}
                                  alt=""
                                  className="h-9 w-6 rounded object-cover flex-shrink-0 border"
                                />
                              ) : (
                                <div className="h-9 w-6 rounded bg-muted flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[420px]">
                                  {clip.hookText || "Untitled clip"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground tabular-nums">
                            {clip.duration ? `${clip.duration.toFixed(0)}s` : "—"}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {clip.viralityScore}/10
                          </td>
                          <td className="py-2 px-3 text-muted-foreground capitalize">
                            {clip.layout}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div className="border-t p-3 flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3 mr-1" />
                  Prev
                </Button>
                <span className="px-2 tabular-nums">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                  <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Schedule form (sticky) */}
          <div className="w-96 flex-shrink-0 p-6 overflow-auto space-y-5 border-l bg-muted/20">
            <div>
              <div className="text-sm font-medium mb-1">Selected clips</div>
              <div className="text-2xl font-semibold tabular-nums">{selectedCount}</div>
              <p className="text-xs text-muted-foreground">on {format(date, "MMM d")}</p>
            </div>

            {/* Platform */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Platform</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_OPTIONS.map((opt) => {
                  const active = platform === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPlatform(opt.value)}
                      className={`flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time (date fixed) */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <FontAwesomeIcon icon={faClock} className="h-3 w-3" /> Time on this day
              </Label>
              <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                  disabled={isSaving}
                />
                <div className="text-xs text-muted-foreground">{scheduledAtPreview.split(" at ")[1]}</div>
              </div>
            </div>

            {/* Caption */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Caption</Label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Optional caption for these clips..."
                rows={4}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-y focus-visible:ring-2 focus-visible:ring-ring/50"
                disabled={isSaving}
              />
            </div>

            {/* Account */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Publish using</Label>
              <select
                value={selectedAccountId || ""}
                onChange={(e) => setSelectedAccountId(e.target.value || null)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring/50"
                disabled={isSaving}
              >
                <option value="">Any connected account for {platform}</option>
                {connectedAccounts
                  .filter((a) => a.platform === platform)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.platformUsername}</option>
                  ))}
              </select>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving || selectedCount === 0 || !platform}
                className="w-full"
                size="lg"
              >
                {isSaving ? "Scheduling..." : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} className="mr-2 h-4 w-4" />
                    Schedule {selectedCount} clip{selectedCount !== 1 ? "s" : ""} on this day
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                This will create draft scheduled posts for the selected day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
