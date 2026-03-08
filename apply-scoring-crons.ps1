# Apply scoring cron migration manually
Write-Host "=== Applying Scoring Cron Migration ===" -ForegroundColor Cyan
Write-Host ""

$migrationFile = "supabase\migrations\20260307010000_multi_llm_scoring_crons.sql"
$fullPath = Join-Path $PSScriptRoot $migrationFile

if (Test-Path $fullPath) {
    Write-Host "Opening migration file in default editor..." -ForegroundColor Yellow
    Write-Host ""
    
    # Copy to clipboard
    Get-Content $fullPath -Raw | Set-Clipboard
    Write-Host "SQL copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Steps to apply:" -ForegroundColor Yellow
    Write-Host "  1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/tuledxqigzufkecztnlo" -ForegroundColor Cyan
    Write-Host "  2. Open SQL Editor" -ForegroundColor Cyan
    Write-Host "  3. Paste the SQL (already in clipboard: Ctrl+V)" -ForegroundColor Cyan
    Write-Host "  4. Click 'Run' or press Ctrl+Enter" -ForegroundColor Cyan
    Write-Host ""
    
    # Open file for reference
    notepad $fullPath
} else {
    Write-Host "Migration file not found: $migrationFile" -ForegroundColor Red
}
