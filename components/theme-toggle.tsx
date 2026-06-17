"use client"

import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const Icon = theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : MonitorIcon
  const nextLabel =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={cycle}
            aria-label={`Switch to ${nextLabel} theme`}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Icon className="size-4" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <TooltipContent side="bottom" className="text-xs">
        Theme: {theme === "system" ? "System" : theme.charAt(0).toUpperCase() + theme.slice(1)}
      </TooltipContent>
    </Tooltip>
  )
}
