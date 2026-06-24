import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DailyReport, StaffAssignment } from '../types.ts';

// Storage keys for user credentials fallback
const STORAGE_URL_KEY = 'tax_tracker_supabase_url';
const STORAGE_KEY_KEY = 'tax_tracker_supabase_anon_key';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'none';
}

/**
 * Get active Supabase configuration from environment variables or localStorage fallback
 */
export function getSupabaseConfig(): SupabaseConfig {
  // 1. Try env variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      isConfigured: true,
      source: 'env',
    };
  }

  // 2. Fallback to localStorage for instant setup in preview or custom domains without rebuild
  const localUrl = localStorage.getItem(STORAGE_URL_KEY);
  const localKey = localStorage.getItem(STORAGE_KEY_KEY);

  if (localUrl && localKey) {
    return {
      url: localUrl,
      anonKey: localKey,
      isConfigured: true,
      source: 'localStorage',
    };
  }

  return {
    url: '',
    anonKey: '',
    isConfigured: false,
    source: 'none',
  };
}

/**
 * Save manual credentials to localStorage
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (url && anonKey) {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  } else {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
  }
}

/**
 * Initialize and get Supabase Client
 */
let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  // If credentials changed or not initialized yet, re-create the client
  if (!supabaseInstance || lastUrl !== config.url || lastKey !== config.anonKey) {
    lastUrl = config.url;
    lastKey = config.anonKey;
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
      }
    });
  }

  return supabaseInstance;
}

/**
 * Test Connection by doing a basic select
 */
export async function testSupabaseConnection(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from('branches')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
}

/**
 * Fetch Staff Assignments from Supabase
 */
export async function fetchStaffFromSupabase(): Promise<StaffAssignment[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client
    .from('staff_assignments')
    .select('branch_id, staff_names, phone');

  if (error) {
    throw new Error(`កំហុសទាញទិន្នន័យមន្ត្រីបង្គោល៖ ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    branchId: row.branch_id,
    staffNames: row.staff_names || '',
    phone: row.phone || '',
  }));
}

/**
 * Push Staff Assignments to Supabase (Upsert)
 */
export async function pushStaffToSupabase(staffList: StaffAssignment[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  if (staffList.length === 0) return;

  const rows = staffList.map(s => ({
    branch_id: s.branchId,
    staff_names: s.staffNames,
    phone: s.phone || '',
    updated_at: new Date().toISOString()
  }));

  const { error } = await client
    .from('staff_assignments')
    .upsert(rows, { onConflict: 'branch_id' });

  if (error) {
    throw new Error(`កំហុសបញ្ជូនទិន្នន័យមន្ត្រីបង្គោល៖ ${error.message}`);
  }
}

/**
 * Fetch Daily Reports from Supabase with RECURSIVE PAGINATION to support OVER 1000 ROWS
 * (Bypassing PostgREST default limit of 1000 rows for Free Tier / default setups)
 */
export async function fetchReportsFromSupabase(): Promise<DailyReport[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  let allReports: DailyReport[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from('daily_reports')
      .select('date, branch_id, status, equipment_checked, reporter_name, telegram_post_time, note, logged_at')
      .order('date', { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      throw new Error(`កំហុសទាញទិន្នន័យរបាយការណ៍ (ជួរ ${from} ដល់ ${from + limit})៖ ${error.message}`);
    }

    if (data && data.length > 0) {
      const mapped: DailyReport[] = data.map((row: any) => ({
        date: row.date,
        branchId: row.branch_id,
        status: row.status as 'POSTED' | 'NOT_POSTED',
        equipmentChecked: row.equipment_checked || [],
        reporterName: row.reporter_name || '',
        telegramPostTime: row.telegram_post_time || '',
        note: row.note || '',
        loggedAt: row.logged_at || new Date().toISOString(),
      }));

      allReports = [...allReports, ...mapped];

      if (data.length < limit) {
        hasMore = false; // We fetched fewer rows than requested, so we've reached the end
      } else {
        from += limit; // Advance pointer to next block
      }
    } else {
      hasMore = false;
    }
  }

  return allReports;
}

/**
 * Push/Sync Reports to Supabase (Upsert on composite key: date, branch_id)
 */
export async function pushReportsToSupabase(reportsList: DailyReport[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  if (reportsList.length === 0) return;

  // Prepare chunks of 500 records to prevent HTTP payload size overflows
  const chunkSize = 500;
  for (let i = 0; i < reportsList.length; i += chunkSize) {
    const chunk = reportsList.slice(i, i + chunkSize);
    const rows = chunk.map(r => ({
      date: r.date,
      branch_id: r.branchId,
      status: r.status,
      equipment_checked: r.equipmentChecked,
      reporter_name: r.reporterName,
      telegram_post_time: r.telegramPostTime,
      note: r.note,
      logged_at: r.loggedAt
    }));

    const { error } = await client
      .from('daily_reports')
      .upsert(rows, { onConflict: 'date,branch_id' });

    if (error) {
      throw new Error(`កំហុសបញ្ជូនទិន្នន័យរបាយការណ៍ (Chunk ${i / chunkSize + 1})៖ ${error.message}`);
    }
  }
}

/**
 * Utility to extract error messages from any kind of error object,
 * especially Supabase/Postgrest errors which are plain JS objects.
 */
export function formatError(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.error_description) return err.error_description;
  if (err.details) return `${err.message || 'Error'}: ${err.details}`;
  if (typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

