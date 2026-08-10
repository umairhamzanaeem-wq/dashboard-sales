import { supabase } from '@/lib/supabase'

type ChangeHandler = (source: string) => void

/**
 * Subscribe to cloud row changes for this user so other devices update live.
 * Falls back gracefully if Realtime isn't enabled for a table.
 */
export function subscribeToAccountSync(userId: string, onChange: ChangeHandler) {
  const channel = supabase
    .channel(`account-sync:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_sessions',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange('daily_sessions')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange('user_settings')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'history_entries',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange('history_entries')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'revenue_entries',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange('revenue_entries')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'platform_strategies',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange('platform_strategies')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      () => onChange('profiles')
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info('[sync] Live account channel subscribed')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[sync] Live channel status:', status)
      }
    })

  return () => {
    void supabase.removeChannel(channel)
  }
}
