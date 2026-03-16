import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Package,
  Megaphone,
  Settings,
  HelpCircle,
  LogOut,
  UserCog,
  Building2,
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  icon: typeof LayoutDashboard
  label: string
  to: string
  adminOnly?: boolean
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: Package, label: "Inventory", to: "/inventory" },
  // { icon: Megaphone, label: "Campaigns", to: "/campaigns" },
  { icon: Building2, label: "Customers", to: "/customers" },
  { icon: Truck, label: "Providers", to: "/providers" },
  // { icon: Users, label: "Clients", to: "/clients" },
  // { icon: BarChart3, label: "Analytics", to: "/analytics" },
  { icon: UserCog, label: "Users", to: "/users", adminOnly: true },
]

const bottomNavItems: NavItem[] = [
  { icon: Settings, label: "Settings", to: "/settings" },
  { icon: HelpCircle, label: "Support", to: "/support" },
]

const Sidebar = ({ collapsed }: SidebarProps) => {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  // Filter nav items based on role
  const filteredMainNavItems = mainNavItems.filter(
    item => !item.adminOnly || isAdmin
  )

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-lg font-bold text-white">MediaFlow</span>
            <p className="text-xs text-muted-foreground">Premium CRM</p>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredMainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border/50 px-3 py-4">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>

      {/* User Profile */}
      <div className="border-t border-border/50 p-4">
        <div className={cn(
          "flex items-center gap-3 rounded-xl p-2 hover:bg-secondary transition-colors cursor-pointer",
          collapsed && "justify-center"
        )}>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
            AM
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Alex Morgan</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
