import { cn } from '@/lib/utils'
import { getUserProfile } from '@/lib/auth'

interface UserAvatarProps {
  username?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
}

export function UserAvatar({ username, size = 'md', className }: UserAvatarProps) {
  const profile = getUserProfile(username)
  const initial = profile.displayName.charAt(0).toUpperCase()

  if (profile.avatar) {
    return (
      <img
        src={profile.avatar}
        alt={profile.displayName}
        className={cn(
          'rounded-full object-cover border border-border shrink-0',
          sizes[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center font-semibold text-white shrink-0 border border-border',
        sizes[size],
        className
      )}
      aria-label={profile.displayName}
    >
      {initial}
    </div>
  )
}
