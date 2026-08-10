import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppProvider } from '@/context/AppContext'
import { DashboardPage } from '@/pages/Dashboard'
import { PlannerPage } from '@/pages/Planner'
import { TrackerPage } from '@/pages/Tracker'
import { RevenuePage } from '@/pages/Revenue'
import { AnalyticsPage } from '@/pages/Analytics'
import { HistoryPage } from '@/pages/History'
import { SettingsPage } from '@/pages/Settings'
import { AdminPage } from '@/pages/Admin'
import { LoginPage } from '@/pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <AppProvider>
              <AppLayout />
            </AppProvider>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="tracker" element={<TrackerPage />} />
          <Route path="revenue" element={<RevenuePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
