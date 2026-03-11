import { cn } from "@/lib/utils"

interface DonutChartProps {
  data: {
    label: string
    value: number
    color: string
  }[]
  centerValue: string
  centerLabel: string
  className?: string
}

const DonutChart = ({ data, centerValue, centerLabel, className }: DonutChartProps) => {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  // Calculate stroke-dasharray and stroke-dashoffset for each segment
  const { segments } = data.reduce(
    (acc, item) => {
      const percent = (item.value / total) * 100
      const dashArray = `${percent} ${100 - percent}`
      const dashOffset = 25 - acc.cumulativePercent // Start from top (25 = 90 degrees offset)

      return {
        cumulativePercent: acc.cumulativePercent + percent,
        segments: [...acc.segments, { ...item, percent, dashArray, dashOffset }],
      }
    },
    {
      cumulativePercent: 0,
      segments: [] as Array<{ label: string; value: number; color: string; percent: number; dashArray: string; dashOffset: number }>,
    }
  )

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* SVG Donut */}
      <div className="relative">
        <svg className="h-48 w-48 -rotate-90 transform" viewBox="0 0 36 36">
          {segments.map((segment, index) => (
            <circle
              key={index}
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={segment.color}
              strokeWidth="3"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{centerValue}</span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-2 w-full">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className="text-sm font-medium">
              {Math.round((item.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DonutChart
