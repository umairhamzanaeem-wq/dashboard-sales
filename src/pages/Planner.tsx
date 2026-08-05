import type { Platform } from '@/types'
import { PlatformCard } from '@/components/PlatformCard'
import { DailyTimeline } from '@/components/Timeline'
import { DaySessionCard } from '@/components/DaySessionCard'
import { PageHeader } from '@/components/shared'
import { useApp } from '@/context/AppContext'
import { ProgressRing } from '@/components/shared'
import { Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PLATFORMS: Platform[] = ['fiverr', 'linkedin_saad', 'linkedin_umair', 'facebook', 'upwork']

export function PlannerPage() {
  const { overall, progress, dispatch } = useApp()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Daily Planner"
        description="Execute your platform workflow — targets, tasks, and notes"
        actions={
          <ProgressRing percent={overall.percent} size={52} strokeWidth={5}>
            <span className="text-xs font-bold">{overall.percent}%</span>
          </ProgressRing>
        }
      />

      <DaySessionCard />

      <div className="grid lg:grid-cols-2 gap-5">
        {PLATFORMS.map((p, i) => (
          <PlatformCard key={p} platform={p} delay={i * 0.05} />
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
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>
    </div>
  )
}
