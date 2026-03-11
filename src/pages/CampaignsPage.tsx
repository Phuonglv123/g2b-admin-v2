import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  Calendar,
  Eye,
  MousePointer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/dashboard"

// Campaigns data
const campaigns = [
  {
    id: "CMP-001",
    name: "Summer Vibes 2026",
    client: "Coca-Cola",
    status: "active",
    startDate: "Mar 1, 2026",
    endDate: "Aug 31, 2026",
    budget: "$250,000",
    spent: "$85,000",
    impressions: "2.4M",
    clicks: "48.2K",
    progress: 34,
  },
  {
    id: "CMP-002",
    name: "Tech Launch Pro",
    client: "Apple Inc.",
    status: "active",
    startDate: "Feb 15, 2026",
    endDate: "May 15, 2026",
    budget: "$500,000",
    spent: "$320,000",
    impressions: "5.8M",
    clicks: "112K",
    progress: 64,
  },
  {
    id: "CMP-003",
    name: "Spring Fashion",
    client: "Nike",
    status: "paused",
    startDate: "Mar 10, 2026",
    endDate: "Jun 10, 2026",
    budget: "$180,000",
    spent: "$45,000",
    impressions: "890K",
    clicks: "23.1K",
    progress: 25,
  },
  {
    id: "CMP-004",
    name: "Auto Show 2026",
    client: "Tesla",
    status: "scheduled",
    startDate: "Apr 1, 2026",
    endDate: "Apr 30, 2026",
    budget: "$320,000",
    spent: "$0",
    impressions: "0",
    clicks: "0",
    progress: 0,
  },
  {
    id: "CMP-005",
    name: "Holiday Special",
    client: "Amazon",
    status: "completed",
    startDate: "Dec 1, 2025",
    endDate: "Dec 31, 2025",
    budget: "$420,000",
    spent: "$418,500",
    impressions: "8.2M",
    clicks: "245K",
    progress: 100,
  },
]

const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  active: { color: "bg-green-500/20 text-green-400", label: "Active", icon: <Play className="h-3 w-3" /> },
  paused: { color: "bg-yellow-500/20 text-yellow-400", label: "Paused", icon: <Pause className="h-3 w-3" /> },
  scheduled: { color: "bg-blue-500/20 text-blue-400", label: "Scheduled", icon: <Calendar className="h-3 w-3" /> },
  completed: { color: "bg-gray-500/20 text-gray-400", label: "Completed", icon: null },
}

const CampaignsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage and track your advertising campaigns
          </p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Campaigns</p>
          <p className="mt-1 text-3xl font-bold">86</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="mt-1 text-3xl font-bold text-green-400">42</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Impressions</p>
          <p className="mt-1 text-3xl font-bold">24.8M</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold text-primary">$1.2M</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            className="h-11 w-full sm:w-[300px] rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" className="rounded-xl">
            All Status
          </Button>
          <Button variant="outline" className="rounded-xl">
            All Clients
          </Button>
        </div>
      </div>

      {/* Campaigns Table */}
      <ChartCard title="All Campaigns" subtitle={`${campaigns.length} campaigns`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Campaign</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Duration</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Budget</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Performance</th>
                <th className="pb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Progress</th>
                <th className="pb-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="py-4">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">{campaign.client}</p>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[campaign.status].color}`}>
                      {statusConfig[campaign.status].icon}
                      {statusConfig[campaign.status].label}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="text-sm">
                      <p>{campaign.startDate}</p>
                      <p className="text-muted-foreground">{campaign.endDate}</p>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm">
                      <p className="font-medium">{campaign.budget}</p>
                      <p className="text-muted-foreground">Spent: {campaign.spent}</p>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        {campaign.impressions}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MousePointer className="h-4 w-4" />
                        {campaign.clicks}
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${campaign.progress}%` }}
                        />
                      </div>
                      <span className="text-sm">{campaign.progress}%</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

export default CampaignsPage
