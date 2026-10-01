import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables safely
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) || 
  '';

const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) || 
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Supabase client instance.
 * If credentials are provided in .env, connects to the real Supabase project.
 * If not provided yet, exports a null-safe client with warning on usage.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Helper to check or notify about Supabase connection status
 */
export function getSupabaseStatus(): { connected: boolean; url: string } {
  return {
    connected: isSupabaseConfigured,
    url: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '').split('.')[0] : 'not configured',
  };
}
