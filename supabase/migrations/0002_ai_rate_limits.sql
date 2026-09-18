-- Migration: 0002_ai_rate_limits
-- Purpose: Support AI chat per-user rate limiting and concurrency locking.
-- Requires: UUID extension, profiles table.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    user_id UUID NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, window_start)
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON public.api_rate_limits(window_start);

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
    p_user_id UUID,
    p_window_size INTERVAL,
    p_max_requests INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_count INT;
BEGIN
    -- Tính thời điểm bắt đầu của window (fixed window)
    v_window_start := date_trunc('minute', now());

    -- Upsert request_count
    INSERT INTO public.api_rate_limits (user_id, window_start, request_count)
    VALUES (p_user_id, v_window_start, 1)
    ON CONFLICT (user_id, window_start) 
    DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
    RETURNING request_count INTO v_count;

    IF v_count > p_max_requests THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
