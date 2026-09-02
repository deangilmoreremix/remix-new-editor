-- Enable pg_cron extension for scheduled jobs
-- This allows the rate_limit_cleanup function to run periodically
-- without relying on external cron infrastructure.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule rate limit cleanup to run every hour.
-- Deletes rows older than 24 hours from the rate_limits table.
-- Without this, the rate_limits table will grow unbounded.
--
-- The cron schema is owned by the postgres role, which has permission
-- to execute the SECURITY DEFINER function public.rate_limit_cleanup.

SELECT cron.schedule(
  'rate-limit-cleanup',
  '0 * * * *',  -- every hour at minute 0
  'SELECT public.rate_limit_cleanup(24);'
);

-- Verify the job was created
-- SELECT * FROM cron.job WHERE jobname = 'rate-limit-cleanup';
