import { motion } from 'framer-motion'
import type { Platform } from '@/types'
import { useApp } from '@/context/AppContext'
import { DaySessionCard } from '@/components/DaySessionCard'
import { PageHeader, ProgressRing, CompletedBadge } from '@/components/shared'
import { KpiRow } from '@/components/PlatformCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { formatTime } from '@/lib/utils'
import { themeAccent } from '@/lib/theme'
import { Flame, CheckCircle2, ListTodo, Clock, Trophy } from 'lucide-react'

const PLATFORMS: Platform[] = [
  'fiverr',
  'linkedin_saad',
  'linkedin_umair',
  'facebook',
  'threads',
  'instagram',
  'upwork',
]

export function TrackerPage() {
  const { progress, overall, score, settings, dispatch } = useApp()
  const complete = overall.percent >= 100
  const accents = themeAccent(settings.theme)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Daily Tracker"
        description="Every KPI at a glance — targets, completed, remaining"
      />

      <DaySessionCard />

      {/* Scorecard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-2xl border p-6 ${
          complete
            ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card'
            : 'border-border bg-card'
        }`}
      >
        {complete && (
          <div className="mb-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <p className="text-3xl mb-2">✓</p>
              <h2 className="text-xl font-bold text-primary">Congratulations!</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                You completed every business development activity today. Keep the streak alive!
              </p>
            </motion.div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-8">
          <ProgressRing percent={overall.percent} size={140} strokeWidth={10} color={complete ? accents.success : accents.primary}>
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums">{overall.percent}%</p>
              <p className="text-[10px] text-muted-foreground">Overall</p>
            </div>
          </ProgressRing>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 w-full">
            <ScoreItem icon={Trophy} label="Productivity Score" value={String(score)} color={accents.warning} />
            <ScoreItem icon={CheckCircle2} label="Tasks Completed" value={String(overall.tasksCompleted)} color={accents.success} />
            <ScoreItem icon={ListTodo} label="Remaining Tasks" value={String(overall.remaining)} color="#A3A3A3" />
            <ScoreItem icon={Flame} label="Current Streak" value={`${settings.streak} days`} color="#F97316" />
            <ScoreItem
              icon={Clock}
              label="Time Worked"
              value={formatTime(progress.totalTimeWorkedSeconds)}
              color={accents.primary}
            />
            <div className="rounded-xl bg-muted/50 border border-border p-3 flex items-center justify-center">
              <CompletedBadge show={complete} />
              {!complete && <span className="text-xs text-muted-foreground">In Progress</span>}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium text-muted-foreground mb-2">Daily Notes</p>
          <Textarea
            value={progress.dailyNotes}
            onChange={(e) => dispatch({ type: 'SET_DAILY_NOTES', notes: e.target.value })}
            placeholder="How did today go?"
            className="min-h-[70px]"
          />
        </div>
      </motion.div>

      {/* KPI sections */}
      <div className="space-y-8">
        {PLATFORMS.map((id) => (
          <Card key={id}>
            <CardHeader className="pb-2">
              <CardTitle className="sr-only">{progress.platforms[id].name}</CardTitle>
            </CardHeader>
            <CardContent>
              <KpiRow section={progress.platforms[id]} platform={id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ScoreItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-muted/50 border border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
