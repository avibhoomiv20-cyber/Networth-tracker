import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabaseKey,
  supabaseUrl,
} from "@/lib/supabase/config";

export { isSupabaseConfigured } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
}
