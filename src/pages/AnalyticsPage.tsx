import {
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  DollarSign,
  Users,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard, DonutChart, RevenueChart } from "@/components/dashboard"

// Performance metrics
const metrics = [
  {
    title: "Total Impressions",
    value: "24.8M",
    change: 12.5,
    icon: Eye,
    positive: true,
  },
  {
    title: "Total Clicks",
    value: "1.2M",
    change: 8.3,
    icon: MousePointer,
    positive: true,
  },
  {
    title: "Total Revenue",
    value: "$428.5K",
    change: 18.2,
    icon: DollarSign,
    positive: true,
  },
  {
    title: "New Clients",
    value: "156",
    change: -3.4,
    icon: Users,
    positive: false,
  },
]

// Channel performance data
const channelData = [
  { label: "Digital Displays", value: 45, color: "#f97316" },
  { label: "Billboards", value: 30, color: "#fbbf24" },
  { label: "Transit Ads", value: 15, color: "#22c55e" },
  { label: "Social Media", value: 10, color: "#3b82f6" },
]

// Top campaigns
const topCampaigns = [
  { name: "Summer Vibes", impressions: "5.2M", clicks: "124K", ctr: "2.38%", revenue: "$85,200" },
  { name: "Tech Launch", impressions: "3.8M", clicks: "98K", ctr: "2.58%", revenue: "$67,400" },
  { name: "Spring Fashion", impressions: "2.4M", clicks: "52K", ctr: "2.17%", revenue: "$42,100" },
  { name: "Auto Show", impressions: "1.9M", clicks: "41K", ctr: "2.16%", revenue: "$38,500" },
]

const AnalyticsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track performance metrics and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 Days
          </Button>
          <Button className="bg-primary text-white hover:bg-primary/90 rounded-xl">
            Export Report
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.title} className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-secondary p-3">
                <metric.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                metric.positive 
                  ? "bg-green-500/20 text-green-400" 
                  : "bg-red-500/20 text-red-400"
              }`}>
                {metric.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(metric.change)}%
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{metric.title}</p>
            <p className="mt-1 text-3xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Over Time */}
        <ChartCard
          title="Revenue Trend"
          subtitle="Monthly performance"
          className="lg:col-span-2"
          actions={
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              <Button variant="ghost" size="sm" className="rounded-full px-4 h-8 text-xs">
                Weekly
              </Button>
              <Button size="sm" className="rounded-full px-4 h-8 text-xs bg-primary text-white">
                Monthly
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full px-4 h-8 text-xs">
                Yearly
              </Button>
            </div>
          }
        >
          <RevenueChart />
        </ChartCard>

        {/* Channel Distribution */}
        <ChartCard title="Channel Performance" subtitle="Revenue by channel">
          <DonutChart
            data={channelData}
            centerValue="$428K"
            centerLabel="Total Revenue"
          />
        </ChartCard>
      </div>

      {/* Top Campaigns Table */}
      <ChartCard title="Top Performing Campaigns" subtitle="Based on revenue">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Campaign</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Impressions</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Clicks</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">CTR</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topCampaigns.map((campaign, index) => (
                <tr key={campaign.name} className="hover:bg-secondary/50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-sm font-medium text-primary">
                        {index + 1}
                      </span>
                      <span className="font-medium">{campaign.name}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-muted-foreground">{campaign.impressions}</td>
                  <td className="py-4 text-sm text-muted-foreground">{campaign.clicks}</td>
                  <td className="py-4">
                    <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
                      {campaign.ctr}
                    </span>
                  </td>
                  <td className="py-4 text-right font-semibold">{campaign.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

export default AnalyticsPage
