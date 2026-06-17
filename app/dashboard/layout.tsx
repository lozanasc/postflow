import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { CommandPalette } from "@/components/command-palette"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Phase 2: real (render-time) running jobs count for header indicator
  const runningJobsCount = await db.job.count({
    where: { userId: session.user.id, status: { in: ["queued", "running"] } },
  })

  return (
    <ThemeProvider defaultTheme="system" storageKey="postflow-ui-theme">
      <SidebarProvider>
        <AppSidebar user={{ name: session.user.name ?? "User", email: session.user.email, avatar: session.user.image ?? "" }} />
        <SidebarInset>
          <AppHeader
            user={{ name: session.user.name, email: session.user.email }}
            runningJobsCount={runningJobsCount}
          />
          <div className="flex-1">
            {children}
          </div>
        </SidebarInset>
        <CommandPalette />
      </SidebarProvider>
    </ThemeProvider>
  )
}
