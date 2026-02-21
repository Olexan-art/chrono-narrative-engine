$ErrorActionPreference = "Stop"

# Read Supabase credentials from .env
$envContent = Get-Content .env | Where-Object { $_ -match 'VITE_SUPABASE' }
$supabaseUrl = ($envContent | Where-Object { $_ -match 'VITE_SUPABASE_URL' }) -replace '.*="(.*)"', '$1'
$anonKey = ($envContent | Where-Object { $_ -match 'VITE_SUPABASE_PUBLISHABLE_KEY' }) -replace '.*="(.*)"', '$1'

Write-Host "Applying entity_views migration..." -ForegroundColor Cyan

# Read migration SQL
$migrationSql = Get-Content "supabase\migrations\20260221000000_add_entity_views_log.sql" -Raw

# Open Supabase Dashboard
Write-Host ""
Write-Host "Opening Supabase SQL Editor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please execute the SQL from APPLY_MIGRATION.sql file" -ForegroundColor White
Write-Host ""

# Copy SQL to clipboard
try {
    $migrationSql | Set-Clipboard
    Write-Host "SQL copied to clipboard!" -ForegroundColor Green
    Write-Host "Paste it in the SQL Editor and click RUN" -ForegroundColor Cyan
} catch {
    Write-Host "SQL is in file: APPLY_MIGRATION.sql" -ForegroundColor Yellow
}

# Open browser
Start-Process "https://supabase.com/dashboard/project/tuledxqigzufkecztnlo/sql/new"

Write-Host ""
Write-Host "After applying migration, press any key to continue..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Write-Host ""
Write-Host "Migration applied! Now deploying functions..." -ForegroundColor Green
