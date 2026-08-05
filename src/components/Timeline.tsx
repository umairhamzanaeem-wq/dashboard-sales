import { motion } from 'framer-motion'
import { Play, Pause, Check, SkipForward, Clock } from 'lucide-react'
import type { Platform, TimelineBlock } from '@/types'
import { useApp } from '@/context/AppContext'
import { formatTime, formatTime12, formatMinutes, platformColor, percent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const statusVariant: Record<string, 'muted' | 'default' | 'warning' | 'success' | 'outline'> = {
  pending: 'muted',
  active: 'default',
  paused: 'warning',
  completed: 'success',
  skipped: 'outline',
}

export function TimelineCard({ block, index }: { block: TimelineBlock; index: number }) {
  const { timelineAction } = useApp()
  const color = platformColor(block.id)
  const progressPct = percent(block.elapsedSeconds, block.estimatedMinutes * 60)
  const isActive = block.status === 'active'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="relative flex gap-4"
    >
      {/* Timeline rail */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 z-10',
            isActive ? 'border-accent bg-accent/20 animate-pulse' : 'border-border bg-card'
          )}
        >
          <Clock className="h-4 w-4" style={{ color: isActive ? '#22c55e' : color }} />
        </div>
        {index < 5 && <div className="w-px flex-1 bg-border min-h-[24px]" />}
      </div>

      <div
        className={cn(
          'flex-1 mb-4 rounded-xl border bg-card p-4 transition-all',
          isActive ? 'border-accent/50 shadow-lg shadow-accent/5' : 'border-border'
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{block.name}</h4>
              <Badge variant={statusVariant[block.status]}>{block.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTime12(block.startTime)} · {formatMinutes(block.estimatedMinutes)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-semibold tabular-nums" style={{ color: isActive ? '#22c55e' : undefined }}>
              {formatTime(block.elapsedSeconds)}
            </p>
            <p className="text-[10px] text-muted-foreground">Live Timer</p>
          </div>
        </div>

        <Progress value={Math.min(progressPct, 100)} className="mb-3" />

        <div className="flex flex-wrap gap-2">
          {block.status !== 'active' && block.status !== 'completed' && (
            <Button size="sm" variant="accent" onClick={() => timelineAction(block.id as Platform, 'start')}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {block.status === 'active' && (
            <Button size="sm" variant="secondary" onClick={() => timelineAction(block.id as Platform, 'pause')}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {block.status !== 'completed' && (
            <>
              <Button size="sm" variant="outline" onClick={() => timelineAction(block.id as Platform, 'complete')}>
                <Check className="h-3.5 w-3.5" /> Complete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => timelineAction(block.id as Platform, 'skip')}>
                <SkipForward className="h-3.5 w-3.5" /> Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function DailyTimeline() {
  const { progress } = useApp()

  return (
    <div className="space-y-0">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Daily Timeline</h2>
        <p className="text-sm text-muted-foreground">Your evening business development schedule</p>
      </div>
      {progress.timeline.map((block, i) => (
        <TimelineCard key={block.id} block={block} index={i} />
      ))}
    </div>
  )
}
