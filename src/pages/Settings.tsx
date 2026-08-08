import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Upload, RotateCcw, Bell, Palette, Target, Clock, Mail, Link2, Unlink, Loader2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { downloadJson } from '@/lib/utils'
import { exportState } from '@/lib/storage'
import { createDailyProgress } from '@/lib/defaults'
import { disconnectGmail, fetchGmailStatus, gmailAuthUrl } from '@/lib/gmail-api'
import type { Platform } from '@/types'

const REMINDER_LABELS: Record<Platform, string> = {
  fiverr: 'Fiverr',
  linkedin_saad: 'LinkedIn (Saad)',
  linkedin_umair: 'LinkedIn (Umair)',
  facebook: 'Facebook',
  threads: 'Threads',
  instagram: 'Instagram',
  upwork: 'Upwork',
  review: 'Daily Review',
}

export function SettingsPage() {
  const { state, settings, updateSettings, resetDashboard, importDashboard, dispatch } = useApp()
  const { username } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailLoading, setGmailLoading] = useState(true)
  const [gmailBusy, setGmailBusy] = useState(false)

  const targets = settings.dailyTargets

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }

  useEffect(() => {
    const status = searchParams.get('gmail')
    if (status === 'connected') {
      flash('Gmail Connected')
      setSearchParams({}, { replace: true })
      if (username) {
        fetchGmailStatus(username)
          .then((s) => {
            setGmailConnected(!!s.connected)
            setGmailEmail(s.email)
          })
          .catch(() => undefined)
      }
    } else if (status === 'error') {
      flash(searchParams.get('reason') || 'Gmail connection failed')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, username])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!username) {
        setGmailLoading(false)
        return
      }
      setGmailLoading(true)
      try {
        const status = await fetchGmailStatus(username)
        if (!cancelled) {
          setGmailConnected(!!status.connected)
          setGmailEmail(status.email)
        }
      } catch {
        if (!cancelled) {
          setGmailConnected(false)
          setGmailEmail(null)
        }
      } finally {
        if (!cancelled) setGmailLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [username])

  const connectGmail = () => {
    if (!username) {
      flash('Please sign in first')
      return
    }
    window.location.href = gmailAuthUrl(username)
  }

  const handleDisconnectGmail = async () => {
    if (!username) return
    setGmailBusy(true)
    try {
      await disconnectGmail(username)
      setGmailConnected(false)
      setGmailEmail(null)
      flash('Gmail disconnected')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to disconnect Gmail')
    } finally {
      setGmailBusy(false)
    }
  }

  const updateTarget = (
    platform: keyof typeof targets,
    key: string,
    value: number
  ) => {
    updateSettings({
      dailyTargets: {
        ...targets,
        [platform]: { ...targets[platform], [key]: Math.max(0, value) },
      },
    })
  }

  const applyTargetsToToday = () => {
    const fresh = createDailyProgress(settings.dailyTargets, settings.timeline, state.dailyProgress.date)
    // Preserve today's completed work where possible by only updating targets
    const platforms = { ...state.dailyProgress.platforms }
    ;(['linkedin_saad', 'linkedin_umair', 'facebook', 'threads', 'instagram', 'upwork'] as const).forEach((pid) => {
      platforms[pid] = {
        ...platforms[pid],
        counters: platforms[pid].counters.map((c) => {
          const t = fresh.platforms[pid].counters.find((x) => x.id === c.id)
          return t ? { ...c, target: t.target } : c
        }),
      }
    })
    dispatch({
      type: 'HYDRATE',
      state: {
        ...state,
        dailyProgress: { ...state.dailyProgress, platforms },
        settings,
      },
    })
    flash('Targets applied to today')
  }

  const updateReminder = (platform: Platform, time: string) => {
    updateSettings({
      reminderTimes: { ...settings.reminderTimes, [platform]: time },
    })
  }

  const updateTimelineBlock = (id: Platform, field: 'startTime' | 'estimatedMinutes', value: string | number) => {
    updateSettings({
      timeline: {
        blocks: settings.timeline.blocks.map((b) =>
          b.id === id ? { ...b, [field]: value } : b
        ),
      },
    })
  }

  const handleExport = () => {
    downloadJson(JSON.parse(exportState(state)), `bd-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`)
    flash('Backup exported')
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importDashboard(String(reader.result))
        flash('Backup restored successfully')
      } catch {
        flash('Invalid backup file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const requestNotifs = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission()
      updateSettings({ notificationsEnabled: perm === 'granted' })
      flash(perm === 'granted' ? 'Notifications enabled' : 'Permission denied')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Customize targets, timeline, theme & data" />

      {msg && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">{msg}</div>
      )}

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Choose Ignite (brand red) or Classic (previous green/blue) in dark or light.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  id: 'ignite-dark' as const,
                  label: 'Ignite Dark',
                  description: 'Black + brand red',
                },
                {
                  id: 'ignite-light' as const,
                  label: 'Ignite Light',
                  description: 'White + brand red',
                },
                {
                  id: 'classic-dark' as const,
                  label: 'Classic Dark',
                  description: 'Previous zinc dark',
                },
                {
                  id: 'classic-light' as const,
                  label: 'Classic Light',
                  description: 'Previous light palette',
                },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateSettings({ theme: opt.id })}
                className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  settings.theme === opt.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{opt.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gmail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Gmail Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Connect Gmail so Start Day and Finish Day can send daily work emails through your account.
            Only the <span className="text-foreground">gmail.send</span> permission is requested.
          </p>
          {gmailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
            </div>
          ) : gmailConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium text-success">Gmail Connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">{gmailEmail}</p>
              </div>
              <Button
                variant="outline"
                onClick={handleDisconnectGmail}
                disabled={gmailBusy}
                className="gap-2"
              >
                {gmailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Disconnect Gmail
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium">Not connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please connect your Gmail account in Settings before sending daily notifications.
                </p>
              </div>
              <Button onClick={connectGmail} className="gap-2">
                <Link2 className="h-4 w-4" /> Connect Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-warning" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Browser Notifications</p>
              <p className="text-xs text-muted-foreground">Schedule reminders & incomplete task alerts</p>
            </div>
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={(c) => {
                if (c) requestNotifs()
                else updateSettings({ notificationsEnabled: false })
              }}
            />
          </div>
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reminder Times</p>
            {(Object.keys(REMINDER_LABELS) as Platform[]).map((p) => (
              <div key={p} className="flex items-center justify-between gap-3">
                <Label className="text-sm font-normal">{REMINDER_LABELS[p]}</Label>
                <Input
                  type="time"
                  className="w-36"
                  value={settings.reminderTimes[p]}
                  onChange={(e) => updateReminder(p, e.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Targets */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Daily Targets
          </CardTitle>
          <Button size="sm" variant="outline" onClick={applyTargetsToToday}>Apply to Today</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <TargetGroup title="LinkedIn (Saad)">
            <NumField label="Connections" value={targets.linkedin_saad.connections} onChange={(v) => updateTarget('linkedin_saad', 'connections', v)} />
            <NumField label="Follow-ups" value={targets.linkedin_saad.followUps} onChange={(v) => updateTarget('linkedin_saad', 'followUps', v)} />
            <NumField label="Comments" value={targets.linkedin_saad.comments} onChange={(v) => updateTarget('linkedin_saad', 'comments', v)} />
          </TargetGroup>
          <TargetGroup title="LinkedIn (Umair)">
            <NumField label="Connections" value={targets.linkedin_umair.connections} onChange={(v) => updateTarget('linkedin_umair', 'connections', v)} />
            <NumField label="Follow-ups" value={targets.linkedin_umair.followUps} onChange={(v) => updateTarget('linkedin_umair', 'followUps', v)} />
            <NumField label="Comments" value={targets.linkedin_umair.comments} onChange={(v) => updateTarget('linkedin_umair', 'comments', v)} />
          </TargetGroup>
          <TargetGroup title="Facebook">
            <NumField label="Comments" value={targets.facebook.comments} onChange={(v) => updateTarget('facebook', 'comments', v)} />
            <NumField label="DMs" value={targets.facebook.dms} onChange={(v) => updateTarget('facebook', 'dms', v)} />
            <NumField label="Posts" value={targets.facebook.posts} onChange={(v) => updateTarget('facebook', 'posts', v)} />
          </TargetGroup>
          <TargetGroup title="Threads">
            <NumField label="Daily Posts" value={targets.threads.posts} onChange={(v) => updateTarget('threads', 'posts', v)} />
            <NumField label="DMs / Replies" value={targets.threads.dms} onChange={(v) => updateTarget('threads', 'dms', v)} />
          </TargetGroup>
          <TargetGroup title="Instagram">
            <NumField label="Businesses Found" value={targets.instagram.businesses} onChange={(v) => updateTarget('instagram', 'businesses', v)} />
            <NumField label="DMs Sent" value={targets.instagram.dms} onChange={(v) => updateTarget('instagram', 'dms', v)} />
          </TargetGroup>
          <TargetGroup title="Upwork">
            <NumField label="Jobs Reviewed" value={targets.upwork.jobsReviewed} onChange={(v) => updateTarget('upwork', 'jobsReviewed', v)} />
            <NumField label="Proposals" value={targets.upwork.proposals} onChange={(v) => updateTarget('upwork', 'proposals', v)} />
          </TargetGroup>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Timeline Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.timeline.blocks.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <span className="text-sm font-medium min-w-[140px]">{b.name}</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="time"
                  className="w-32"
                  value={b.startTime}
                  onChange={(e) => updateTimelineBlock(b.id, 'startTime', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Minutes</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={b.estimatedMinutes}
                  onChange={(e) => updateTimelineBlock(b.id, 'estimatedMinutes', Number(e.target.value))}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Timeline changes apply to new days. Today's timeline keeps its current schedule.
          </p>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground font-semibold">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Reset Dashboard
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Dashboard?</DialogTitle>
            <DialogDescription>
              This will erase all progress, history, revenue, and settings. Export a backup first if you want to keep your data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetDashboard()
                setResetOpen(false)
                flash('Dashboard reset')
              }}
            >
              Reset Everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TargetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid sm:grid-cols-3 gap-3">{children}</div>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}
