import { json } from '../lib/http.js';

export function onRequestGet({ env }) {
  const supabaseUrl = String(env.SUPABASE_URL || '').trim();
  const supabasePublishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!supabaseUrl || !supabasePublishableKey) {
    return json({ configured: false }, 503);
  }
  return json({ configured: true, supabaseUrl, supabasePublishableKey });
}
