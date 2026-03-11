import { Route, Routes } from "react-router-dom"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import RootLayout from "@/layouts/RootLayout"
import AnalyticsPage from "@/pages/AnalyticsPage"
import ClientsPage from "@/pages/ClientsPage"
import CustomersPage from "@/pages/CustomersPage"
import HomePage from "@/pages/HomePage"
import InventoryPage from "@/pages/InventoryPage"
import LoginPage from "@/pages/LoginPage"
import NotFoundPage from "@/pages/NotFoundPage"
import SettingsPage from "@/pages/SettingsPage"
import SupportPage from "@/pages/SupportPage"
import UsersPage from "@/pages/UsersPage"
import ProvidersPage from "@/pages/ProvidersPage"

const AppRouter = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected routes - All authenticated users */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="inventory" element={<InventoryPage />} />
          {/* <Route path="campaigns" element={<CampaignsPage />} /> */}
          <Route path="clients" element={<ClientsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>
      </Route>

      {/* Admin only routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<RootLayout />}>
          <Route path="users" element={<UsersPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter
