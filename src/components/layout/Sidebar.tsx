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
  FileUp,
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
  { icon: FileUp, label: "Import", to: "/import" },
  { icon: Building2, label: "Customers", to: "/customers" },
  { icon: Truck, label: "Providers", to: "/providers" },
  { icon: UserCog, label: "Users", to: "/users", adminOnly: true },
]

const bottomNavItems: NavItem[] = [
  { icon: Settings, label: "Settings", to: "/settings" },
  { icon: HelpCircle, label: "Support", to: "/support" },
]

const Sidebar = ({ collapsed }: SidebarProps) => {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const filteredMainNavItems = mainNavItems.filter(
    item => !item.adminOnly || isAdmin
  )

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return profile?.email?.[0]?.toUpperCase() || "U"
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-sidebar transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border/30">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20">
          <Megaphone className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <span className="text-base font-bold tracking-tight text-foreground">G2B Admin</span>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">OOH Platform</p>
          </div>
        )}
      </div>

      {/* Navigation Label */}
      {!collapsed && (
        <div className="px-5 pt-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Menu</p>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-2 overflow-y-auto">
        {filteredMainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      {!collapsed && (
        <div className="px-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">System</p>
        </div>
      )}
      <div className="px-3 pb-2">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User Profile */}
      <div className="border-t border-border/30 p-3">
        <div className={cn(
          "flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/80 transition-colors cursor-pointer",
          collapsed && "justify-center"
        )}>
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/80 to-orange-600 flex items-center justify-center text-white font-semibold text-xs shadow-md">
            {getInitials()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || "User"}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{profile?.role || "user"}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
