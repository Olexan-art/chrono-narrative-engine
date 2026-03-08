# Check if scoring cron jobs exist in Supabase
# This requires direct database access or API call

Write-Host "=== Checking Scoring Cron Jobs ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "To check if cron jobs are installed, run this SQL in Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SELECT jobname, schedule, active, command" -ForegroundColor White
Write-Host "FROM cron.job" -ForegroundColor White
Write-Host "WHERE jobname LIKE '%scoring%';" -ForegroundColor White
Write-Host ""
Write-Host "Expected cron jobs:" -ForegroundColor Yellow
Write-Host "  1. invoke_source_scoring_zai_30min - 0,30 * * * *" -ForegroundColor Gray
Write-Host "  2. invoke_source_scoring_gemini_hourly - 15 * * * *" -ForegroundColor Gray
Write-Host "  3. invoke_source_scoring_openai_3h - 0 */3 * * *" -ForegroundColor Gray
Write-Host ""
Write-Host "To apply the migration if crons don't exist:" -ForegroundColor Yellow
Write-Host "  Option 1: Run in Supabase SQL Editor" -ForegroundColor Cyan
Write-Host "    Copy contents of: supabase\migrations\20260307010000_multi_llm_scoring_crons.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "  Option 2: Run Node.js script (needs SUPABASE_SERVICE_ROLE_KEY in .env)" -ForegroundColor Cyan
Write-Host "    node apply-migration-multi-llm.mjs" -ForegroundColor Gray
Write-Host ""
