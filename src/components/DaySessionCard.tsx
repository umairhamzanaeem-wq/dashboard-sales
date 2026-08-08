import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Play, Square, RotateCcw, CalendarCheck, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import { getUserProfile } from '@/lib/auth'
import { todayKey } from '@/lib/utils'
import {
  sendDailyPerformanceEmailRequest,
  sendDailyStartEmailRequest,
} from '@/lib/gmail-api'

function formatStamp(iso: string | null) {
  if (!iso) return null
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return null
  }
}

export function DaySessionCard() {
  const { progress, overall, startDay, finishDay, resumeDay, state, dispatch } = useApp()
  const { username } = useAuth()
  const navigate = useNavigate()
  const profile = getUserProfile(username)
  const status = progress.dayStatus ?? 'not_started'
  const started = formatStamp(progress.dayStartedAt)
  const finished = formatStamp(progress.dayFinishedAt)
  const [busy, setBusy] = useState<'start' | 'finish' | null>(null)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  const notify = (title: string, body: string, type: 'achievement' | 'info' | 'reminder' = 'info') => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      notification: {
        title,
        body,
        time: format(new Date(), 'HH:mm'),
        type,
      },
    })
  }

  const handleStart = async () => {
    setEmailStatus(null)
    setBusy('start')
    const startedAt = new Date().toISOString()
    startDay()

    const snapshot = {
      ...progress,
      date: todayKey(),
      dayStatus: 'in_progress' as const,
      dayStartedAt: startedAt,
      dayFinishedAt: null,
    }

    try {
      if (!username) throw new Error('Not signed in')
      const res = await sendDailyStartEmailRequest({
        username,
        userName: profile.displayName,
        progress: snapshot,
      })
      setEmailStatus(res.message || 'Start Day Email Sent')
      notify('Start Day Email Sent', `Sent to ${res.to || 'your Gmail'}`, 'achievement')
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Please connect your Gmail account in Settings before sending daily notifications.'
      setEmailStatus(message)
      notify('Gmail notification', message, 'reminder')
    } finally {
      setBusy(null)
      navigate('/planner')
    }
  }

  const handleFinish = async () => {
    setEmailStatus(null)
    setBusy('finish')
    const finishedAt = new Date().toISOString()
    const snapshot = {
      ...progress,
      dayStatus: 'finished' as const,
      dayFinishedAt: finishedAt,
    }
    finishDay()

    try {
      if (!username) throw new Error('Not signed in')
      const res = await sendDailyPerformanceEmailRequest({
        username,
        userName: profile.displayName,
        state,
        progress: snapshot,
      })
      setEmailStatus(res.message || 'Daily Performance Report Sent')
      notify('Daily Performance Report Sent', `Sent to ${res.to || 'your Gmail'}`, 'achievement')
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Please connect your Gmail account in Settings before sending daily notifications.'
      setEmailStatus(message)
      notify('Gmail notification', message, 'reminder')
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="h-1 w-full bg-gradient-to-r from-brand-dark via-primary to-brand-bright" />
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="rounded-xl bg-muted p-3 shrink-0">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-semibold">Today&apos;s Session</h2>
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
                  <strong className="text-foreground font-medium">Finish Day</strong> when you&apos;re done.
                </>
              )}
              {status === 'finished' && (
                <>
                  Saved to History
                  {started && finished ? ` · ${started} → ${finished}` : ''} · {overall.percent}% · Check History anytime.
                </>
              )}
            </p>
            {emailStatus && (
              <p className="mt-2 text-xs flex items-center gap-1.5 text-primary">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{emailStatus}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {status === 'not_started' && (
            <Button variant="accent" size="lg" onClick={handleStart} disabled={busy !== null}>
              {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start Day
            </Button>
          )}
          {status === 'in_progress' && (
            <>
              <Button variant="outline" onClick={() => navigate('/planner')} disabled={busy !== null}>
                Continue Work
              </Button>
              <Button variant="accent" size="lg" onClick={handleFinish} disabled={busy !== null}>
                {busy === 'finish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Finish Day
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
