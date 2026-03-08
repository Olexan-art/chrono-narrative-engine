$migrationFile = "supabase\migrations\20260308010000_add_manual_sentiment_to_wiki_entities.sql"

if (Test-Path $migrationFile) {
    $content = Get-Content $migrationFile -Raw
    Set-Clipboard $content
    Write-Host "Migration copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Migration content:" -ForegroundColor Cyan
    Write-Host $content
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Open Supabase Dashboard - SQL Editor"
    Write-Host "2. Paste the migration (Ctrl+V)"
    Write-Host "3. Click Run to apply the migration"
    Write-Host ""
} else {
    Write-Host "Migration file not found: $migrationFile" -ForegroundColor Red
}
