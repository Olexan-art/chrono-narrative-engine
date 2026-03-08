# Apply manual sentiment migration
Write-Host "=== Applying Manual Sentiment Migration ===" -ForegroundColor Cyan
Write-Host ""

$migrationFile = "supabase\migrations\20260308000000_add_manual_sentiment_to_news_wiki_entities.sql"
$fullPath = Join-Path $PSScriptRoot $migrationFile

if (Test-Path $fullPath) {
    Write-Host "Opening migration file..." -ForegroundColor Yellow
    Write-Host ""
    
    # Copy to clipboard
    Get-Content $fullPath -Raw | Set-Clipboard
    Write-Host "SQL copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Migration adds:" -ForegroundColor Yellow
    Write-Host "  - manual_sentiment column to news_wiki_entities table" -ForegroundColor Cyan
    Write-Host "  - Values: positive, negative, neutral, mixed, or null" -ForegroundColor Cyan
    Write-Host "  - Allows admins to override LLM narrative sentiment" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Steps to apply:" -ForegroundColor Yellow
    Write-Host "  1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/tuledxqigzufkecztnlo" -ForegroundColor Cyan
    Write-Host "  2. Open SQL Editor" -ForegroundColor Cyan
    Write-Host "  3. Paste the SQL (Ctrl+V)" -ForegroundColor Cyan
    Write-Host "  4. Click 'Run'" -ForegroundColor Cyan
    Write-Host ""
    
    # Show content
    Write-Host "Migration SQL:" -ForegroundColor Yellow
    Get-Content $fullPath | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "Migration file not found: $migrationFile" -ForegroundColor Red
}
