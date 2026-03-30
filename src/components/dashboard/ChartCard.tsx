import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

const ChartCard = ({
  title,
  subtitle,
  children,
  actions,
  className,
}: ChartCardProps) => {
  return (
    <div
      className={cn(
        "rounded-xl bg-card border border-border/50",
        className
      )}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  )
}

export default ChartCard
