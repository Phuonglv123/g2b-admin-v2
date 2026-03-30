import { useState, useRef, useEffect } from "react"
import {
  Search,
  Bell,
  LogOut,
  Settings,
  User,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar?: () => void
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/import": "Import",
  "/customers": "Customers",
  "/providers": "Providers",
  "/users": "User Management",
  "/settings": "Settings",
  "/support": "Support",
  "/analytics": "Analytics",
  "/clients": "Clients",
}

const Header = ({ sidebarCollapsed, onToggleSidebar }: HeaderProps) => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

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

  const pageTitle = pageTitles[location.pathname] || "Dashboard"

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 flex h-16 items-center justify-between gap-4 px-6 transition-all duration-300 bg-background/80 backdrop-blur-xl border-b border-border/30",
        sidebarCollapsed ? "left-[72px]" : "left-[260px]"
      )}
    >
      {/* Left: Toggle + Title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-[200px] rounded-lg border border-border/60 bg-secondary/50 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:w-[280px] focus:border-primary/50 focus:bg-secondary"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-border/50" />

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary/80 transition-colors"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "User"}
                className="h-7 w-7 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/80 to-orange-600 flex items-center justify-center text-[11px] font-semibold text-white">
                {getInitials()}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium leading-none">
                {profile?.full_name || "User"}
              </p>
            </div>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              showDropdown && "rotate-180"
            )} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-card border border-border/60 shadow-2xl shadow-black/20 py-1.5 animate-scale-in origin-top-right">
              <div className="px-3.5 py-2.5 border-b border-border/40">
                <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
              </div>
              
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowDropdown(false)
                    navigate("/settings")
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-secondary/80 transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false)
                    navigate("/settings")
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-secondary/80 transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  Settings
                </button>
              </div>

              <div className="border-t border-border/40 pt-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
