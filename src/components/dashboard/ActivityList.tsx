import { cn } from "@/lib/utils"

interface ActivityItemProps {
  title: string
  description: string
  time: string
  status?: "success" | "warning" | "error" | "info"
}

const statusColors = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
}

const ActivityItem = ({
  title,
  description,
  time,
  status = "info",
}: ActivityItemProps) => {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="relative mt-1">
        <div className={cn("h-2.5 w-2.5 rounded-full", statusColors[status])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  )
}

interface ActivityListProps {
  items: ActivityItemProps[]
  className?: string
}

const ActivityList = ({ items, className }: ActivityListProps) => {
  return (
    <div className={cn("divide-y", className)}>
      {items.map((item, index) => (
        <ActivityItem key={index} {...item} />
      ))}
    </div>
  )
}

export { ActivityList, ActivityItem }
export type { ActivityItemProps }
