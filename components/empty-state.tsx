import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  variant?: "default" | "compact"
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const isCompact = variant === "compact"

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed text-center",
        isCompact ? "py-10" : "py-16 sm:py-20",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <Icon
          className={cn(
            "text-muted-foreground",
            isCompact ? "h-6 w-6" : "h-8 w-8"
          )}
          aria-hidden="true"
        />
      )}
      <div className="space-y-1">
        <p
          className={cn(
            "font-medium text-foreground",
            isCompact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </p>
        {description && (
          <p
            className={cn(
              "text-muted-foreground",
              isCompact ? "text-xs" : "text-sm"
            )}
          >
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
