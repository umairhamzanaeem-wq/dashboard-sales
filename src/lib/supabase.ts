import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local.'
  )
}

/**
 * Browser Supabase client (publishable key only).
 * Do not use the service_role key in frontend code.
 */
export const supabase = createClient(
  supabaseUrl ?? '',
  supabasePublishableKey ?? ''
)
