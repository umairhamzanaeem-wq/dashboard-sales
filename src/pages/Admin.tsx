import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Shield,
  UserPlus,
  Pencil,
  Trash2,
  KeyRound,
  Users,
  Save,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Badge } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StrategyBuilder } from '@/components/admin/StrategyBuilder'
import {
  createDefaultStrategy,
  createUserAccount,
  deleteUserAccount,
  listUsers,
  updateUserAccount,
  type OutreachStrategy,
  type UserAccount,
} from '@/lib/users'

export function AdminPage() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState<UserAccount[]>(() => listUsers())
  const [msg, setMsg] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserAccount | null>(null)
  const [resetUser, setResetUser] = useState<UserAccount | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newStrategy, setNewStrategy] = useState<OutreachStrategy>(() => createDefaultStrategy())
  const [editStrategy, setEditStrategy] = useState<OutreachStrategy | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const teamUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users])
  const adminUsers = useMemo(() => users.filter((u) => u.role === 'admin'), [users])

  if (!isAdmin) return <Navigate to="/" replace />

  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(''), 3500)
  }

  const refresh = () => setUsers(listUsers())

  const handleCreate = () => {
    setBusy(true)
    const result = createUserAccount({
      username: newUsername,
      password: newPassword,
      displayName: newDisplayName,
      strategy: newStrategy,
    })
    setBusy(false)
    if (!result.ok) {
      flash(result.error)
      return
    }
    setCreateOpen(false)
    setNewUsername('')
    setNewPassword('')
    setNewDisplayName('')
    setNewStrategy(createDefaultStrategy())
    refresh()
    flash(`Created profile @${result.user.username}`)
  }

  const openEdit = (user: UserAccount) => {
    setEditUser(user)
    setEditDisplayName(user.displayName)
    setEditStrategy(structuredClone(user.strategy))
  }

  const handleSaveEdit = () => {
    if (!editUser || !editStrategy) return
    setBusy(true)
    const result = updateUserAccount(editUser.username, {
      displayName: editDisplayName,
      strategy: editStrategy,
    })
    setBusy(false)
    if (!result.ok) {
      flash(result.error)
      return
    }
    setEditUser(null)
    setEditStrategy(null)
    refresh()
    flash(`Updated strategy for @${result.user.username}`)
  }

  const handleResetPassword = () => {
    if (!resetUser) return
    setBusy(true)
    const result = updateUserAccount(resetUser.username, { password: resetPassword })
    setBusy(false)
    if (!result.ok) {
      flash(result.error)
      return
    }
    setResetUser(null)
    setResetPassword('')
    refresh()
    flash(`Password reset for @${result.user.username}`)
  }

  const handleDelete = (user: UserAccount) => {
    if (!window.confirm(`Delete profile @${user.username}? Their dashboard data will be removed on this device.`)) {
      return
    }
    const result = deleteUserAccount(user.username)
    if (!result.ok) {
      flash(result.error)
      return
    }
    refresh()
    flash(`Deleted @${user.username}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Create profiles, set passwords, and design each account’s outreach strategy."
      />

      {msg && (
        <p className="text-sm rounded-lg border border-primary/20 bg-primary/10 text-primary px-3 py-2">
          {msg}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Team profiles
          </CardTitle>
          <Button
            onClick={() => {
              setNewStrategy(createDefaultStrategy())
              setCreateOpen(true)
            }}
          >
            <UserPlus className="h-4 w-4" /> New profile
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...adminUsers, ...teamUsers].map((user) => (
            <div
              key={user.username}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{user.displayName}</p>
                  <Badge variant={user.role === 'admin' ? 'default' : 'muted'}>
                    {user.role === 'admin' ? 'Admin' : 'User'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  @{user.username} · {user.strategy.platforms.filter((p) => p.enabled).length} platforms
                  enabled
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.role !== 'admin' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                      <Pencil className="h-3.5 w-3.5" /> Strategy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetUser(user)
                        setResetPassword('')
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Password
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(user)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </>
                )}
                {user.role === 'admin' && (
                  <p className="text-xs text-muted-foreground self-center flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" /> Full access · change password in Settings
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create profile</DialogTitle>
            <DialogDescription>
              Set login credentials and a customized outreach strategy for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. ali"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Initial password"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Ali"
                />
              </div>
            </div>
            <StrategyBuilder value={newStrategy} onChange={setNewStrategy} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={busy || !newUsername || !newPassword}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit strategy */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) {
            setEditUser(null)
            setEditStrategy(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strategy · @{editUser?.username}</DialogTitle>
            <DialogDescription>
              Drag platforms, set targets, then save. Changes apply to this user’s dashboard.
            </DialogDescription>
          </DialogHeader>
          {editStrategy && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
              </div>
              <StrategyBuilder value={editStrategy} onChange={setEditStrategy} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditUser(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save strategy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={!!resetUser}
        onOpenChange={(open) => {
          if (!open) setResetUser(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password · @{resetUser?.username}</DialogTitle>
            <DialogDescription>
              Set a new password for this profile. They can change it later in Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetUser(null)}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={busy || resetPassword.length < 3}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Reset password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
