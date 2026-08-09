import {
  Flame,
  Target,
  Users,
  MessageSquare,
  Facebook,
  Briefcase,
  FileText,
  DollarSign,
  Mail,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { PageHeader, StatCard, ProgressRing } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatTime, sectionProgress, platformColor, platformLogo } from '@/lib/utils'
import { themeAccent } from '@/lib/theme'
import { DaySessionCard } from '@/components/DaySessionCard'
import { DailyTimeline } from '@/components/Timeline'
import type { Platform } from '@/types'
import { motion } from 'framer-motion'

const PLATFORMS: Platform[] = [
  'fiverr',
  'linkedin_saad',
  'linkedin_umair',
  'facebook',
  'threads',
  'x',
  'instagram',
  'upwork',
  'review',
]

export function DashboardPage() {
  const { overall, score, settings, todayStats, progress } = useApp()
  const accents = themeAccent(settings.theme)

  const cards: Array<{
    title: string
    value: number
    suffix?: string
    prefix?: string
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    color: string
  }> = [
    { title: "Today's Progress", value: overall.percent, suffix: '%', icon: Target, color: accents.primary },
    { title: 'Current Streak', value: settings.streak, suffix: ' days', icon: Flame, color: accents.warning },
    { title: 'Connections Sent', value: todayStats.connections, icon: Users, color: accents.secondary },
    { title: 'Follow-ups Done', value: todayStats.followUps, icon: MessageSquare, color: accents.primary },
    { title: 'FB Comments', value: todayStats.facebookComments, icon: Facebook, color: '#1877f2' },
    { title: 'Facebook DMs', value: todayStats.facebookDms, icon: Mail, color: '#ec4899' },
    { title: 'Jobs Reviewed', value: todayStats.jobsReviewed, icon: Briefcase, color: '#14a800' },
    { title: 'Proposals Sent', value: todayStats.proposalsSent, icon: FileText, color: '#f97316' },
    { title: 'Monthly Revenue', value: todayStats.monthlyRevenue, prefix: '$', icon: DollarSign, color: accents.success },
    { title: 'Unread Messages', value: todayStats.unreadMessages, icon: Mail, color: '#A3A3A3' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your daily business development command center"
      />

      <DaySessionCard />

      {/* Hero progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at top right, ${accents.primary}1f, transparent 50%)`,
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing percent={overall.percent} size={120} strokeWidth={8} color={accents.primary}>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">{overall.percent}%</p>
              <p className="text-[10px] text-muted-foreground">Complete</p>
            </div>
          </ProgressRing>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold mb-1">
              {overall.percent >= 100
                ? 'All activities complete!'
                : overall.percent >= 50
                  ? 'Keep pushing — you\'re halfway there'
                  : 'Time to grind — start your workflow'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {overall.tasksCompleted} of {overall.tasksTotal} tasks done · Productivity score {score} ·{' '}
              {formatTime(progress.totalTimeWorkedSeconds)} worked
            </p>
            <Progress value={overall.percent} className="h-2.5 max-w-md mx-auto sm:mx-0" />
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-warning">{settings.streak}</p>
              <p className="text-xs text-muted-foreground">Streak</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{settings.longestStreak}</p>
              <p className="text-xs text-muted-foreground">Best</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{score}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <StatCard
            key={c.title}
            title={c.title}
            value={c.value}
            suffix={c.suffix}
            prefix={c.prefix}
            icon={c.icon}
            color={c.color}
            delay={i * 0.04}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Platform overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground font-semibold">Platform Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PLATFORMS.map((id) => {
              const section = progress.platforms[id]
              const stats = sectionProgress(section)
              const color = platformColor(id)
              const logo = platformLogo(id)
              return (
                <div key={id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      {logo ? (
                        <img src={logo} alt="" className="h-4 w-4 rounded object-cover" />
                      ) : (
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      )}
                      {section.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{stats.percent}%</span>
                  </div>
                  <Progress value={stats.percent} indicatorClassName="bg-current" style={{ color } as React.CSSProperties} />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• Consistency beats intensity — protect your evening schedule.</p>
            <p>• Quality proposals over volume on Upwork (4–6 personalized).</p>
            <p>• Meaningful LinkedIn comments build trust faster than spam.</p>
            <p>• Facebook groups: add value first, then soft CTA in DMs.</p>
            <p>• Log revenue the same day — keep your monthly pulse accurate.</p>
          </CardContent>
        </Card>
      </div>

      <DailyTimeline />
    </div>
  )
}
