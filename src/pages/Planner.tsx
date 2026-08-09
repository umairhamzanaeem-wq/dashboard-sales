import type { Platform } from '@/types'
import { PlatformCard } from '@/components/PlatformCard'
import { DailyTimeline } from '@/components/Timeline'
import { DaySessionCard } from '@/components/DaySessionCard'
import { PageHeader } from '@/components/shared'
import { useApp } from '@/context/AppContext'
import { ProgressRing } from '@/components/shared'
import { Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PLATFORMS: Platform[] = [
  'fiverr',
  'linkedin_saad',
  'linkedin_umair',
  'facebook',
  'threads',
  'x',
  'instagram',
  'upwork',
]

export function PlannerPage() {
  const { overall, progress, dispatch } = useApp()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily Planner"
        description="Execute your platform workflow — targets, tasks, and notes"
        actions={
          <ProgressRing percent={overall.percent} size={48} strokeWidth={5}>
            <span className="text-xs font-bold">{overall.percent}%</span>
          </ProgressRing>
        }
      />

      <DaySessionCard />

      {/* Full-width ordered grid: left→right, top→bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
        {PLATFORMS.map((p, i) => (
          <PlatformCard key={p} platform={p} delay={i * 0.04} />
        ))}
      </div>

      <DailyTimeline />

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold">Daily Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="End-of-day reflections, wins, blockers..."
            value={progress.dailyNotes}
            onChange={(e) => dispatch({ type: 'SET_DAILY_NOTES', notes: e.target.value })}
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>
    </div>
  )
}
