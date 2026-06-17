"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  UploadIcon, 
  SearchIcon, 
  BellIcon, 
  VideoIcon 
} from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

interface AppHeaderProps {
  user?: { name?: string | null; email?: string | null }
  runningJobsCount?: number
}

export function AppHeader({ user, runningJobsCount = 0 }: AppHeaderProps) {
  const pathname = usePathname()
  const { toggleSidebar, isMobile } = useSidebar()

  // Simple command trigger (wired to real cmdk later in phase)
  const openCommand = React.useCallback(() => {
    // Will be replaced by actual ⌘K dialog
    const event = new KeyboardEvent("keydown", { 
      key: "k", 
      metaKey: true, 
      bubbles: true 
    })
    document.dispatchEvent(event)
  }, [])

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        {/* Mobile: keep sidebar trigger accessible */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="md:hidden -ml-1"
            aria-label="Toggle navigation"
          >
            <VideoIcon className="h-4 w-4" />
          </Button>
        )}

        {/* Minimal brand / context (sidebar handles primary nav) */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-semibold tracking-tight">Postflow</span>
          </Link>
          <span className="hidden text-muted-foreground/60 sm:inline">·</span>
          <span className="hidden text-xs text-muted-foreground sm:inline truncate max-w-[120px]">
            {pathname?.split("/").filter(Boolean).pop() || "Dashboard"}
          </span>
        </div>

        <div className="flex-1" />

        {/* Command / Search trigger */}
        <button
          onClick={openCommand}
          className={cn(
            "hidden md:flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground",
            "hover:bg-muted/60 hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          )}
          aria-label="Open command menu (⌘K)"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Search clips, jobs...</span>
          <kbd className="ml-auto hidden rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </button>

        {/* New Upload — primary action, consistent with sidebar */}
        <Button
          size="sm"
          className="gap-1.5"
          nativeButton={false}
          render={<Link href="/dashboard/upload" />}
        >
          <UploadIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New Upload</span>
        </Button>

        {/* Live jobs indicator (Phase 2: real count from layout, links to running) */}
        {runningJobsCount > 0 && (
          <Link
            href="/dashboard/jobs"
            className="hidden sm:flex items-center gap-1.5 rounded-full border bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
            title={`${runningJobsCount} running job${runningJobsCount === 1 ? "" : "s"}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <VideoIcon className="h-3.5 w-3.5" />
            <span>{runningJobsCount}</span>
          </Link>
        )}

        {/* Theme toggle (Phase 1 foundation) */}
        <ThemeToggle />

        {/* Notifications stub */}
        <Button variant="ghost" size="icon-sm" aria-label="Notifications (coming soon)" disabled>
          <BellIcon className="h-4 w-4" />
        </Button>

        {/* User avatar area — keep lightweight; full menu stays in sidebar for now */}
        {user && (
          <div className="hidden items-center gap-2 pl-2 text-right text-xs md:flex">
            <div className="leading-none">
              <div className="font-medium truncate max-w-[110px]">{user.name || user.email}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
