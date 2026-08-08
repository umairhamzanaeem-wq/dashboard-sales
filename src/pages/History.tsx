import { useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay } from 'date-fns'
import { Calendar, List, Clock, BarChart3 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { PageHeader, EmptyState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/input'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import type { HistoryEntry } from '@/types'

export function HistoryPage() {
  const { state, saveToday, overall } = useApp()
  const [month, setMonth] = useState(new Date())

  const historyMap = useMemo(() => {
    const map = new Map<string, HistoryEntry>()
    state.history.forEach((h) => map.set(h.date, h))
    // include today
    if (overall.tasksCompleted > 0) {
      map.set(state.dailyProgress.date, {
        date: state.dailyProgress.date,
        completionPercent: overall.percent,
        tasksCompleted: overall.tasksCompleted,
        tasksTotal: overall.tasksTotal,
        connections: 0,
        followUps: 0,
        facebookComments: 0,
        facebookDms: 0,
        jobsReviewed: 0,
        proposalsSent: 0,
        revenue: state.revenue
          .filter((r) => r.date === state.dailyProgress.date)
          .reduce((s, r) => s + r.amount, 0),
        notes: state.dailyProgress.dailyNotes,
        totalTimeWorkedSeconds: state.dailyProgress.totalTimeWorkedSeconds,
        productivityScore: overall.percent,
      })
    }
    return map
  }, [state, overall])

  const sorted = useMemo(
    () => Array.from(historyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    [historyMap]
  )

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
    const pad = getDay(start)
    return { days, pad }
  }, [month])

  const weeklySummary = useMemo(() => {
    const weeks: { label: string; avg: number; days: number }[] = []
    const recent = sorted.slice(0, 28)
    for (let i = 0; i < recent.length; i += 7) {
      const chunk = recent.slice(i, i + 7)
      if (chunk.length === 0) continue
      weeks.push({
        label: `${chunk[chunk.length - 1].date} → ${chunk[0].date}`,
        avg: Math.round(chunk.reduce((s, c) => s + c.completionPercent, 0) / chunk.length),
        days: chunk.length,
      })
    }
    return weeks
  }, [sorted])

  const monthlySummary = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>()
    sorted.forEach((h) => {
      const m = h.date.slice(0, 7)
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(h)
    })
    return Array.from(map.entries()).map(([month, entries]) => ({
      month,
      avg: Math.round(entries.reduce((s, e) => s + e.completionPercent, 0) / entries.length),
      days: entries.length,
      revenue: entries.reduce((s, e) => s + e.revenue, 0),
      connections: entries.reduce((s, e) => s + e.connections, 0),
    }))
  }, [sorted])

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Automatically saved completed days — calendar, timeline & summaries"
        actions={
          <button
            onClick={saveToday}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Save today to history
          </button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No history yet"
          description="Complete your daily activities and they'll appear here automatically."
        />
      ) : (
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar"><Calendar className="h-3.5 w-3.5 mr-1.5" />Calendar</TabsTrigger>
            <TabsTrigger value="timeline"><Clock className="h-3.5 w-3.5 mr-1.5" />Timeline</TabsTrigger>
            <TabsTrigger value="table"><List className="h-3.5 w-3.5 mr-1.5" />Table</TabsTrigger>
            <TabsTrigger value="summary"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base text-foreground font-semibold">
                  {format(month, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex gap-2">
                  <button
                    className="text-sm px-2 py-1 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}
                  >
                    ←
                  </button>
                  <button
                    className="text-sm px-2 py-1 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}
                  >
                    →
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: calendarDays.pad }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {calendarDays.days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd')
                    const entry = historyMap.get(key)
                    const pct = entry?.completionPercent ?? 0
                    return (
                      <div
                        key={key}
                        className={cn(
                          'aspect-square rounded-lg border border-border/50 p-1 flex flex-col items-center justify-center text-xs',
                          entry && 'border-accent/30',
                          !isSameMonth(day, month) && 'opacity-30'
                        )}
                        style={
                          entry
                            ? { background: `rgba(34, 197, 94, ${pct / 200})` }
                            : undefined
                        }
                        title={entry ? `${pct}% complete` : undefined}
                      >
                        <span className="text-muted-foreground">{format(day, 'd')}</span>
                        {entry && <span className="text-[9px] font-semibold text-primary">{pct}%</span>}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="space-y-3">
              {sorted.map((h) => (
                <Card key={h.date} className="overflow-hidden">
                  <div
                    className="h-1"
                    style={{
                      width: `${h.completionPercent}%`,
                      background: h.completionPercent >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
                    }}
                  />
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{format(parseISO(h.date), 'EEE, MMM d yyyy')}</span>
                        <Badge variant={h.completionPercent >= 100 ? 'success' : 'default'}>
                          {h.completionPercent}%
                        </Badge>
                        {h.dayStatus === 'finished' && <Badge variant="success">Finished</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Score {h.productivityScore} · {formatTime(h.totalTimeWorkedSeconds)}
                        {h.dayStartedAt && h.dayFinishedAt
                          ? ` · ${format(parseISO(h.dayStartedAt), 'h:mm a')}–${format(parseISO(h.dayFinishedAt), 'h:mm a')}`
                          : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <span>Tasks {h.tasksCompleted}/{h.tasksTotal}</span>
                      <span>Connections {h.connections}</span>
                      <span>Follow-ups {h.followUps}</span>
                      <span>FB {h.facebookComments + h.facebookDms}</span>
                      <span>Jobs {h.jobsReviewed}</span>
                      <span>Proposals {h.proposalsSent}</span>
                      <span>Revenue {formatCurrency(h.revenue)}</span>
                    </div>
                    {h.notes && <p className="mt-2 text-sm text-muted-foreground">{h.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">%</th>
                      <th className="p-3 font-medium">Tasks</th>
                      <th className="p-3 font-medium">Conn</th>
                      <th className="p-3 font-medium">FU</th>
                      <th className="p-3 font-medium">FB</th>
                      <th className="p-3 font-medium">UW</th>
                      <th className="p-3 font-medium">Revenue</th>
                      <th className="p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((h) => (
                      <tr key={h.date} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 tabular-nums">{h.date}</td>
                        <td className="p-3 font-semibold text-primary">{h.completionPercent}%</td>
                        <td className="p-3">{h.tasksCompleted}/{h.tasksTotal}</td>
                        <td className="p-3">{h.connections}</td>
                        <td className="p-3">{h.followUps}</td>
                        <td className="p-3">{h.facebookComments + h.facebookDms}</td>
                        <td className="p-3">{h.proposalsSent}</td>
                        <td className="p-3">{formatCurrency(h.revenue)}</td>
                        <td className="p-3 text-muted-foreground max-w-[160px] truncate">{h.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-foreground font-semibold">Weekly Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {weeklySummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not enough data</p>
                ) : (
                  weeklySummary.map((w) => (
                    <div key={w.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm text-muted-foreground">{w.label}</span>
                      <span className="text-sm font-semibold">{w.avg}% avg · {w.days} days</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-foreground font-semibold">Monthly Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {monthlySummary.map((m) => (
                  <div key={m.month} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <span className="text-sm font-medium">{m.month}</span>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{m.avg}% avg</span>
                      <span>{m.days} days</span>
                      <span>{m.connections} conn</span>
                      <span>{formatCurrency(m.revenue)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
