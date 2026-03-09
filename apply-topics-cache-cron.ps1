#!/usr/bin/env pwsh
# ============================================================================
# Topics Cache Cron Setup Script
# ============================================================================
# Purpose: Setup automatic cache refresh for topics pages every 6 hours
# ============================================================================

Write-Host "`n🔄 Topics Cache Optimization Setup`n" -ForegroundColor Cyan
Write-Host "This will configure automatic cache refresh for topics pages." -ForegroundColor Gray
Write-Host "Topics will be pre-rendered and cached every 6 hours.`n" -ForegroundColor Gray

# Read migration SQL
$migrationPath = "supabase\migrations\20260309010000_add_topics_cache_cron.sql"
if (!(Test-Path $migrationPath)) {
    Write-Host "❌ Migration file not found: $migrationPath" -ForegroundColor Red
    exit 1
}

$sql = Get-Content $migrationPath -Raw

# Copy to clipboard
$sql | Set-Clipboard

Write-Host "✅ Migration SQL copied to clipboard!`n" -ForegroundColor Green

Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Go to https://supabase.com/dashboard/project/[YOUR_PROJECT]/sql/new" -ForegroundColor White
Write-Host "   2. Paste the SQL (Ctrl+V)" -ForegroundColor White
Write-Host "   3. Click 'Run' to create the cron job`n" -ForegroundColor White

Write-Host "⚙️  Cron Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)" -ForegroundColor Cyan
Write-Host "📄 Pages cached: /topics + top 30 topic pages" -ForegroundColor Cyan
Write-Host "⏱️  Cache TTL: 6 hours (matches SSR cache)" -ForegroundColor Cyan

Write-Host "`n✨ Benefits:" -ForegroundColor Green
Write-Host "   • Users get instant page loads (static HTML)" -ForegroundColor White
Write-Host "   • No real-time database queries for topics" -ForegroundColor White
Write-Host "   • Reduced server load and costs" -ForegroundColor White
Write-Host "   • Better SEO and performance scores`n" -ForegroundColor White

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
