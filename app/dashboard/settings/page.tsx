import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserIcon, BellIcon, PaletteIcon, ShieldIcon, CalendarIcon, LogOutIcon, VideoIcon, CheckCircleIcon } from "lucide-react"
import { StatCard } from "@/components/stat-card"

async function updateProfileAction(formData: FormData) {
  "use server"
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return

  const name = (formData.get("name") || "").toString().trim()
  if (!name) return

  await db.user.update({
    where: { id: session.user.id },
    data: { name, updatedAt: new Date() },
  })

  revalidatePath("/dashboard/settings")
  // Note: better-auth session may require re-login or full reload for header/sidebar to reflect immediately
}

async function saveNotificationPrefsAction(formData: FormData) {
  "use server"
  // Stub — in real would persist to User prefs or separate table.
  // Revalidate so UI can show "saved" state if extended.
  revalidatePath("/dashboard/settings")
}

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const userId = session.user.id

  // Lightweight aggregates for "account snapshot" in settings (Phase 1/2 primitives)
  const [totalJobs, approvedClips] = await Promise.all([
    db.job.count({ where: { userId } }),
    db.clip.count({ where: { job: { userId }, approved: true } }),
  ])

  const created = session.user.createdAt ? new Date(session.user.createdAt as any) : null

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <PageHeader
        title="Settings"
        description="Manage your account, preferences, and billing access."
      />

      {/* Quick usage snapshot using StatCard primitives (mobile-first grid) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Jobs processed"
          value={totalJobs}
          icon={VideoIcon}
          description="total uploads &amp; runs"
        />
        <StatCard
          title="Approved clips"
          value={approvedClips}
          icon={CheckCircleIcon}
          description="ready for publishing"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Profile — now fleshed with editable name via server action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4" /> Profile
            </CardTitle>
            <CardDescription className="text-xs">Basic account information. Name updates persist.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfileAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
                <Input id="name" name="name" defaultValue={session.user.name ?? ""} className="h-8" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={session.user.email} disabled className="h-8 bg-muted/50" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" variant="default">Save profile</Button>
                <span className="text-[10px] text-muted-foreground">Updates reflected after save (may require page refresh for nav)</span>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preferences — theme uses global primitive; notifs stub with form action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PaletteIcon className="h-4 w-4" /> Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div>Theme</div>
                <div className="text-xs text-muted-foreground">Global — also available in header</div>
              </div>
              <ThemeToggle />
            </div>

            <form action={saveNotificationPrefsAction} className="space-y-3 pt-1">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-sm">
                  <BellIcon className="h-4 w-4" /> Notifications (stub)
                </div>
                <div className="space-y-2 pl-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="emailJobComplete" defaultChecked className="accent-primary" /> Email on job complete
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="emailClipApproved" defaultChecked className="accent-primary" /> Email when clips ready
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="weeklySummary" className="accent-primary" /> Weekly summary
                  </label>
                </div>
              </div>
              <Button type="submit" variant="outline" size="sm">Save notification prefs</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Account management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldIcon className="h-4 w-4" /> Account management
          </CardTitle>
          <CardDescription className="text-xs">Security and session controls. Full self-serve coming later.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground text-xs">Member since</div>
            <div className="font-medium flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {created ? created.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="text-xs text-muted-foreground">Sign out and session management live in the sidebar user menu.</div>
            <Button variant="outline" size="sm" disabled className="self-start sm:self-end">
              <LogOutIcon className="mr-1.5 h-3.5 w-3.5" /> Sign out everywhere (stub)
            </Button>
            <Button variant="destructive" size="sm" disabled className="self-start sm:self-end">
              Delete account (destructive — stub)
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Settings surfaces use Phase 1/2 primitives (PageHeader, StatCard, Card, Button, Input, ThemeToggle). Profile name persists to DB. Other actions are intentionally stubbed or mocked.
      </p>
    </div>
  )
}
