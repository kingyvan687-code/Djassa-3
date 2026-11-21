/**
 * Configuration publique Supabase côté client.
 * N'utilise QUE la clé publique anonyme (VITE_SUPABASE_ANON_KEY), soumise aux politiques RLS.
 * Aucune clé service_role ni secret serveur ne doit être importée côté client.
 */
export function getSupabasePublicConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return {
    configured: Boolean(url && anonKey),
    url,
    anonKey
  };
}
