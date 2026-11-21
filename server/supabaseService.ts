import { databaseHealth } from './database.ts';

export function getSupabaseServerConfig() {
  const dbUrl = (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return {
    dbConfigured: dbUrl.length > 0,
    apiConfigured: url.length > 0 && (serviceRoleKey.length > 0 || anonKey.length > 0),
    serviceRoleConfigured: serviceRoleKey.length > 0,
    url,
    envVar: 'SUPABASE_DB_URL / SUPABASE_URL'
  };
}

export async function probeSupabaseHealth() {
  const cfg = getSupabaseServerConfig();
  const pg = await databaseHealth();
  return {
    configured: cfg.dbConfigured || cfg.apiConfigured,
    dbConfigured: pg.configured,
    connected: pg.connected,
    apiConfigured: cfg.apiConfigured,
    url: cfg.url || null
  };
}
