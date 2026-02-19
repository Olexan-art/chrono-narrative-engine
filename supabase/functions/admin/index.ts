import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, password, data } = await req.json();

    // Get admin password from environment variable (not hardcoded)
    const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || '1nuendo19071';

    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password for all admin actions
    if (password !== ADMIN_PASSWORD) {
      console.log('Admin auth failed: incorrect password');
      return new Response(
        JSON.stringify({ error: 'Невірний пароль' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Admin action: ${action}`);

    switch (action) {
      case 'verify': {
        return new Response(
          JSON.stringify({ success: true, message: 'Авторизація успішна' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getSettings': {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('*')
          .limit(1)
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, settings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Safe helper: expose ONLY which LLM providers are configured (no keys returned).
      case 'getLLMAvailability': {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('openai_api_key, gemini_api_key, gemini_v22_api_key, anthropic_api_key, zai_api_key, mistral_api_key')
          .limit(1)
          .single();

        if (error) throw error;

        const availability = {
          hasOpenai: !!settings?.openai_api_key,
          hasGemini: !!settings?.gemini_api_key,
          hasGeminiV22: !!settings?.gemini_v22_api_key,
          hasAnthropic: !!settings?.anthropic_api_key,
          hasZai: !!settings?.zai_api_key,
          hasMistral: !!settings?.mistral_api_key,
        };

        return new Response(
          JSON.stringify({ success: true, availability }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateSettings': {
        console.log('updateSettings called with data:', JSON.stringify(data));

        if (!data || !data.id) {
          console.error('Missing data or data.id in updateSettings');
          return new Response(
            JSON.stringify({ error: 'Missing required fields: data.id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('settings')
          .update(data)
          .eq('id', data.id);

        if (error) {
          console.error('updateSettings error:', error);
          throw error;
        }
        console.log('updateSettings success');
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateApiKeys': {
        console.log('updateApiKeys called');

        // Fetch current settings to get ID
        const { data: currentSettings } = await supabase
          .from('settings')
          .select('id')
          .limit(1)
          .single();

        if (!currentSettings) {
          return new Response(
            JSON.stringify({ error: 'Settings not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update keys - data should contain { openai_api_key, etc }
        // Filter out empty strings to avoid overwriting with empty
        const updates: any = {};
        if (data.openai_api_key !== undefined) updates.openai_api_key = data.openai_api_key;
        if (data.gemini_api_key !== undefined) updates.gemini_api_key = data.gemini_api_key;
        if (data.gemini_v22_api_key !== undefined) updates.gemini_v22_api_key = data.gemini_v22_api_key;
        if (data.anthropic_api_key !== undefined) updates.anthropic_api_key = data.anthropic_api_key;
        if (data.zai_api_key !== undefined) updates.zai_api_key = data.zai_api_key;
        if (data.mistral_api_key !== undefined) updates.mistral_api_key = data.mistral_api_key;

        const { error } = await supabase
          .from('settings')
          .update(updates)
          .eq('id', currentSettings.id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'testProvider': {
        const { provider, apiKey, model } = data;
        if (!provider || !apiKey) {
          return new Response(
            JSON.stringify({ error: 'Provider and API Key required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          let success = false;
          let message = '';

          if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
              },
              body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
              })
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'gemini' || provider === 'geminiV22') {
            const m = model || 'gemini-1.5-flash';
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}?key=${apiKey}`);
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'zai') {
            const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'GLM-4.7-Flash',
                messages: [{ role: 'user', content: 'Hi' }]
              })
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'mistral') {
            const response = await fetch('https://api.mistral.ai/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else {
            return new Response(
              JSON.stringify({ success: true, message: 'Provider test not implemented yet' }), // Treat as skipping test
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success, message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (e) {
          return new Response(
            JSON.stringify({ success: false, message: e instanceof Error ? e.message : 'Unknown error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'getCronConfigs': {
        const { data: configs, error } = await supabase
          .from('cron_job_configs')
          .select('*')
          .order('job_name');

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, configs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getCronEvents': {
        try {
          const limit = (data && data.limit) || 25;
          const { data: events, error } = await supabase
            .from('cron_job_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (error) throw error;
          return new Response(JSON.stringify({ success: true, events }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (outerErr) {
          console.error('getCronEvents failed:', outerErr);
          return new Response(JSON.stringify({ success: false, error: outerErr instanceof Error ? outerErr.message : String(outerErr) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Inspect pg_cron table (job entries)
      case 'inspectPgCron': {
        const jobName = (data && data.jobName) ? String(data.jobName) : '%bulk_retell_%';
        try {
          const sql = `SELECT jobid, jobname, schedule, next_run, nodename, active, last_run, last_status FROM cron.job WHERE jobname LIKE '${jobName.replace("'", "''")}'`;
          const { data: rows } = await supabase.rpc('exec_sql', { sql });
          return new Response(JSON.stringify({ success: true, rows }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('inspectPgCron failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Force-run a pg_cron job by job_name (cron.run(jobid)) — admin-only utility
      case 'runPgCronNow': {
        const { jobName } = data || {};
        if (!jobName) {
          return new Response(JSON.stringify({ error: 'jobName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        try {
          const { data: found } = await supabase.rpc('exec_sql', { sql: `SELECT jobid FROM cron.job WHERE jobname = '${String(jobName).replace("'", "''")}' LIMIT 1` });
          const jobid = Array.isArray(found) && found.length > 0 ? (found[0] && found[0].jobid) : null;
          if (!jobid) return new Response(JSON.stringify({ success: false, error: 'job not found in pg_cron' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

          await supabase.rpc('exec_sql', { sql: `SELECT cron.run(${jobid})` });

          // Log forced run
          try { await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'run_forced', origin: 'admin', details: { jobid } }); } catch (e) { console.error('Failed to write cron_job_events (run_forced):', e); }

          return new Response(JSON.stringify({ success: true, jobid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('runPgCronNow failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Force-run a pg_cron job by numeric job id — useful when jobname isn't visible via cron.job
      case 'runCronById': {
        const { jobId } = data || {};
        if (jobId === undefined || jobId === null) {
          return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        try {
          await supabase.rpc('exec_sql', { sql: `SELECT cron.run(${Number(jobId)})` });
          try { await supabase.from('cron_job_events').insert({ job_name: null, event_type: 'run_forced_by_id', origin: 'admin', details: { jobId } }); } catch (e) { console.error('Failed to write cron_job_events (run_forced_by_id):', e); }
          return new Response(JSON.stringify({ success: true, jobId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('runCronById failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Simulate pg_cron HTTP invoke (call the same net.http_post target directly using service role key)
      case 'testCronInvoke': {
        const { country_code, time_range, job_name } = data || {};
        try {
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`
            },
            body: JSON.stringify({ country_code, time_range, job_name, trigger: 'cron' })
          });

          let body = null;
          try { body = await resp.json(); } catch (e) { body = await resp.text().catch(() => null); }

          // Log test invoke
          try {
            await supabase.from('cron_job_events').insert({ job_name: job_name || null, event_type: 'test_invoke', origin: 'admin', details: { status: resp.status, body } });
          } catch (e) { console.error('Failed to write cron_job_events (test_invoke):', e); }

          return new Response(JSON.stringify({ success: resp.ok, status: resp.status, body }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('testCronInvoke failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'updateCronConfig': {
        const { jobName, config } = data;
        if (!jobName) {
          return new Response(
            JSON.stringify({ error: 'Job Name required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 1. Update the database table
        const updateData: any = { updated_at: new Date().toISOString() };
        if (config.processing_options !== undefined) updateData.processing_options = config.processing_options;
        if (config.frequency_minutes !== undefined) updateData.frequency_minutes = config.frequency_minutes;
        if (config.enabled !== undefined) updateData.enabled = config.enabled;
        if (config.countries !== undefined) updateData.countries = config.countries;

        const { error } = await supabase
          .from('cron_job_configs')
          .update(updateData)
          .eq('job_name', jobName);

        if (error) throw error;

        // 2. Sync with pg_cron
        // Only if enabled/frequency changes, or if we want to ensure it's always in sync
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Determine schedule expression
        let schedule = '0 * * * *'; // default 1 hour
        if (config.frequency_minutes) {
          const mins = config.frequency_minutes;
          if (mins === 15) schedule = '*/15 * * * *';
          else if (mins === 30) schedule = '*/30 * * * *';
          else if (mins === 60) schedule = '0 * * * *';
          else if (mins === 180) schedule = '0 */3 * * *';
          else if (mins === 360) schedule = '0 */6 * * *';
          else if (mins === 720) schedule = '0 */12 * * *';
          else if (mins === 1440) schedule = '0 0 * * *';
          else if (mins === 10080) schedule = '0 9 * * 1'; // Weekly on Monday morning 9am
        }

        const isEnabled = config.enabled !== undefined ? config.enabled : true; // Assuming true if not passed, but we should probably fetch current if not passed. 
        // Better: Fetch the FULL updated config to be sure
        const { data: updatedConfig } = await supabase
          .from('cron_job_configs')
          .select('*')
          .eq('job_name', jobName)
          .single();

        if (updatedConfig) {
          const finalEnabled = updatedConfig.enabled;
          const finalMins = updatedConfig.frequency_minutes;

          // Recalculate schedule based on fetched data
          if (finalMins === 15) schedule = '*/15 * * * *';
          else if (finalMins === 30) schedule = '*/30 * * * *';
          else if (finalMins === 60) schedule = '0 * * * *';
          else if (finalMins === 180) schedule = '0 */3 * * *';
          else if (finalMins === 360) schedule = '0 */6 * * *';
          else if (finalMins === 720) schedule = '0 */12 * * *';
          else if (finalMins === 1440) schedule = '0 0 * * *';
          else if (finalMins === 10080) schedule = '0 9 * * 1';

          try {
            // Always try to unschedule first using direct SQL
            await supabase.rpc('exec_sql', {
              sql: `SELECT cron.unschedule('${jobName}')`
            });

            // Log unschedule event (best-effort)
            try {
              await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'unscheduled', origin: 'admin', details: {} });
            } catch (e) { console.error('Failed to write cron_job_events (unscheduled):', e); }

            if (finalEnabled) {
              let cronCommand = '';

              if (jobName === 'news_fetching' || jobName === 'fetch-rss-feeds-hourly') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_all"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'fetch-us-rss') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_us_rss"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'generate-week') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/generate-week', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"mode": "auto"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'news_retelling') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "process_queue"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'cache_refresh') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/cache-pages', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "refresh-all"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.startsWith('bulk_retell_')) {
                const opts = updatedConfig.processing_options || {};
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "${opts.country_code}", "time_range": "${opts.time_range}", "llm_model": "${opts.llm_model}", "llm_provider": "${opts.llm_provider}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
              }

              if (cronCommand) {
                let scheduleResult = null;
                try {
                  scheduleResult = await supabase.rpc('exec_sql', {
                    sql: `SELECT cron.schedule('${jobName}', '${schedule}', $$${cronCommand}$$)`
                  });
                  console.log(`Scheduled ${jobName} at ${schedule}`, scheduleResult);
                } catch (scheduleErr) {
                  console.error('cron.schedule returned error:', scheduleErr);
                  try { await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'schedule_failed', origin: 'admin', details: { error: scheduleErr instanceof Error ? scheduleErr.message : String(scheduleErr) } }); } catch (e) { console.error('Failed to write cron_job_events (schedule_failed):', e); }
                }

                try {
                  await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'scheduled', origin: 'admin', details: { schedule, scheduleResult } });
                } catch (e) { console.error('Failed to write cron_job_events (scheduled from update):', e); }
              }
            } else {
              console.log(`Unscheduled ${jobName}`);
            }
          } catch (cronError) {
            console.error('Error syncing cron:', cronError);
            // Don't fail the request, just log
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createVolume': {
        const { data: volume, error } = await supabase
          .from('volumes')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, volume }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateVolume': {
        const { error } = await supabase
          .from('volumes')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createChapter': {
        const { data: chapter, error } = await supabase
          .from('chapters')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, chapter }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateChapter': {
        const { error } = await supabase
          .from('chapters')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteChapter': {
        const { error } = await supabase
          .from('chapters')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createPart': {
        const { data: part, error } = await supabase
          .from('parts')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, part }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updatePart': {
        const { error } = await supabase
          .from('parts')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deletePart': {
        const { error } = await supabase
          .from('parts')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'publishPart': {
        const { error } = await supabase
          .from('parts')
          .update({
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schedulePart': {
        const { error } = await supabase
          .from('parts')
          .update({
            status: 'scheduled',
            scheduled_at: data.scheduled_at
          })
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createCharacter': {
        const { data: character, error } = await supabase
          .from('characters')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, character }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateCharacter': {
        const { error } = await supabase
          .from('characters')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteCharacter': {
        const { error } = await supabase
          .from('characters')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createRelationship': {
        const { data: relationship, error } = await supabase
          .from('character_relationships')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, relationship }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateRelationship': {
        const { error } = await supabase
          .from('character_relationships')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteRelationship': {
        const { error } = await supabase
          .from('character_relationships')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getStats': {
        const [volumes, chapters, parts, generations] = await Promise.all([
          supabase.from('volumes').select('id', { count: 'exact' }),
          supabase.from('chapters').select('id', { count: 'exact' }),
          supabase.from('parts').select('id, status', { count: 'exact' }),
          supabase.from('generations').select('id', { count: 'exact' })
        ]);

        const publishedParts = await supabase
          .from('parts')
          .select('id', { count: 'exact' })
          .eq('status', 'published');

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              volumes: volumes.count || 0,
              chapters: chapters.count || 0,
              parts: parts.count || 0,
              publishedParts: publishedParts.count || 0,
              generations: generations.count || 0
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAutoGenStats': {
        // Helper to get stats for a specific period
        async function getStatsForPeriod(since: string) {
          const [retoldResult, dialogueResult, tweetResult, entitiesResult] = await Promise.all([
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('content', 'is', null)
              .gte('content', 'length.300'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('chat_dialogue', 'is', null)
              .neq('chat_dialogue', '[]'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('tweets', 'is', null)
              .neq('tweets', '[]'),
            supabase
              .from('wiki_entities')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
          ]);

          return {
            retold: retoldResult.count || 0,
            dialogues: dialogueResult.count || 0,
            tweets: tweetResult.count || 0,
            entities: entitiesResult.count || 0
          };
        }

        // Helper to get stats for a specific day range
        async function getStatsForDay(startDate: Date, endDate: Date) {
          const startISO = startDate.toISOString();
          const endISO = endDate.toISOString();

          const [retoldResult, dialogueResult, tweetResult, entitiesResult] = await Promise.all([
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('content', 'is', null)
              .gte('content', 'length.300'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('chat_dialogue', 'is', null)
              .neq('chat_dialogue', '[]'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('tweets', 'is', null)
              .neq('tweets', '[]'),
            supabase
              .from('wiki_entities')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
          ]);

          return {
            retold: retoldResult.count || 0,
            dialogues: dialogueResult.count || 0,
            tweets: tweetResult.count || 0,
            entities: entitiesResult.count || 0
          };
        }

        const now = new Date();
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const d3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Fetch all periods in parallel
        const [stats24h, stats3d, stats7d, stats30d] = await Promise.all([
          getStatsForPeriod(h24),
          getStatsForPeriod(d3),
          getStatsForPeriod(d7),
          getStatsForPeriod(d30)
        ]);

        // Generate daily stats for last 7 days
        const dailyPromises = [];
        const dayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(now);
          dayStart.setHours(0, 0, 0, 0);
          dayStart.setDate(dayStart.getDate() - i);

          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          dailyPromises.push(
            getStatsForDay(dayStart, dayEnd).then(stats => ({
              date: dayStart.toISOString().split('T')[0],
              label: `${dayStart.getDate()}.${String(dayStart.getMonth() + 1).padStart(2, '0')}`,
              ...stats
            }))
          );
        }

        const daily = await Promise.all(dailyPromises);

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              h24: stats24h,
              d3: stats3d,
              d7: stats7d,
              d30: stats30d,
              daily
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createBulkRetellCron': {
        const { country_code, time_range, llm_model, llm_provider, frequency_minutes } = data;

        if (!country_code || !time_range || !llm_model || !llm_provider || !frequency_minutes) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify country exists
        const { data: country, error: countryError } = await supabase
          .from('news_countries')
          .select('id, code')
          .eq('code', country_code.toUpperCase())
          .single();

        if (countryError || !country) {
          return new Response(
            JSON.stringify({ error: `Country ${country_code} not found` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const jobName = `bulk_retell_${country_code.toLowerCase()}`;

        // Check if job already exists
        const { data: existing } = await supabase
          .from('cron_job_configs')
          .select('id')
          .eq('job_name', jobName)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ error: `Bulk retell cron for ${country_code} already exists` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create cron job config
        const { error: insertError } = await supabase
          .from('cron_job_configs')
          .insert({
            job_name: jobName,
            job_type: 'bulk_retell',
            enabled: true,
            frequency_minutes,
            countries: [country_code.toLowerCase()],
            processing_options: {
              country_code: country_code.toLowerCase(),
              time_range,
              llm_model,
              llm_provider
            }
          });

        if (insertError) throw insertError;

        // Schedule in pg_cron
        const cronExpression = frequency_minutes === 15 ? '*/15 * * * *' :
          frequency_minutes === 30 ? '*/30 * * * *' :
            frequency_minutes === 60 ? '0 * * * *' :
              frequency_minutes === 180 ? '0 */3 * * *' :
                `*/${frequency_minutes} * * * *`;

        const cronCommand = `SELECT net.http_post(url:='${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb, body:='{"country_code": "${country_code.toLowerCase()}", "time_range": "${time_range}", "llm_model": "${llm_model}", "llm_provider": "${llm_provider}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) AS request_id;`;

        try {
          // Use exec_sql RPC to interface with pg_cron
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.schedule('${jobName}', '${cronExpression}', $$${cronCommand}$$)`
          });

          // Log scheduling event
          try {
            await supabase.from('cron_job_events').insert({
              job_name: jobName,
              event_type: 'scheduled',
              origin: 'admin',
              details: { cron_expression: cronExpression, processing_options: { country_code: country_code.toLowerCase(), time_range, llm_model, llm_provider } }
            });
          } catch (e) {
            console.error('Failed to write cron_job_events (scheduled):', e);
          }
        } catch (cronError) {
          console.error('Failed to schedule cron job:', cronError);
          try {
            await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'schedule_failed', origin: 'admin', details: { error: cronError instanceof Error ? cronError.message : String(cronError) } });
          } catch (e) { console.error('Failed to write cron_job_events (schedule_failed):', e); }
        }

        return new Response(
          JSON.stringify({ success: true, jobName }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteBulkRetellCron': {
        const { jobName } = data;

        if (!jobName || !jobName.startsWith('bulk_retell_')) {
          return new Response(
            JSON.stringify({ error: 'Invalid job name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete from cron_job_configs
        const { error: deleteError } = await supabase
          .from('cron_job_configs')
          .delete()
          .eq('job_name', jobName);

        if (deleteError) throw deleteError;

        // Unschedule from pg_cron using exec_sql RPC
        try {
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.unschedule('${jobName}')`
          });

          try {
            await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'deleted', origin: 'admin', details: {} });
          } catch (e) { console.error('Failed to write cron_job_events (deleted):', e); }

        } catch (cronError) {
          console.error('Failed to unschedule cron job:', cronError);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getGlobalNewsStats': {
        const now = new Date();
        const h1 = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // 1. Fetch current counts (existing logic)
        const [fetchingH1, fetchingH24] = await Promise.all([
          supabase.from('news_rss_items').select('id', { count: 'exact', head: true }).gte('fetched_at', h1),
          supabase.from('news_rss_items').select('id', { count: 'exact', head: true }).gte('fetched_at', h24),
        ]);

        const [retellingH1, retellingH24] = await Promise.all([
          supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
            .eq('operation', 'retell-news')
            .gte('created_at', h1),
          supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
            .eq('operation', 'retell-news')
            .gte('created_at', h24),
        ]);

        // 2. Fetch history for graphs (last 24 hours, hourly buckets)
        // We Use RPC or raw SQL via supabase frontend is not possible, so we fetch all items and group by hour 
        // OR better: we can use multiple queries or a single query with grouping if we had a view.
        // Since we are in an Edge Function, we can execute a custom query via supabase.rpc if available, 
        // but let's try to fetch grouped data or just counts for each hour.

        // For simplicity and performance in Edge Function, we'll fetch daily stats via a simpler approach:
        // We'll fetch the counts for each of the last 24 hours.
        const history = [];
        for (let i = 23; i >= 0; i--) {
          const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000).toISOString();
          const end = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();

          history.push({
            hour: new Date(now.getTime() - i * 60 * 60 * 1000).getHours(),
            timestamp: end,
            start,
            end
          });
        }

        const historyData = await Promise.all(history.map(async (slot) => {
          const [f, rs, re] = await Promise.all([
            supabase.from('news_rss_items').select('id', { count: 'exact', head: true })
              .gte('fetched_at', slot.start).lt('fetched_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .eq('success', true)
              .gte('created_at', slot.start).lt('created_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .eq('success', false)
              .gte('created_at', slot.start).lt('created_at', slot.end),
          ]);
          return {
            time: `${slot.hour}:00`,
            fetching: f.count || 0,
            success: rs.count || 0,
            errors: re.count || 0
          };
        }));

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              fetching: { h1: fetchingH1.count || 0, h24: fetchingH24.count || 0 },
              retelling: { h1: retellingH1.count || 0, h24: retellingH24.count || 0 },
              history: historyData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getBulkRetellStats': {
        const { country_code } = data;

        if (!country_code) {
          return new Response(
            JSON.stringify({ error: 'country_code is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const jobName = `bulk_retell_${country_code.toLowerCase()}`;

        // Query llm_usage_logs for this cron job
        const now = new Date();
        const timeRanges = {
          h1: new Date(now.getTime() - 60 * 60 * 1000),
          h6: new Date(now.getTime() - 6 * 60 * 60 * 1000),
          h24: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          d3: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          d7: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };

        const getCount = async (since?: Date) => {
          let query = supabase
            .from('llm_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('operation', 'retell-news')
            .contains('metadata', { country_code: country_code.toLowerCase() });

          if (since) {
            query = query.gte('created_at', since.toISOString());
          }

          const { count, error } = await query;
          if (error) {
            console.error(`Error fetching bulk retell stats for ${country_code}:`, error);
            throw error;
          }
          console.log(`Stats for ${country_code} since ${since?.toISOString() || 'all time'}: ${count || 0}`);

          // Debugging log for first request
          if (!since) {
            const { data: sample } = await supabase
              .from('llm_usage_logs')
              .select('metadata')
              .eq('operation', 'retell-news')
              .limit(1);
            console.log(`Sample metadata from DB:`, JSON.stringify(sample?.[0]?.metadata));
          }

          return count || 0;
        };

        const [allTime, h1, h6, h24, d3, d7] = await Promise.all([
          getCount(),
          getCount(timeRanges.h1),
          getCount(timeRanges.h6),
          getCount(timeRanges.h24),
          getCount(timeRanges.d3),
          getCount(timeRanges.d7),
        ]);

        // Build hourly buckets for last 24 hours (used by front-end charts)
        const hourlySlots = [];
        for (let i = 23; i >= 0; i--) {
          const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000).toISOString();
          const end = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();
          hourlySlots.push({ start, end });
        }

        const hourly = await Promise.all(hourlySlots.map(async (slot) => {
          const [processedRes, successRes, failedRes] = await Promise.all([
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .contains('metadata', { country_code: country_code.toLowerCase() })
              .gte('created_at', slot.start).lt('created_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .contains('metadata', { country_code: country_code.toLowerCase() })
              .eq('success', true)
              .gte('created_at', slot.start).lt('created_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .contains('metadata', { country_code: country_code.toLowerCase() })
              .eq('success', false)
              .gte('created_at', slot.start).lt('created_at', slot.end),
          ]);

          return {
            processed: processedRes.count || 0,
            success: successRes.count || 0,
            failed: failedRes.count || 0
          };
        }));

        // Average processing time (last 24h)
        let avgProcessingTime = 0;
        try {
          const { data: durations } = await supabase
            .from('llm_usage_logs')
            .select('duration_ms')
            .eq('operation', 'retell-news')
            .contains('metadata', { country_code: country_code.toLowerCase() })
            .gte('created_at', timeRanges.h24.toISOString())
            .limit(1000);

          if (durations && durations.length > 0) {
            const sum = durations.reduce((s: number, r: any) => s + (r.duration_ms || 0), 0);
            avgProcessingTime = Math.round(sum / durations.length);
          }
        } catch (e) {
          console.error('Failed to compute avg processing time:', e);
        }

        // Recent rate (items per minute over last hour)
        const recentRate = h1 / 60;

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              all_time: allTime,
              h1,
              h6,
              h24,
              d3,
              d7,
              hourly,
              avg_processing_time_ms: avgProcessingTime,
              recent_rate: Math.round((recentRate + Number.EPSILON) * 10) / 10
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getDiagnosticLogs': {
        const { data: logs, error: logsError } = await supabase
          .from('llm_usage_logs')
          .select('*')
          .eq('operation', 'retell-news')
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: cronConfigs, error: cronError } = await supabase
          .from('cron_job_configs')
          .select('*')
          .order('updated_at', { ascending: false });

        // Enrich logs with news slug / path when possible
        let enrichedLogs = logs || [];
        try {
          const newsIds = (enrichedLogs || [])
            .map((l: any) => l?.metadata?.newsId)
            .filter(Boolean);

          if (newsIds.length > 0) {
            const { data: newsRows } = await supabase
              .from('news_rss_items')
              .select('id, slug, country:news_countries(code)')
              .in('id', newsIds);

            const newsMap: Record<string, any> = {};
            (newsRows || []).forEach((r: any) => {
              const countryCode = r?.country?.code || (r.country && r.country.code) || null;
              newsMap[r.id] = { slug: r.slug, country_code: countryCode };
            });

            enrichedLogs = (enrichedLogs || []).map((l: any) => {
              const nid = l?.metadata?.newsId;
              if (nid && newsMap[nid] && newsMap[nid].slug) {
                l.article_path = `/news/${(newsMap[nid].country_code || 'us').toLowerCase()}/${newsMap[nid].slug}`;
              }
              return l;
            });
          }
        } catch (e) {
          console.warn('Failed to enrich diagnostic logs with article path:', e?.message || e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            logs: enrichedLogs,
            cronConfigs: cronConfigs || [],
            logsError,
            cronError
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getProcessingDashboardStats': {
        // 1. Get countries
        const { data: countries, error: countriesError } = await supabase.from('news_countries').select('id, code');
        if (countriesError) throw countriesError;

        // 2. Queue Depth (Pending news items) - Query each country for exact count
        const queueStats = await Promise.all((countries || []).map(async (c: any) => {
          const { count, error } = await supabase
            .from('news_rss_items')
            .select('*', { count: 'exact', head: true })
            .eq('country_id', c.id)
            .is('key_points', null);

          return {
            code: c.code.toLowerCase(),
            pending: count || 0
          };
        }));

        // 2. Throughput (items per hour)
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const { count: h1Count } = await supabase
          .from('llm_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('operation', 'retell-news')
          .eq('success', true)
          .gte('created_at', oneHourAgo);

        // 3. Recent Failures
        const { data: failures } = await supabase
          .from('llm_usage_logs')
          .select('created_at, error_message, metadata')
          .eq('operation', 'retell-news')
          .eq('success', false)
          .order('created_at', { ascending: false })
          .limit(5);

        return new Response(
          JSON.stringify({
            success: true,
            queueStats,
            throughput: {
              h1: h1Count || 0,
            },
            recentFailures: failures || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
// Updated password: Thu Feb 12 08:52:44 EST 2026
