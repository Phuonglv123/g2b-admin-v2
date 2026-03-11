import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/dashboard"

// Clients data
const clients = [
  {
    id: "CLT-001",
    name: "Coca-Cola Company",
    contact: "John Smith",
    email: "john.smith@coca-cola.com",
    phone: "+1 (404) 676-2121",
    campaigns: 12,
    totalSpend: "$1.2M",
    status: "active",
    avatar: "CC",
    avatarColor: "from-red-500 to-red-600",
  },
  {
    id: "CLT-002",
    name: "Apple Inc.",
    contact: "Sarah Johnson",
    email: "sarah.j@apple.com",
    phone: "+1 (408) 996-1010",
    campaigns: 8,
    totalSpend: "$2.8M",
    status: "active",
    avatar: "AP",
    avatarColor: "from-gray-600 to-gray-800",
  },
  {
    id: "CLT-003",
    name: "Nike Corporation",
    contact: "Michael Brown",
    email: "m.brown@nike.com",
    phone: "+1 (503) 671-6453",
    campaigns: 15,
    totalSpend: "$890K",
    status: "active",
    avatar: "NK",
    avatarColor: "from-orange-500 to-orange-600",
  },
  {
    id: "CLT-004",
    name: "Tesla Motors",
    contact: "Emily Davis",
    email: "emily.d@tesla.com",
    phone: "+1 (650) 681-5000",
    campaigns: 6,
    totalSpend: "$1.5M",
    status: "active",
    avatar: "TM",
    avatarColor: "from-red-600 to-red-700",
  },
  {
    id: "CLT-005",
    name: "Amazon.com",
    contact: "Robert Wilson",
    email: "r.wilson@amazon.com",
    phone: "+1 (206) 266-1000",
    campaigns: 22,
    totalSpend: "$3.4M",
    status: "active",
    avatar: "AZ",
    avatarColor: "from-yellow-500 to-orange-500",
  },
  {
    id: "CLT-006",
    name: "Microsoft Corp",
    contact: "Jennifer Lee",
    email: "j.lee@microsoft.com",
    phone: "+1 (425) 882-8080",
    campaigns: 4,
    totalSpend: "$620K",
    status: "inactive",
    avatar: "MS",
    avatarColor: "from-blue-500 to-blue-600",
  },
]

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    inactive: "bg-gray-500/20 text-gray-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

const ClientsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client relationships
          </p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Clients</p>
          <p className="mt-1 text-3xl font-bold">248</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Active Clients</p>
          <p className="mt-1 text-3xl font-bold text-green-400">186</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Campaigns</p>
          <p className="mt-1 text-3xl font-bold">524</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold text-primary">$12.4M</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients..."
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
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <ChartCard key={client.id} title="" className="!p-0">
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${client.avatarColor} flex items-center justify-center text-white font-bold`}>
                    {client.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{client.name}</p>
                    <p className="text-sm text-muted-foreground">{client.contact}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>

              {/* Contact Info */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {client.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {client.phone}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{client.campaigns} campaigns</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{client.totalSpend}</span>
                  </div>
                </div>
                {statusBadge(client.status)}
              </div>
            </div>
          </ChartCard>
        ))}
      </div>
    </div>
  )
}

export default ClientsPage
