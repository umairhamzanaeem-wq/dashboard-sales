import type { Platform } from '@/types'
import { ALL_STRATEGY_PLATFORMS } from '@/lib/users'

/** Platforms visible for the signed-in user’s strategy */
export function resolveEnabledPlatforms(enabled?: Platform[] | null): Platform[] {
  if (enabled && enabled.length > 0) return enabled
  return [...ALL_STRATEGY_PLATFORMS]
}
