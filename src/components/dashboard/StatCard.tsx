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
        "rounded-2xl bg-card border border-border p-5 transition-all hover:bg-card/80",
        className
      )}
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        {icon && (
          <div className="rounded-xl bg-secondary p-3 text-muted-foreground">
            {icon}
          </div>
        )}
        {/* Change Badge */}
        {change !== undefined && (
          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs font-medium",
              isPositive && "bg-green-500/20 text-green-400",
              isNegative && "bg-red-500/20 text-red-400",
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
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  )
}

export default StatCard
