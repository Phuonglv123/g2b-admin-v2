import { cn } from "@/lib/utils"

interface RevenueChartProps {
  className?: string
}

const RevenueChart = ({ className }: RevenueChartProps) => {
  // Sample data points for the chart
  const dataPoints = [
    { month: "Jan", value: 20 },
    { month: "Feb", value: 35 },
    { month: "Mar", value: 65 },
    { month: "Apr", value: 55 },
    { month: "May", value: 70 },
    { month: "Jun", value: 60 },
    { month: "Jul", value: 75 },
    { month: "Aug", value: 85 },
  ]

  const maxValue = Math.max(...dataPoints.map(d => d.value))
  const chartHeight = 200
  const chartWidth = 500
  const padding = { top: 20, right: 20, bottom: 40, left: 20 }

  // Calculate points for the line
  const points = dataPoints.map((point, index) => {
    const x = padding.left + (index / (dataPoints.length - 1)) * (chartWidth - padding.left - padding.right)
    const y = padding.top + (1 - point.value / maxValue) * (chartHeight - padding.top - padding.bottom)
    return { x, y, ...point }
  })

  // Create path string
  const linePath = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      
      // Create smooth curve using quadratic bezier
      const prev = points[index - 1]
      const cpX = (prev.x + point.x) / 2
      return `Q ${cpX} ${prev.y} ${point.x} ${point.y}`
    })
    .join(" ")

  // Create area path (line path + close to bottom)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(28, 100%, 50%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(28, 100%, 50%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={padding.left}
            y1={padding.top + (i / 4) * (chartHeight - padding.top - padding.bottom)}
            x2={chartWidth - padding.right}
            y2={padding.top + (i / 4) * (chartHeight - padding.top - padding.bottom)}
            stroke="hsl(220, 15%, 20%)"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="hsl(28, 100%, 50%)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="hsl(220, 20%, 13%)"
            stroke="hsl(28, 100%, 50%)"
            strokeWidth="2"
          />
        ))}

        {/* X-axis labels */}
        {points.map((point, index) => (
          <text
            key={index}
            x={point.x}
            y={chartHeight - 10}
            textAnchor="middle"
            className="text-[11px] fill-muted-foreground"
          >
            {point.month}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default RevenueChart
