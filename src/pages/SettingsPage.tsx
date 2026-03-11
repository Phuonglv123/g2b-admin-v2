import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  CreditCard,
  Key,
  Mail,
  Smartphone,
  Moon,
  Sun,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/dashboard"

const SettingsPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-card border border-border p-4 space-y-1">
            {[
              { icon: User, label: "Profile", active: true },
              { icon: Bell, label: "Notifications" },
              { icon: Shield, label: "Security" },
              { icon: Palette, label: "Appearance" },
              { icon: Globe, label: "Language & Region" },
              { icon: CreditCard, label: "Billing" },
              { icon: Key, label: "API Keys" },
            ].map((item) => (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                <ChevronRight className="ml-auto h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Section */}
          <ChartCard title="Profile Information" subtitle="Update your personal details">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-2xl font-bold text-white">
                  JD
                </div>
                <div>
                  <h3 className="font-semibold">John Doe</h3>
                  <p className="text-sm text-muted-foreground">Administrator</p>
                  <Button variant="outline" className="mt-2 rounded-xl text-xs h-8">
                    Change Avatar
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <input
                    type="text"
                    defaultValue="John"
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    type="text"
                    defaultValue="Doe"
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    defaultValue="john.doe@mediaflow.com"
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input
                    type="tel"
                    defaultValue="+1 (555) 123-4567"
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <Button className="rounded-xl bg-primary text-white hover:bg-primary/90">
                Save Changes
              </Button>
            </div>
          </ChartCard>

          {/* Notifications */}
          <ChartCard title="Notifications" subtitle="Manage your notification preferences">
            <div className="space-y-4">
              {[
                { icon: Mail, label: "Email Notifications", description: "Receive email updates about campaigns", enabled: true },
                { icon: Smartphone, label: "Push Notifications", description: "Get push notifications on your device", enabled: true },
                { icon: Bell, label: "Campaign Alerts", description: "Alerts when campaigns start or end", enabled: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-secondary/50 p-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-primary/20 p-2.5">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <button
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      item.enabled ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                        item.enabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Appearance */}
          <ChartCard title="Appearance" subtitle="Customize the look and feel">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Theme</label>
                <div className="mt-3 flex gap-3">
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary/50 p-4 border-2 border-transparent hover:border-primary transition-colors">
                    <Sun className="h-5 w-5" />
                    <span className="font-medium">Light</span>
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary/50 p-4 border-2 border-primary">
                    <Moon className="h-5 w-5" />
                    <span className="font-medium">Dark</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Accent Color</label>
                <div className="mt-3 flex gap-3">
                  {["#FF6D00", "#2563EB", "#10B981", "#8B5CF6", "#EC4899"].map((color) => (
                    <button
                      key={color}
                      className={`h-10 w-10 rounded-xl transition-transform hover:scale-110 ${
                        color === "#FF6D00" ? "ring-2 ring-white ring-offset-2 ring-offset-card" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
