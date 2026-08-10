import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Palette } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { BrandLogo } from '@/components/BrandLogo'
import {
  applyTheme,
  nextTheme,
  readStoredTheme,
  THEME_OPTIONS,
} from '@/lib/theme'
import type { ThemeMode } from '@/types'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = login(username, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Login failed')
      return
    }
    navigate('/', { replace: true })
  }

  const label = THEME_OPTIONS.find((t) => t.id === theme)?.label ?? 'Theme'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--color-primary)_18%,transparent),_transparent_55%)]" />
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setTheme((t) => nextTheme(t))}
          title="Cycle theme"
        >
          <Palette className="h-3.5 w-3.5" />
          {label}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <BrandLogo size="xl" rounded="2xl" className="mb-5 brand-glow" />
          <h1 className="text-2xl font-semibold tracking-tight">CRM Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
