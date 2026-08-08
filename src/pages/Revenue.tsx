import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { Plus, Trash2, DollarSign, TrendingUp, Award, BarChart3 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { PageHeader, StatCard, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, platformColor, todayKey, generateId } from '@/lib/utils'
import type { RevenuePlatform } from '@/types'

interface FormData {
  date: string
  platform: RevenuePlatform
  amount: number
  client: string
  notes: string
}

const COLORS = ['#E60000', '#FF1A1A', '#B30000', '#F59E0B', '#16A34A']

export function RevenuePage() {
  const { state, addRevenue, deleteRevenue, settings } = useApp()
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      date: todayKey(),
      platform: 'Fiverr',
      amount: 0,
      client: '',
      notes: '',
    },
  })

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthlyEntries = state.revenue.filter((r) => r.date.startsWith(monthPrefix))
  const totalRevenue = state.revenue.reduce((s, r) => s + r.amount, 0)
  const monthlyRevenue = monthlyEntries.reduce((s, r) => s + r.amount, 0)
  const largest = state.revenue.reduce((max, r) => Math.max(max, r.amount), 0)

  const months = eachMonthOfInterval({
    start: subMonths(startOfMonth(now), 11),
    end: endOfMonth(now),
  })

  const monthlyChart = months.map((m) => {
    const key = format(m, 'yyyy-MM')
    const amount = state.revenue.filter((r) => r.date.startsWith(key)).reduce((s, r) => s + r.amount, 0)
    return { month: format(m, 'MMM'), amount }
  })

  const platformChart = settings.revenueCategories.map((p) => ({
    name: p,
    value: state.revenue.filter((r) => r.platform === p).reduce((s, r) => s + r.amount, 0),
  })).filter((d) => d.value > 0)

  const yearlyTotal = state.revenue
    .filter((r) => r.date.startsWith(String(now.getFullYear())))
    .reduce((s, r) => s + r.amount, 0)

  const monthsWithRevenue = monthlyChart.filter((m) => m.amount > 0).length
  const avgMonthly = monthsWithRevenue > 0 ? Math.round(totalRevenue / Math.max(monthsWithRevenue, 1)) : 0

  const onSubmit = (data: FormData) => {
    addRevenue({
      date: data.date,
      platform: data.platform,
      amount: Number(data.amount),
      client: data.client,
      notes: data.notes,
    })
    reset({ date: todayKey(), platform: 'Fiverr', amount: 0, client: '', notes: '' })
    setOpen(false)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue"
        description="Track monthly income across all platforms"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Payment
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Revenue" value={totalRevenue} icon={DollarSign} color="#E60000" />
        <StatCard title="Monthly Revenue" value={monthlyRevenue} icon={TrendingUp} color="#FF1A1A" delay={0.05} />
        <StatCard title="Largest Payment" value={largest} icon={Award} color="#f59e0b" delay={0.1} />
        <StatCard title="Avg Monthly" value={avgMonthly} icon={BarChart3} color="#a855f7" delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground font-semibold">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChart}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E60000" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#E60000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8, color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                  labelStyle={{ color: '#fafafa' }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
                <Area type="monotone" dataKey="amount" stroke="#E60000" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground font-semibold">Platform Revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {platformChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {platformChart.map((entry, i) => (
                      <Cell key={entry.name} fill={platformColor(entry.name) || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8, color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                  labelStyle={{ color: '#fafafa' }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-foreground font-semibold">
              Yearly Revenue ({now.getFullYear()}) — {formatCurrency(yearlyTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8, color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                  labelStyle={{ color: '#fafafa' }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
                <Bar dataKey="amount" fill="#E60000" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {state.revenue.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No revenue logged"
              description="Add your first payment to start tracking monthly income."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Payment
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Platform</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Notes</th>
                    <th className="pb-3 font-medium w-10" />
                  </tr>
                </thead>
                <tbody>
                  {state.revenue.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 tabular-nums">{r.date}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: platformColor(r.platform) }} />
                          {r.platform}
                        </span>
                      </td>
                      <td className="py-3">{r.client || '—'}</td>
                      <td className="py-3 text-right font-semibold text-primary tabular-nums">{formatCurrency(r.amount)}</td>
                      <td className="py-3 text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</td>
                      <td className="py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRevenue(r.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>Log a new revenue entry</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register('date', { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select
                  value={watch('platform')}
                  onValueChange={(v) => setValue('platform', v as RevenuePlatform)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.revenueCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <Input type="number" step="0.01" min="0" {...register('amount', { required: true, valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input {...register('client')} placeholder="Client name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Optional notes" />
            </div>
            <Button type="submit" className="w-full">Save Payment</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// silence unused
void parseISO
void generateId
