import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/Dashboard'
import { PlannerPage } from '@/pages/Planner'
import { TrackerPage } from '@/pages/Tracker'
import { RevenuePage } from '@/pages/Revenue'
import { AnalyticsPage } from '@/pages/Analytics'
import { HistoryPage } from '@/pages/History'
import { SettingsPage } from '@/pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="tracker" element={<TrackerPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
