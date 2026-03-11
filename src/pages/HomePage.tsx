import {
  LayoutGrid,
  Megaphone,
  DollarSign,
  PieChart,
  Rocket,
  Wrench,
  CreditCard,
  Filter,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatCard, ChartCard, DonutChart, RevenueChart } from "@/components/dashboard"

// Sample data for stats - matching the design
const stats = [
  {
    title: "Total Media Slots",
    value: "1,240",
    change: 12,
    icon: <LayoutGrid className="h-5 w-5" />,
  },
  {
    title: "Active Campaigns",
    value: "86",
    change: 5,
    icon: <Megaphone className="h-5 w-5" />,
  },
  {
    title: "Monthly Revenue",
    value: "$428.5k",
    change: 18,
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    title: "Occupancy Rate",
    value: "78%",
    change: -2,
    icon: <PieChart className="h-5 w-5" />,
  },
]

// Donut chart data
const inventoryMixData = [
  { label: "Digital Displays", value: 55, color: "#f97316" },
  { label: "Billboards", value: 30, color: "#fbbf24" },
  { label: "Transit", value: 15, color: "#4b5563" },
]

// Activity data
const activities = [
  {
    icon: <Rocket className="h-4 w-4" />,
    iconBg: "bg-blue-500/20 text-blue-400",
    title: "New campaign launch",
    subtitle: '"Summer Vibes"',
    subtitleColor: "text-primary",
    time: "2 hours ago",
    author: "by Sarah J.",
  },
  {
    icon: <Wrench className="h-4 w-4" />,
    iconBg: "bg-yellow-500/20 text-yellow-400",
    title: "Maintenance scheduled for",
    subtitle: "Unit #4022",
    subtitleColor: "text-foreground",
    time: "5 hours ago",
    author: "System Auto",
  },
  {
    icon: <CreditCard className="h-4 w-4" />,
    iconBg: "bg-green-500/20 text-green-400",
    title: "Payment received from",
    subtitle: "",
    subtitleColor: "",
    time: "Yesterday",
    author: "",
  },
]

// Top locations data
const locations = [
  {
    name: "Times Square, NYC",
    type: "Digital XL",
    trend: 98,
    trendUp: true,
    revenue: "$124,500",
  },
  {
    name: "Sunset Blvd, LA",
    type: "Billboard",
    trend: 85,
    trendUp: false,
    revenue: "$89,200",
  },
]

const HomePage = () => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trends Chart */}
        <ChartCard
          title="Revenue Trends"
          subtitle="Comparison with previous period"
          className="lg:col-span-2"
          actions={
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              <Button variant="ghost" size="sm" className="rounded-full px-4 h-8 text-xs text-muted-foreground hover:text-foreground">
                Weekly
              </Button>
              <Button size="sm" className="rounded-full px-4 h-8 text-xs bg-primary text-white">
                Monthly
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full px-4 h-8 text-xs text-muted-foreground hover:text-foreground">
                Yearly
              </Button>
            </div>
          }
        >
          <RevenueChart />
        </ChartCard>

        {/* Inventory Mix - Donut Chart */}
        <ChartCard
          title="Inventory Mix"
          subtitle="Asset allocation by type"
        >
          <DonutChart
            data={inventoryMixData}
            centerValue="1,240"
            centerLabel="Total Units"
          />
        </ChartCard>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <ChartCard
          title="Recent Activity"
          actions={
            <Button variant="link" className="text-primary h-auto p-0 text-sm">
              View All
            </Button>
          }
        >
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={`rounded-full p-2.5 ${activity.iconBg}`}>
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {activity.title}{" "}
                    {activity.subtitle && (
                      <span className={activity.subtitleColor}>{activity.subtitle}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activity.time} {activity.author && `• ${activity.author}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Top Performing Locations */}
        <ChartCard
          title="Top Performing Locations"
          actions={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
          }
        >
          {/* Table Header */}
          <div className="grid grid-cols-5 gap-4 text-xs text-muted-foreground uppercase tracking-wider pb-3 border-b border-border">
            <span className="col-span-1">Location</span>
            <span>Type</span>
            <span>Trend</span>
            <span>Occupancy</span>
            <span className="text-right">Revenue</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-border">
            {locations.map((location, index) => (
              <div key={index} className="grid grid-cols-5 gap-4 py-4 items-center">
                <div className="col-span-1 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium truncate">{location.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">{location.type}</span>
                <div className="flex items-center gap-1">
                  <svg className="h-6 w-12" viewBox="0 0 48 24">
                    <path
                      d={location.trendUp 
                        ? "M2 20 L12 14 L24 16 L36 8 L46 4" 
                        : "M2 4 L12 10 L24 8 L36 16 L46 20"
                      }
                      fill="none"
                      stroke={location.trendUp ? "#22c55e" : "#ef4444"}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <span className="text-sm">{location.trend}%</span>
                <span className="text-sm font-semibold text-right">{location.revenue}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

export default HomePage