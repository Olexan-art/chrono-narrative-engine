$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZGNsc3dnZnZxeGxwcnFnbWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0ODAzMDcsImV4cCI6MjA1MzA1NjMwN30.DMOQKtaKBCjKx2KJr8SLHb1V4dYqN6hIZEXIQYy4-3k'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZGNsc3dnZnZxeGxwcnFnbWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0ODAzMDcsImV4cCI6MjA1MzA1NjMwN30.DMOQKtaKBCjKx2KJr8SLHb1V4dYqN6hIZEXIQYy4-3k'
}

Write-Host "=== Debugging Scoring Issues ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check Netlify deploy status
Write-Host "1. Checking Netlify Deploy Status..." -ForegroundColor Yellow
Write-Host "   Visit: https://app.netlify.com/" -ForegroundColor Gray
Write-Host ""

# 2. Check how many scorings have timestamp
Write-Host "2. Checking source_scoring_at field..." -ForegroundColor Yellow
$scor = Invoke-RestMethod -Uri 'https://vpdclswgfvqxlprqgmjt.supabase.co/rest/v1/news_rss_items?select=id,source_scoring_at&source_scoring=not.is.null&limit=100' -Headers $headers -Method Get
$withTime = ($scor | Where-Object { $null -ne $_.source_scoring_at }).Count
$withoutTime = $scor.Count - $withTime
Write-Host "   Total with scoring: $($scor.Count)" -ForegroundColor White
Write-Host "   With timestamp: $withTime" -ForegroundColor Green
Write-Host "   Without timestamp: $withoutTime" -ForegroundColor Red
Write-Host ""

# 3. Check if there are news ready for scoring
Write-Host "3. Checking news ready for scoring..." -ForegroundColor Yellow
try {
    $ready = Invoke-RestMethod -Uri 'https://vpdclswgfvqxlprqgmjt.supabase.co/rest/v1/news_rss_items?select=id&content=not.is.null&news_analysis=not.is.null&source_scoring=is.null&limit=10' -Headers $headers -Method Get
    Write-Host "   News ready for scoring: $($ready.Count)" -ForegroundColor $(if($ready.Count -gt 0){'Green'}else{'Red'})
} catch {
    Write-Host "   Error checking: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 4. Show recent scorings
Write-Host "4. Recent scorings (last 5)..." -ForegroundColor Yellow
$recent = Invoke-RestMethod -Uri 'https://vpdclswgfvqxlprqgmjt.supabase.co/rest/v1/news_rss_items?select=title,source_scoring_at,source_scoring&source_scoring=not.is.null&order=source_scoring_at.desc.nullslast&limit=5' -Headers $headers -Method Get
foreach ($item in $recent) {
    $shortTitle = $item.title.Substring(0, [Math]::Min(50, $item.title.Length))
    if ($item.source_scoring_at) {
        $date = [DateTime]::Parse($item.source_scoring_at).ToString('dd.MM.yyyy HH:mm')
        Write-Host "   $date - $shortTitle..." -ForegroundColor Green
    } else {
        Write-Host "   NO TIMESTAMP - $shortTitle..." -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host "1. Check Netlify deploy completed: https://app.netlify.com/" -ForegroundColor Yellow
Write-Host "2. Run debug-scoring-cron.sql in Supabase Dashboard to check crons" -ForegroundColor Yellow
Write-Host "3. If ready news > 0, trigger manual scoring to test" -ForegroundColor Yellow
