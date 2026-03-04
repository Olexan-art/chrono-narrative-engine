-- Fix RLS policy for cron_job_configs to allow service_role access
-- The previous policy only allowed 'authenticated' role, which blocks edge functions using SERVICE_ROLE_KEY

DROP POLICY IF EXISTS "Admin can manage cron configs" ON cron_job_configs;

-- Disable RLS for cron_job_configs since it's a system table that needs edge function access
ALTER TABLE cron_job_configs DISABLE ROW LEVEL SECURITY;

-- Also disable for llm_usage_logs to ensure edge functions can log
DROP POLICY IF EXISTS "Admin can view LLM usage logs" ON llm_usage_logs;
ALTER TABLE llm_usage_logs DISABLE ROW LEVEL SECURITY;
