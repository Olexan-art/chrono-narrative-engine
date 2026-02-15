-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

-- Enable pg_net extension for HTTP requests (needed for cron jobs to call Edge Functions)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- Grant usage to postgres and service_role
GRANT USAGE ON SCHEMA "cron" TO "postgres";
GRANT USAGE ON SCHEMA "cron" TO "service_role";

GRANT USAGE ON SCHEMA "net" TO "postgres";
GRANT USAGE ON SCHEMA "net" TO "service_role";

-- Make sure exec_sql can see these schemas
-- We might need to update exec_sql search_path if it was created without one
ALTER FUNCTION public.exec_sql(text) SET search_path = public, extensions, cron, net;
