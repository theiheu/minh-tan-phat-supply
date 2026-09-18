import { createAdminClient } from "@/lib/supabase/admin";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 20;

export async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    // We execute the check_and_increment_rate_limit postgres function
    const { data: allowed, error } = await (supabase as any).rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_window_size: `${RATE_LIMIT_WINDOW_SECONDS} seconds`,
      p_max_requests: MAX_REQUESTS_PER_WINDOW
    });

    if (error) {
      console.warn("Rate limit DB error:", error);
      return false; 
    }

    return allowed ?? true;
  } catch (err) {
    console.error("Rate limit exception:", err);
    return false; // Fail closed
  }
}
