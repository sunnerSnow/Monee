import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from './env';

let client: SupabaseClient | undefined;

/** 瀏覽器端共用同一個 client */
export function createClient() {
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
