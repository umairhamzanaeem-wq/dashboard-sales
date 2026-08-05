import { motion } from 'framer-motion'
import { Minus, Plus, Clock } from 'lucide-react'
import type { Platform, PlatformSection } from '@/types'
import { useApp } from '@/context/AppContext'
import { sectionProgress, formatMinutes, percent, platformColor } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CompletedBadge, ProgressRing } from '@/components/shared'

interface PlatformCardProps {
  platform: Platform
  delay?: number
}

export function PlatformCard({ platform, delay = 0 }: PlatformCardProps) {
  const { progress, toggleChecklist, updateCounter, setNotes } = useApp()
  const section = progress.platforms[platform]
  const stats = sectionProgress(section)
  const color = platformColor(platform)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="overflow-hidden hover:border-border/80 transition-colors">
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">{section.name}</h3>
              <CompletedBadge show={section.completed || stats.percent >= 100} />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatMinutes(section.estimatedMinutes)}
            </div>
            {section.purpose && (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{section.purpose}</p>
            )}
          </div>
          <ProgressRing percent={stats.percent} size={56} strokeWidth={5} color={color}>
            <span className="text-[11px] font-semibold tabular-nums">{stats.percent}%</span>
          </ProgressRing>
        </CardHeader>

        <CardContent className="space-y-5">
          {section.counters.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Targets</p>
              {section.counters.map((counter) => {
                const pct = percent(counter.completed, counter.target)
                const done = counter.completed >= counter.target
                return (
                  <div key={counter.id} className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{counter.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {counter.completed} / {counter.target} · {Math.max(0, counter.target - counter.completed)} remaining
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateCounter(platform, counter.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{counter.completed}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateCounter(platform, counter.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={pct} indicatorClassName={done ? 'bg-accent' : undefined} style={{ ['--tw' as string]: color }} />
                    {done && <CompletedBadge show />}
                  </div>
                )
              })}
            </div>
          )}

          {section.checklist.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tasks</p>
              {section.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleChecklist(platform, item.id)}
                  />
                  <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium tabular-nums">{stats.percent}%</span>
            </div>
            <Progress value={stats.percent} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <Textarea
              placeholder="Add notes for this platform..."
              value={section.notes}
              onChange={(e) => setNotes(platform, e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function KpiRow({ section, platform }: { section: PlatformSection; platform: Platform }) {
  const { updateCounter, toggleChecklist } = useApp()
  const color = platformColor(platform)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-semibold">{section.name}</h3>
        <CompletedBadge show={section.completed} />
      </div>

      {section.counters.map((c) => {
        const pct = percent(c.completed, c.target)
        return (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">
                  Target {c.target} · Done {c.completed} · Left {Math.max(0, c.target - c.completed)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tabular-nums" style={{ color }}>{pct}%</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCounter(platform, c.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCounter(platform, c.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <Progress value={pct} />
            {pct >= 100 && <div className="mt-2"><CompletedBadge show /></div>}
          </div>
        )
      })}

      {section.checklist.map((item) => (
        <label
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 cursor-pointer hover:bg-card-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <Checkbox checked={item.completed} onCheckedChange={() => toggleChecklist(platform, item.id)} />
            <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.label}</span>
          </div>
          <CompletedBadge show={item.completed} />
        </label>
      ))}
    </div>
  )
}
