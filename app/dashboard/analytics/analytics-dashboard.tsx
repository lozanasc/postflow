"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { format, subDays, startOfDay, parseISO } from "date-fns"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { RefreshCwIcon, UploadIcon, BarChart2Icon, ClockIcon, TrendingUpIcon, CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"

type Range = "7d" | "30d" | "90d" | "all"

interface ClipData {
  id: string
  createdAt: string
  viralityScore: number
}

interface JobData {
  id: string
  createdAt: string
  // postcut is Prisma Json: { time_saved?: number, ... } or null
  postcut: unknown
}

interface PostData {
  id: string
  platform: string
  status: string
  createdAt: string
}

interface AnalyticsDashboardProps {
  clips: ClipData[]
  jobs: JobData[]
  posts: PostData[]
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
}

const PLATFORM_COLORS: string[] = ["#e1306c", "#000000", "#ff0000", "#1da1f2"]

export function AnalyticsDashboard({ clips: initialClips, jobs: initialJobs, posts: initialPosts }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<Range>("30d")

  const now = new Date()
  const cutoff = useMemo(() => {
    if (range === "all") return new Date(0)
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
    return startOfDay(subDays(now, days))
  }, [range, now])

  const filteredClips = useMemo(
    () => initialClips.filter((c) => parseISO(c.createdAt) >= cutoff),
    [initialClips, cutoff]
  )
  const filteredJobs = useMemo(
    () => initialJobs.filter((j) => parseISO(j.createdAt) >= cutoff),
    [initialJobs, cutoff]
  )
  const filteredPosts = useMemo(
    () => initialPosts.filter((p) => parseISO(p.createdAt) >= cutoff),
    [initialPosts, cutoff]
  )

  // Key metrics (from filtered)
  const totalClips = filteredClips.length
  const avgVirality =
    totalClips > 0
      ? (filteredClips.reduce((sum, c) => sum + c.viralityScore, 0) / totalClips).toFixed(1)
      : "0.0"

  const totalTimeSavedSeconds = filteredJobs.reduce((sum, j) => {
    const pc = j.postcut as any
    if (pc && typeof pc === "object" && "time_saved" in pc) {
      const ts = Number((pc as any).time_saved)
      return sum + (isNaN(ts) ? 0 : ts)
    }
    return sum
  }, 0)
  const totalHoursSaved = (totalTimeSavedSeconds / 3600).toFixed(1)

  const scheduledCount = filteredPosts.length

  // Jobs processed in range (for extra card)
  const jobsInRange = filteredJobs.length

  // ---- Chart data prep ----
  // 1. Clips over time (daily counts)
  const clipsOverTime = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of filteredClips) {
      const d = startOfDay(parseISO(c.createdAt))
      const key = d.toISOString().slice(0, 10)
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({
        date: format(new Date(key), "MMM d"),
        clips: count,
      }))
  }, [filteredClips])

  // 2. Virality distribution (0-10)
  const viralityDist = useMemo(() => {
    const counts = Array(11).fill(0)
    for (const c of filteredClips) {
      const s = Math.max(0, Math.min(10, Math.round(c.viralityScore)))
      counts[s] += 1
    }
    return counts.map((count, score) => ({ score: String(score), count }))
  }, [filteredClips])

  // 3. Platform breakdown (from scheduled posts)
  const platformData = useMemo(() => {
    const counts: Record<string, number> = { instagram: 0, tiktok: 0, youtube: 0, x: 0 }
    for (const p of filteredPosts) {
      const plat = (p.platform || "").toLowerCase()
      if (plat in counts) {
        counts[plat] += 1
      } else {
        counts[plat] = (counts[plat] || 0) + 1
      }
    }
    return Object.entries(counts).map(([plat, value], index) => ({
      name: PLATFORM_LABEL[plat] || plat,
      value,
      platform: plat,
      fill: PLATFORM_COLORS[index % PLATFORM_COLORS.length],
    }))
  }, [filteredPosts])

  // 4. Usage / hours saved over time (daily seconds -> hours from jobs' postcut)
  const savingsOverTime = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of filteredJobs) {
      const pc = j.postcut as any
      let ts = 0
      if (pc && typeof pc === "object" && "time_saved" in pc) {
        ts = Number((pc as any).time_saved) || 0
      }
      if (ts <= 0) continue
      const d = startOfDay(parseISO(j.createdAt))
      const key = d.toISOString().slice(0, 10)
      map.set(key, (map.get(key) || 0) + ts)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, secs]) => ({
        date: format(new Date(key), "MMM d"),
        hours: Math.round((secs / 3600) * 100) / 100,
      }))
  }, [filteredJobs])

  const hasAnyData = initialClips.length > 0 || initialJobs.length > 0 || initialPosts.length > 0
  const hasFilteredData = filteredClips.length > 0 || filteredJobs.length > 0 || filteredPosts.length > 0

  const rangeLabel =
    range === "7d" ? "last 7 days" : range === "30d" ? "last 30 days" : range === "90d" ? "last 90 days" : "all time"

  if (!hasAnyData) {
    return (
      <EmptyState
        icon={BarChart2Icon}
        title="No analytics data yet"
        description="Process videos to generate clips, then schedule them. Charts and metrics will appear here."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/upload" />}>
            <UploadIcon className="mr-2 h-4 w-4" />
            Upload a video
          </Button>
        }
        variant="default"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Time range controls (client filter) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground mr-1">Range:</span>
        {(["7d", "30d", "90d", "all"] as const).map((r) => {
          const label = r === "7d" ? "7d" : r === "30d" ? "30d" : r === "90d" ? "90d" : "All"
          return (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
              className="h-8 px-3 text-xs"
            >
              {label}
            </Button>
          )
        })}
        <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">Showing {rangeLabel}</span>
      </div>

      {/* Key metric cards (Phase 1/2 StatCard primitives) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clips"
          value={totalClips}
          icon={BarChart2Icon}
          description={`in ${rangeLabel}`}
        />
        <StatCard
          title="Avg Virality"
          value={`${avgVirality}/10`}
          icon={TrendingUpIcon}
          description="mean score (filtered)"
        />
        <StatCard
          title="Hours Saved"
          value={totalHoursSaved}
          icon={ClockIcon}
          description="dead air removed via post-cut"
        />
        <StatCard
          title="Scheduled Posts"
          value={scheduledCount}
          icon={CalendarIcon}
          description={`${jobsInRange} job${jobsInRange === 1 ? "" : "s"} processed`}
        />
      </div>

      {/* Charts */}
      {!hasFilteredData ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No activity in the {rangeLabel}. Try a wider range.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Clips over time */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart2Icon className="h-4 w-4" /> Clips Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clipsOverTime.length > 0 ? (
                <div className="h-[260px] w-full -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clipsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="clips" name="Clips" fill="#6366f1" radius={3} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
                  No clips generated in this period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Virality distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUpIcon className="h-4 w-4" /> Virality Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredClips.length > 0 ? (
                <div className="h-[260px] w-full -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={viralityDist}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="score" tick={{ fontSize: 11 }} label={{ value: "Score (0-10)", position: "insideBottom", offset: -5, fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Clips" fill="#10b981" radius={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
                  No clips with virality scores in range.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform breakdown (stub uses real ScheduledPost data) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Platform Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformData.some((p) => p.value > 0) ? (
                <div className="h-[260px] w-full -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        innerRadius={38}
                        label={({ name, value }) => (value > 0 ? `${name}: ${value}` : "")}
                      >
                        {platformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">No scheduled posts yet for platforms.</p>
                  <p className="text-[10px] text-muted-foreground">Breakdown from ScheduledPost (instagram / tiktok / youtube / x)</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage / hours saved chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClockIcon className="h-4 w-4" /> Time Saved (Hours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savingsOverTime.length > 0 ? (
                <div className="h-[260px] w-full -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={savingsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} h`, "Saved"]} />
                      <Line
                        type="monotone"
                        dataKey="hours"
                        name="Hours"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 2.5, fill: "#f59e0b" }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[160px] flex flex-col items-center justify-center gap-1 text-center">
                  <p className="text-sm text-muted-foreground">No post-cut time savings recorded in {rangeLabel}.</p>
                  <p className="text-[10px] text-muted-foreground">Comes from Job.postcut.time_saved after processing</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70 text-center -mt-2">
        Data aggregated server-side from Clip, Job, and ScheduledPost. Client-side range filter applied. All dates serialized.
      </p>
    </div>
  )
}
