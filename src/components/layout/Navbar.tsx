import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Bell,
  Search,
  Sun,
  Moon,
  CheckCheck,
  Trash2,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useClock, AnimatedNumber } from '@/components/shared'
import { UserAvatar } from '@/components/UserAvatar'
import { MobileMenuButton } from './Sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SearchResult } from '@/types'

interface NavbarProps {
  onMenuClick: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const now = useClock()
  const navigate = useNavigate()
  const { username } = useAuth()
  const {
    overall,
    settings,
    updateSettings,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    state,
  } = useApp()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!query.trim()) return [] as SearchResult[]
    const q = query.toLowerCase()
    const items: SearchResult[] = []

    state.revenue.forEach((r) => {
      if (
        r.client.toLowerCase().includes(q) ||
        r.platform.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      ) {
        items.push({
          id: r.id,
          type: 'revenue',
          title: `${r.platform} — $${r.amount}`,
          subtitle: `${r.client} · ${r.date}`,
          path: '/revenue',
        })
      }
    })

    state.history.forEach((h) => {
      if (h.date.includes(q) || h.notes.toLowerCase().includes(q)) {
        items.push({
          id: h.date,
          type: 'history',
          title: `${h.date} — ${h.completionPercent}%`,
          subtitle: `${h.tasksCompleted} tasks · Score ${h.productivityScore}`,
          path: '/history',
        })
      }
    })

    Object.values(state.dailyProgress.platforms).forEach((p) => {
      p.checklist.forEach((c) => {
        if (c.label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
          items.push({
            id: `${p.id}-${c.id}`,
            type: 'task',
            title: c.label,
            subtitle: p.name,
            path: '/planner',
          })
        }
      })
      p.counters.forEach((c) => {
        if (c.label.toLowerCase().includes(q)) {
          items.push({
            id: `${p.id}-${c.id}`,
            type: 'task',
            title: c.label,
            subtitle: `${p.name} · ${c.completed}/${c.target}`,
            path: '/tracker',
          })
        }
      })
    })

    state.dailyProgress.timeline.forEach((t) => {
      if (t.name.toLowerCase().includes(q)) {
        items.push({
          id: t.id,
          type: 'timeline',
          title: t.name,
          subtitle: `${t.startTime} · ${t.status}`,
          path: '/planner',
        })
      }
    })

    const settingsKeys = ['targets', 'timeline', 'theme', 'notifications', 'export', 'import', 'reset']
    settingsKeys.forEach((k) => {
      if (k.includes(q)) {
        items.push({
          id: k,
          type: 'settings',
          title: k.charAt(0).toUpperCase() + k.slice(1),
          subtitle: 'Settings',
          path: '/settings',
        })
      }
    })

    return items.slice(0, 12)
  }, [query, state])

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
        <MobileMenuButton onClick={onMenuClick} />

        <div className="hidden sm:flex flex-col">
          <span className="text-sm font-medium tabular-nums">{format(now, 'EEEE, MMM d')}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{format(now, 'h:mm:ss a')}</span>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 border border-border">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-sm font-semibold text-accent tabular-nums">
            <AnimatedNumber value={overall.percent} suffix="%" />
          </span>
        </div>

        <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} title="Search">
          <Search className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" onClick={requestNotificationPermission}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1">
              <DropdownMenuLabel className="px-1">Notifications</DropdownMenuLabel>
              <div className="flex gap-1">
                <button
                  onClick={markAllNotificationsRead}
                  className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                  title="Mark all read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={clearNotifications}
                  className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                  title="Clear"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={!n.read ? 'bg-accent/5' : ''}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate">{n.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{n.body}</span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          title="Toggle theme"
        >
          {settings.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <UserAvatar username={username} size="sm" className="hidden sm:block" />
      </header>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="sr-only">Search</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search revenue, history, tasks, timeline..."
                className="pl-9 h-11"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto p-2">
            {query && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No results found</p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                className="w-full flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 hover:bg-muted text-left cursor-pointer"
                onClick={() => {
                  setSearchOpen(false)
                  setQuery('')
                  navigate(r.path)
                }}
              >
                <span className="text-sm font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {r.type} · {r.subtitle}
                </span>
              </button>
            ))}
            {!query && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Search across revenue, history, tasks & settings
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
