import { useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"
import { cn } from "@/lib/utils"

const RootLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <Header sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
      <main
        className={cn(
          "min-h-screen pt-16 transition-all duration-300",
          sidebarCollapsed ? "pl-[72px]" : "pl-[260px]"
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default RootLayout
