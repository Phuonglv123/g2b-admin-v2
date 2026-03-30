import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  className?: string
}

const StatCard = ({
  title,
  value,
  change,
  icon,
  className,
}: StatCardProps) => {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <div
      className={cn(
        "group rounded-xl bg-card border border-border/50 p-5 transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary/15">
            {icon}
          </div>
        )}
        {change !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-medium",
              isPositive && "bg-emerald-500/10 text-emerald-400",
              isNegative && "bg-red-500/10 text-red-400",
              !isPositive && !isNegative && "bg-muted text-muted-foreground"
            )}
          >
            {isPositive && "↗"}
            {isNegative && "↘"}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  )
}

export default StatCard
