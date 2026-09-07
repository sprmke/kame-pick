import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl, isCloudMode } from "./config";

export function createClient() {
  if (!isCloudMode()) {
    throw new Error("Supabase is not configured (local mode)");
  }
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
