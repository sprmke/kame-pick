import { createClient } from "@/lib/supabase/client";
import { isCloudMode } from "@/lib/supabase/config";

/** Bearer token headers for authenticated FastAPI calls in cloud mode. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!isCloudMode()) {
    return {};
  }
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return {};
    }
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return {};
  }
}
