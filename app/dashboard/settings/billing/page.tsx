import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CreditCardIcon,
  VideoIcon,
  ClockIcon,
  ScissorsIcon,
  TrendingDownIcon,
  ZapIcon,
} from "lucide-react"
import { revalidatePath } from "next/cache"

async function mockBillingAction(formData: FormData) {
  "use server"
  // Stub action for "Manage plan / payment method" — revalidates to simulate refresh
  revalidatePath("/dashboard/settings/billing")
}

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const userId = session.user.id

  const [totalJobs, totalClips, approvedClips, postcutJobs] = await Promise.all([
    db.job.count({ where: { userId } }),
    db.clip.count({ where: { job: { userId } } }),
    db.clip.count({ where: { job: { userId }, approved: true } }),
    db.job.findMany({
      where: { userId, postcut: { not: null as any } },
      select: { postcut: true },
    }),
  ])

  // Compute hours from post-cuts (PRD-aligned usage)
  let totalPostcutSeconds = 0
  for (const j of postcutJobs) {
    const pc = (j.postcut as any) || {}
    const dur = Number(pc.duration_original ?? pc.duration_cut ?? 0)
    if (dur > 0) totalPostcutSeconds += dur
  }
  const hoursProcessed = totalPostcutSeconds / 3600

  // Rough estimated editing hours saved (simple multiplier — auto post-cut + clip extraction removes manual labor)
  // Conservative: ~3 hours manual effort saved per hour of original long-form content
  const hoursSaved = Math.round(hoursProcessed * 3)

  // Rough cost savings using PRD numbers (per ~100h: $41 traditional vs ~$1.64 Modal → ~$39.36 savings proxy)
  const PRD_SAVINGS_PER_100H = 39.36
  const costSavings = Math.round(((hoursProcessed / 100) * PRD_SAVINGS_PER_100H) * 100) / 100

  // Simple plan usage bars (hardcoded Pro plan limits for visual demo — not enforced)
  const PLAN_JOB_LIMIT = 200
  const PLAN_CLIP_LIMIT = 1000
  const jobsUsagePct = Math.min(Math.round((totalJobs / PLAN_JOB_LIMIT) * 100), 100)
  const clipsUsagePct = Math.min(Math.round((totalClips / PLAN_CLIP_LIMIT) * 100), 100)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Billing"
        description="Your plan, usage, and estimated value from automated post-cuts &amp; clips."
      />

      {/* Plan info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ZapIcon className="h-4 w-4" /> Pro Plan
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">Billed monthly. Unlimited jobs &amp; clips on Pro (metered only on compute).</CardDescription>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold tabular-nums">$29</div>
              <div className="text-[10px] text-muted-foreground">/ month</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <form action={mockBillingAction}>
            <Button type="submit" variant="outline" size="sm">
              <CreditCardIcon className="mr-1.5 h-3.5 w-3.5" />
              Manage subscription (mock)
            </Button>
          </form>
          <form action={mockBillingAction}>
            <Button type="submit" variant="ghost" size="sm">
              Update payment method
            </Button>
          </form>
          <span className="ml-auto text-[10px] text-muted-foreground">Next invoice: — (demo)</span>
        </CardContent>
      </Card>

      {/* Core usage metrics using StatCard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total jobs"
          value={totalJobs}
          icon={VideoIcon}
          description="videos processed"
        />
        <StatCard
          title="Total clips"
          value={totalClips}
          icon={ScissorsIcon}
          description="short-form outputs"
        />
        <StatCard
          title="Hours processed"
          value={hoursProcessed > 0 ? hoursProcessed.toFixed(1) : "0"}
          icon={ClockIcon}
          description="from post-cuts (original)"
        />
        <StatCard
          title="Est. hours saved"
          value={hoursSaved}
          icon={TrendingDownIcon}
          description="manual editing time (×3 factor)"
        />
      </div>

      {/* Value / cost savings + usage bars */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estimated value delivered</CardTitle>
            <CardDescription className="text-xs">Rough savings based on PRD economics (traditional vs optimized pipeline)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-3xl font-semibold tabular-nums">${costSavings}</div>
              <div className="text-xs text-muted-foreground">approx. avoided API / editor costs (lifetime demo)</div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              PRD reference: ~$41 proprietary vs ~$1.64 optimized per 100 hours of long-form video. Your post-cuts + clips multiply the leverage.
            </div>
            <form action={mockBillingAction}>
              <Button type="submit" size="sm" variant="secondary">View detailed invoice history (stub)</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan usage (demo limits)</CardTitle>
            <CardDescription className="text-xs">Visual only — Pro has high ceilings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-1">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>Jobs</span>
                <span className="tabular-nums">{totalJobs} / {PLAN_JOB_LIMIT}</span>
              </div>
              <Progress value={jobsUsagePct} className="h-1.5" />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>Clips generated</span>
                <span className="tabular-nums">{totalClips} / {PLAN_CLIP_LIMIT}</span>
              </div>
              <Progress value={clipsUsagePct} className="h-1.5" />
            </div>

            <div className="rounded bg-muted/40 p-2 text-[10px] text-muted-foreground">
              Approved clips: {approvedClips} · Post-cuts: {postcutJobs.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        All numbers derived live from your Job / Clip / postcut data. Real billing &amp; quotas will be added with Stripe integration later.
      </p>
    </div>
  )
}
