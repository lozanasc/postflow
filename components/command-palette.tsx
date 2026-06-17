"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UploadIcon, VideoIcon, LibraryIcon, LayoutTemplateIcon, CalendarIcon, BarChart2Icon, Settings2Icon, HomeIcon, SearchIcon } from "lucide-react"

const NAV_ITEMS = [
  { icon: HomeIcon, label: "Dashboard", href: "/dashboard" },
  { icon: UploadIcon, label: "New Upload", href: "/dashboard/upload" },
  { icon: VideoIcon, label: "Jobs", href: "/dashboard/jobs" },
  { icon: LibraryIcon, label: "Library", href: "/dashboard/library" },
  { icon: LayoutTemplateIcon, label: "Templates", href: "/dashboard/templates" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: BarChart2Icon, label: "Analytics", href: "/dashboard/analytics" },
  { icon: Settings2Icon, label: "Settings", href: "/dashboard/settings" },
]

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
        if (!open) setQuery("")
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open])

  const filtered = NAV_ITEMS.filter(i => 
    i.label.toLowerCase().includes(query.toLowerCase())
  )

  const run = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[18vh]" onClick={() => setOpen(false)}>
      <div 
        className="w-full max-w-md rounded-xl border bg-popover p-2 shadow-2xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3 pb-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) run(filtered[0].href)
            }}
          />
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[320px] overflow-auto py-1 text-sm">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-muted-foreground text-xs">No matches</div>
          ) : (
            filtered.map(item => (
              <button
                key={item.href}
                onClick={() => run(item.href)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            ))
          )}
        </div>

        <div className="border-t pt-2 text-[10px] text-muted-foreground px-3">
          Phase 1 — ⌘K navigation. Full cmdk + clip search in later phases.
        </div>
      </div>
    </div>
  )
}
