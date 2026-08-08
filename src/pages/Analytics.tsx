import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { useApp } from '@/context/AppContext'
import { PageHeader, StatCard } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Flame, Target, TrendingUp, Activity } from 'lucide-react'
import { platformColor } from '@/lib/utils'
import { themeAccent } from '@/lib/theme'

const tipStyle = {
  background: '#111113',
  border: '1px solid #27272a',
  borderRadius: 8,
  color: '#fafafa',
}
const tipItemStyle = { color: '#fafafa' }
const tipLabelStyle = { color: '#fafafa' }

export function AnalyticsPage() {
  const { state, settings, overall, todayStats } = useApp()
  const accents = themeAccent(settings.theme)

  const last14 = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), 13 - i)
      const key = format(d, 'yyyy-MM-dd')
      const hist = state.history.find((h) => h.date === key)
      const isToday = key === state.dailyProgress.date
      return {
        date: format(d, 'MMM d'),
        completion: isToday ? overall.percent : hist?.completionPercent ?? 0,
        score: isToday ? overall.percent : hist?.productivityScore ?? 0,
        connections: isToday ? todayStats.connections : hist?.connections ?? 0,
        followUps: isToday ? todayStats.followUps : hist?.followUps ?? 0,
        facebook: isToday
          ? todayStats.facebookComments + todayStats.facebookDms
          : (hist?.facebookComments ?? 0) + (hist?.facebookDms ?? 0),
        proposals: isToday ? todayStats.proposalsSent : hist?.proposalsSent ?? 0,
      }
    })
    return days
  }, [state.history, state.dailyProgress.date, overall.percent, todayStats])

  const weeklyConsistency = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days.map((day, i) => {
      const entries = state.history.filter((h) => parseISO(h.date).getDay() === i)
      const avg =
        entries.length > 0
          ? Math.round(entries.reduce((s, e) => s + e.completionPercent, 0) / entries.length)
          : 0
      return { day, avg }
    })
  }, [state.history])

  const monthlyCompletion = useMemo(() => {
    const map = new Map<string, number[]>()
    state.history.forEach((h) => {
      const m = h.date.slice(0, 7)
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(h.completionPercent)
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, vals]) => ({
        month: format(parseISO(`${month}-01`), 'MMM'),
        avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
      }))
  }, [state.history])

  const platformRevenue = useMemo(() => {
    const cats = settings.revenueCategories
    return cats
      .map((p) => ({
        name: p,
        value: state.revenue.filter((r) => r.platform === p).reduce((s, r) => s + r.amount, 0),
      }))
      .filter((d) => d.value > 0)
  }, [state.revenue, settings.revenueCategories])

  const avgWeekly =
    last14.length > 0
      ? Math.round(last14.slice(-7).reduce((s, d) => s + d.completion, 0) / 7)
      : 0

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Beautiful insights into your consistency and output" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Today Completion" value={overall.percent} suffix="%" icon={Target} color={accents.primary} />
        <StatCard title="Weekly Avg" value={avgWeekly} suffix="%" icon={TrendingUp} color={accents.secondary} delay={0.05} />
        <StatCard title="Current Streak" value={settings.streak} icon={Flame} color="#f59e0b" delay={0.1} />
        <StatCard title="Days Tracked" value={state.history.length} icon={Activity} color="#a855f7" delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Daily Completion %">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last14}>
              <defs>
                <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accents.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accents.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} domain={[0, 100]} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Area type="monotone" dataKey="completion" stroke={accents.primary} fill="url(#compGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly Productivity Score">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last14.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} domain={[0, 100]} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Line type="monotone" dataKey="score" stroke={accents.secondary} strokeWidth={2} dot={{ fill: accents.secondary }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Connections Sent">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Bar dataKey="connections" fill={accents.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Follow-ups Completed">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Bar dataKey="followUps" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Facebook Activity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Area type="monotone" dataKey="facebook" stroke="#a855f7" fill="#a855f733" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Upwork Proposals">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Bar dataKey="proposals" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly Consistency">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyConsistency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} domain={[0, 100]} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              <Bar dataKey="avg" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Completion %">
          {monthlyCompletion.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Complete more days to unlock monthly trends
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyCompletion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                <YAxis stroke="#71717a" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
                <Line type="monotone" dataKey="avg" stroke="#ec4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Platform">
          {platformRevenue.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No revenue data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                  {platformRevenue.map((e) => (
                    <Cell key={e.name} fill={platformColor(e.name)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} labelStyle={tipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Current Streak Pulse">
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <p className="text-5xl font-bold text-warning">{settings.streak}</p>
            <p className="text-sm text-muted-foreground">day streak</p>
            <p className="text-xs text-muted-foreground">Longest: {settings.longestStreak} days</p>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">{children}</CardContent>
    </Card>
  )
}
