# Quick check if entity_views table exists
$ErrorActionPreference = "SilentlyContinue"

$supabaseUrl = "https://tuledxqigzufkecztnlo.supabase.co"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0"

Write-Host "`n=== Перевірка статусу міграції ===" -ForegroundColor Cyan

# Check entity_views table
Write-Host "`n[1/3] Перевірка таблиці entity_views..." -ForegroundColor Yellow
$headers = @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $anonKey"
}

try {
    $uri = $supabaseUrl + '/rest/v1/entity_views?select=id`&limit=1'
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET
    Write-Host "✅ Таблиця entity_views ІСНУЄ" -ForegroundColor Green
    Write-Host "   Кількість записів для тесту: $($response.Count)" -ForegroundColor Gray
    $tableExists = $true
} catch {
    if ($_.Exception.Response.StatusCode -eq 404 -or $_.ErrorDetails -match "not found") {
        Write-Host "❌ Таблиця entity_views НЕ ІСНУЄ" -ForegroundColor Red
        Write-Host "   Потрібно застосувати міграцію!" -ForegroundColor Yellow
        $tableExists = $false
    } else {
        Write-Host "⚠️  Помилка при перевірці: $($_.Exception.Message)" -ForegroundColor Yellow
        $tableExists = $false
    }
}

# Check bot_visits table (should always exist)
Write-Host "`n[2/3] Перевірка таблиці bot_visits..." -ForegroundColor Yellow
try {
    $uri = $supabaseUrl + '/rest/v1/bot_visits?select=id`&limit=1'
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET
    Write-Host "✅ Таблиця bot_visits існує ($($response.Count) записів)" -ForegroundColor Green
} catch {
    Write-Host "❌ Таблиця bot_visits не знайдена" -ForegroundColor Red
}

# Check view_visitors table
Write-Host "`n[3/3] Перевірка таблиці view_visitors..." -ForegroundColor Yellow
try {
    $uri = $supabaseUrl + '/rest/v1/view_visitors?select=id`&limit=1'
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET
    Write-Host "✅ Таблиця view_visitors існує ($($response.Count) записів)" -ForegroundColor Green
} catch {
    Write-Host "❌ Таблиця view_visitors не знайдена" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Підсумок ===" -ForegroundColor Cyan
if ($tableExists) {
    Write-Host "✅ Міграція вже застосована - всі таблиці на місці!" -ForegroundColor Green
    Write-Host "   Можна відкривати Dashboard і перевіряти графіки." -ForegroundColor Gray
} else {
    Write-Host "⏳ Потрібно застосувати міграцію:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Варіант 1: Відкрити SQL Editor" -ForegroundColor White
    Write-Host "   https://supabase.com/dashboard/project/tuledxqigzufkecztnlo/sql/new" -ForegroundColor Cyan
    Write-Host "   і виконати SQL з файлу APPLY_MIGRATION.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Варіант 2: Виконати PowerShell скрипт" -ForegroundColor White
    Write-Host "   .\apply-migration.ps1" -ForegroundColor Cyan
    Write-Host ""
}
