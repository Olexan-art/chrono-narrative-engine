INSERT INTO cron_job_events (job_name, event_type, origin, status, details, created_at) VALUES
('retell_recent_usa', 'run_finished', 'github', 'success', '{"provider":"zai","llm_model":"GLM-4.7-Flash","success_count":15}'::jsonb, NOW() - INTERVAL '1 hour'),
('retell_recent_usa', 'run_finished', 'github', 'success', '{"provider":"deepseek","llm_model":"deepseek-chat","success_count":12}'::jsonb, NOW() - INTERVAL '2 hours'),
('retell_recent_usa', 'run_finished', 'github', 'success', '{"provider":"zai","llm_model":"GLM-4.7-Flash","success_count":18}'::jsonb, NOW() - INTERVAL '3 hours'),
('retell_recent_usa', 'run_finished', 'github', 'success', '{"provider":"deepseek","llm_model":"deepseek-chat","success_count":14}'::jsonb, NOW() - INTERVAL '4 hours');
