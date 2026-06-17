import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Done",
  failed: "Failed",
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_LABEL[status] ?? status
  const variant = STATUS_VARIANT[status] ?? "secondary"

  return (
    <Badge
      variant={variant}
      className={cn("capitalize", className)}
      data-status={status}
    >
      {label}
    </Badge>
  )
}

export { STATUS_LABEL, STATUS_VARIANT }
