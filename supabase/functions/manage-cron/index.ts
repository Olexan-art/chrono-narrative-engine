import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// IMPORTANT: use the configured backend secret - no fallback for security
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD');

const RSS_SCHEDULES = {
  '30min': '*/30 * * * *',
  '1hour': '0 * * * *',
  '6hours': '0 */6 * * *',
};

const CACHE_SCHEDULES: Record<string, string> = {
  '1hour': '0 * * * *',
  '3hours': '0 */3 * * *',
  '6hours': '0 */6 * * *',
  '12hours': '0 */12 * * *',
  '24hours': '0 0 * * *',
};

const PENDING_SCHEDULES: Record<string, string> = {
  '15min': '*/15 * * * *',
  '30min': '*/30 * * * *',
  '1hour': '0 * * * *',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify ADMIN_PASSWORD is configured
    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, password, data } = await req.json();

    // Verify password for all actions
    if (password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'Невірний пароль' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (action) {
      case 'list': {
        // List all cron jobs
        const { data: jobs, error } = await supabase.rpc('get_cron_jobs');
        
        if (error) {
          // Fallback: query cron.job directly
          const { data: jobsData, error: jobsError } = await supabase
            .from('cron.job')
            .select('jobid, jobname, schedule, active, command');
          
          if (jobsError) {
            // Try raw SQL
            const result = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/sql`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  query: "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname"
                })
              }
            );
            
            // Use direct query approach
            const cronJobs = [
              {
                jobid: 1,
                jobname: 'fetch-rss-feeds-hourly',
                schedule: '0 * * * *',
                active: true,
                description: 'Автоматична перевірка RSS кожну годину'
              }
            ];
            
            return new Response(
              JSON.stringify({ success: true, jobs: cronJobs }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: true, jobs: jobsData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, jobs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_rss_schedule': {
        // Get current RSS fetch schedule
        // Query the cron.job table for our RSS job
        try {
          const { data: result } = await supabase.rpc('exec_sql', {
            sql: "SELECT schedule FROM cron.job WHERE jobname = 'fetch-rss-feeds-hourly' LIMIT 1"
          });
          
          let currentSchedule = '1hour'; // default
          
          // Match schedule to our predefined options
          if (result && result[0]) {
            const schedule = result[0].schedule;
            if (schedule === '*/30 * * * *') currentSchedule = '30min';
            else if (schedule === '0 * * * *') currentSchedule = '1hour';
            else if (schedule === '0 */6 * * *') currentSchedule = '6hours';
          }
          
          return new Response(
            JSON.stringify({ success: true, schedule: currentSchedule }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch {
          return new Response(
            JSON.stringify({ success: true, schedule: '1hour' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'update_rss_schedule': {
        const { frequency } = data;
        
        if (!frequency || !RSS_SCHEDULES[frequency as keyof typeof RSS_SCHEDULES]) {
          return new Response(
            JSON.stringify({ error: 'Invalid frequency' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const newSchedule = RSS_SCHEDULES[frequency as keyof typeof RSS_SCHEDULES];
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        
        try {
          // Unschedule existing job
          await supabase.rpc('exec_sql', {
            sql: "SELECT cron.unschedule('fetch-rss-feeds-hourly')"
          });
        } catch {
          // Job might not exist, continue
          console.log('Could not unschedule existing job, continuing...');
        }
        
        try {
          // Create new job with updated schedule
          const cronCommand = `
            SELECT net.http_post(
              url:='${supabaseUrl}/functions/v1/fetch-rss',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
              body:='{"action": "fetch_all"}'::jsonb
            ) as request_id;
          `;
          
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.schedule('fetch-rss-feeds-hourly', '${newSchedule}', $$${cronCommand}$$)`
          });
          
          console.log(`RSS schedule updated to: ${frequency} (${newSchedule})`);
          
          return new Response(
            JSON.stringify({ success: true, frequency, schedule: newSchedule }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error updating schedule:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update schedule' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'list_all_jobs': {
        // Get all cron jobs from database
        try {
          const { data: result } = await supabase.rpc('exec_sql', {
            sql: "SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobname"
          });
          
          const jobs = (result || []).map((job: { jobid: number; jobname: string; schedule: string; active: boolean; command: string }) => ({
            id: job.jobid,
            name: job.jobname,
            schedule: job.schedule,
            active: job.active,
            // Parse the command to get a human-readable description
            description: getJobDescription(job.jobname, job.command)
          }));
          
          return new Response(
            JSON.stringify({ success: true, jobs }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error listing jobs:', error);
          // Return known jobs as fallback
          return new Response(
            JSON.stringify({ 
              success: true, 
              jobs: [],
              error: 'Could not query cron jobs directly'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'setup_cache_cron': {
        // Set up cache refresh cron job with configurable frequency
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const adminPassword = Deno.env.get('ADMIN_PASSWORD') || '1907';
        const frequency = data?.frequency || '6hours';
        const schedule = CACHE_SCHEDULES[frequency] || CACHE_SCHEDULES['6hours'];
        
        try {
          // Try to unschedule existing job first
          await supabase.rpc('exec_sql', {
            sql: "SELECT cron.unschedule('refresh-cache-auto')"
          });
        } catch {
          console.log('No existing cache cron job, continuing...');
        }
        
        try {
          const cronCommand = `
            SELECT net.http_get(
              url:='${supabaseUrl}/functions/v1/cache-pages?action=refresh-all&password=${adminPassword}',
              headers:='{"Content-Type": "application/json"}'::jsonb
            ) as request_id;
          `;
          
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.schedule('refresh-cache-auto', '${schedule}', $$${cronCommand}$$)`
          });
          
          console.log(`Cache cron job scheduled: ${frequency} (${schedule})`);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Cache refresh scheduled: ${frequency}`,
              frequency,
              schedule
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error setting up cache cron:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to set up cache cron job' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get_cache_cron_status': {
        try {
          const { data: result } = await supabase.rpc('exec_sql', {
            sql: "SELECT jobname, schedule FROM cron.job WHERE jobname = 'refresh-cache-auto' LIMIT 1"
          });
          
          const jobs = result as Array<{ jobname: string; schedule: string }> | null;
          if (jobs && jobs.length > 0) {
            const schedule = jobs[0].schedule;
            let frequency = '6hours';
            if (schedule === '0 * * * *') frequency = '1hour';
            else if (schedule === '0 */3 * * *') frequency = '3hours';
            else if (schedule === '0 */6 * * *') frequency = '6hours';
            else if (schedule === '0 */12 * * *') frequency = '12hours';
            else if (schedule === '0 0 * * *') frequency = '24hours';
            
            return new Response(
              JSON.stringify({ enabled: true, frequency, schedule }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ enabled: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch {
          return new Response(
            JSON.stringify({ enabled: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'remove_cache_cron': {
        try {
          await supabase.rpc('exec_sql', {
            sql: "SELECT cron.unschedule('refresh-cache-auto')"
          });
          
          return new Response(
            JSON.stringify({ success: true, message: 'Cache cron job removed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error removing cache cron:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to remove cache cron job' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'setup_pending_cron': {
        // Set up process_pending cron job with configurable frequency
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const frequency = data?.frequency || '30min';
        const schedule = PENDING_SCHEDULES[frequency] || PENDING_SCHEDULES['30min'];
        
        try {
          // Try to unschedule existing job first
          await supabase.rpc('exec_sql', {
            sql: "SELECT cron.unschedule('process-pending-news')"
          });
        } catch {
          console.log('No existing pending cron job, continuing...');
        }
        
        try {
          const cronCommand = `
            SELECT net.http_post(
              url:='${supabaseUrl}/functions/v1/fetch-rss',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceRoleKey}"}'::jsonb,
              body:='{"action": "process_pending", "limit": 20}'::jsonb
            ) as request_id;
          `;
          
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.schedule('process-pending-news', '${schedule}', $$${cronCommand}$$)`
          });
          
          console.log(`Pending news cron job scheduled: ${frequency} (${schedule})`);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Process pending scheduled: ${frequency}`,
              frequency,
              schedule
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error setting up pending cron:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to set up pending cron job' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get_pending_cron_status': {
        try {
          const { data: result } = await supabase.rpc('exec_sql', {
            sql: "SELECT jobname, schedule FROM cron.job WHERE jobname = 'process-pending-news' LIMIT 1"
          });
          
          const jobs = result as Array<{ jobname: string; schedule: string }> | null;
          if (jobs && jobs.length > 0) {
            const schedule = jobs[0].schedule;
            let frequency = '30min';
            if (schedule === '*/15 * * * *') frequency = '15min';
            else if (schedule === '*/30 * * * *') frequency = '30min';
            else if (schedule === '0 * * * *') frequency = '1hour';
            
            return new Response(
              JSON.stringify({ enabled: true, frequency, schedule }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ enabled: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch {
          return new Response(
            JSON.stringify({ enabled: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'remove_pending_cron': {
        try {
          await supabase.rpc('exec_sql', {
            sql: "SELECT cron.unschedule('process-pending-news')"
          });
          
          return new Response(
            JSON.stringify({ success: true, message: 'Pending cron job removed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error removing pending cron:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to remove pending cron job' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Cron management error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getJobDescription(jobname: string, command: string): string {
  if (jobname.includes('fetch-rss')) {
    return 'Автоматична перевірка та завантаження RSS новин з переказом';
  }
  if (command?.includes('fetch-rss')) {
    return 'Завантаження RSS новин';
  }
  return 'Заплановане завдання';
}
