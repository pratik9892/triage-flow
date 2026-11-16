import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// The anon key is public by design: Row Level Security (migration 003) is
// what stops anonymous visitors from reading tickets.
export const supabase = isConfigured ? createClient(url, anonKey) : null
