import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarCheck,
  Target,
  DollarSign,
  BarChart3,
  History,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { ProgressRing } from '@/components/shared'
import { UserAvatar } from '@/components/UserAvatar'
import { BrandLogo } from '@/components/BrandLogo'
import { getUserProfile } from '@/lib/auth'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/planner', label: 'Daily Planner', icon: CalendarCheck },
  { to: '/tracker', label: 'Daily Tracker', icon: Target },
  { to: '/revenue', label: 'Revenue', icon: DollarSign },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  onOpen: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { overall, settings } = useApp()
  const { username, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const profile = getUserProfile(username)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const content = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <BrandLogo size="md" rounded="xl" className="brand-glow" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight truncate">CRM Dashboard</p>
          <p className="text-[11px] text-muted-foreground truncate">Business Development</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden rounded-lg p-1.5 hover:bg-muted text-muted-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg nav-active"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className={cn('relative h-4 w-4', active && 'text-primary')} />
              <span className="relative">{item.label}</span>
              {active && (
                <span className="relative ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <div className="rounded-xl bg-muted/60 border border-border p-4 flex items-center gap-3">
          <ProgressRing percent={overall.percent} size={48} strokeWidth={4}>
            <span className="text-[10px] font-semibold tabular-nums">{overall.percent}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-xs font-medium">Today&apos;s Progress</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {settings.streak} day streak
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-1 pb-1">
          <UserAvatar username={username} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{profile.displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate capitalize">@{username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30">
        {content}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border lg:hidden"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden rounded-lg p-2 hover:bg-muted text-muted-foreground cursor-pointer"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}
