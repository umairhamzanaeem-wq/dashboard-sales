import { format, parseISO } from 'date-fns'
import { Play, Square, RotateCcw, CalendarCheck, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'

function formatStamp(iso: string | null) {
  if (!iso) return null
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return null
  }
}

export function DaySessionCard() {
  const { progress, overall, startDay, finishDay, resumeDay } = useApp()
  const navigate = useNavigate()
  const status = progress.dayStatus ?? 'not_started'
  const started = formatStamp(progress.dayStartedAt)
  const finished = formatStamp(progress.dayFinishedAt)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="h-1 w-full bg-gradient-to-r from-accent via-primary to-purple" />
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="rounded-xl bg-muted p-3 shrink-0">
            <CalendarCheck className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-semibold">Today's Session</h2>
              {status === 'not_started' && <Badge variant="muted">Not started</Badge>}
              {status === 'in_progress' && <Badge variant="default">In progress</Badge>}
              {status === 'finished' && <Badge variant="success">Finished</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {status === 'not_started' &&
                'Check in to start tracking today. Your work will be saved to History when you finish.'}
              {status === 'in_progress' && (
                <>
                  Started{started ? ` at ${started}` : ''} · {overall.percent}% complete · Mark{' '}
                  <strong className="text-foreground font-medium">Finish Day</strong> when you're done.
                </>
              )}
              {status === 'finished' && (
                <>
                  Saved to History
                  {started && finished ? ` · ${started} → ${finished}` : ''} · {overall.percent}% · Check History anytime.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {status === 'not_started' && (
            <Button variant="accent" size="lg" onClick={() => { startDay(); navigate('/planner') }}>
              <Play className="h-4 w-4" /> Start Day
            </Button>
          )}
          {status === 'in_progress' && (
            <>
              <Button variant="outline" onClick={() => navigate('/planner')}>
                Continue Work
              </Button>
              <Button variant="accent" size="lg" onClick={finishDay}>
                <Square className="h-4 w-4" /> Finish Day
              </Button>
            </>
          )}
          {status === 'finished' && (
            <>
              <Button variant="outline" onClick={() => navigate('/history')}>
                <CheckCircle2 className="h-4 w-4" /> View History
              </Button>
              <Button variant="secondary" onClick={resumeDay}>
                <RotateCcw className="h-4 w-4" /> Resume Day
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
