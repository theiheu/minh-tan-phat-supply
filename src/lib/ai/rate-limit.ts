import { createAdminClient } from "@/lib/supabase/admin";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per user

export async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    // Execute the check_and_increment_rate_limit postgres function
    const { data: allowed, error } = await (supabase as any).rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_window_size: `${RATE_LIMIT_WINDOW_SECONDS} seconds`,
      p_max_requests: MAX_REQUESTS_PER_WINDOW
    });

    if (error) {
      console.warn("[Rate Limit DB Warning]:", error.message || error);
      // Fallback to true so transient DB issues do not block valid user requests
      return true; 
    }

    return allowed ?? true;
  } catch (err) {
    console.error("[Rate Limit Exception]:", err);
    return true; // Graceful fallback
  }
}
