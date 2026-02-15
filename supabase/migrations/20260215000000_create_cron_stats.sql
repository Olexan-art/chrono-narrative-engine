-- Create cron_stats table for tracking cron job execution statistics
CREATE TABLE IF NOT EXISTS cron_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_succeeded INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  llm_model TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries by cron_name and executed_at
CREATE INDEX IF NOT EXISTS idx_cron_stats_cron_name ON cron_stats(cron_name);
CREATE INDEX IF NOT EXISTS idx_cron_stats_executed_at ON cron_stats(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_stats_cron_name_executed_at ON cron_stats(cron_name, executed_at DESC);

-- Enable RLS
ALTER TABLE cron_stats ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert and select
CREATE POLICY "Service role can manage cron_stats"
  ON cron_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy to allow authenticated users to read
CREATE POLICY "Authenticated users can read cron_stats"
  ON cron_stats
  FOR SELECT
  TO authenticated
  USING (true);
