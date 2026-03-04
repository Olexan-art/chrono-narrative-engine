-- Fix RLS policy for cron_job_configs to allow service_role access
-- The previous policy only allowed 'authenticated' role, which blocks edge functions using SERVICE_ROLE_KEY

DROP POLICY IF EXISTS "Admin can manage cron configs" ON cron_job_configs;

-- Create a more permissive policy that allows service_role (edge functions)
CREATE POLICY "Service and authenticated can manage cron configs" ON cron_job_configs
  FOR ALL
  USING (
    -- Allow if user is authenticated OR if it's a service account (edge function)
    auth.jwt() ->> 'role' IN ('authenticated', 'service_role') 
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Similarly, ensure llm_usage_logs allows service_role
DROP POLICY IF EXISTS "Admin can view LLM usage logs" ON llm_usage_logs;
CREATE POLICY "Service and authenticated can view LLM usage logs" ON llm_usage_logs
  FOR ALL
  USING (
    auth.jwt() ->> 'role' IN ('authenticated', 'service_role')
    OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );
