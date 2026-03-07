$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZGNsc3dnZnZxeGxwcnFnbWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0ODAzMDcsImV4cCI6MjA1MzA1NjMwN30.DMOQKtaKBCjKx2KJr8SLHb1V4dYqN6hIZEXIQYy4-3k'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZGNsc3dnZnZxeGxwcnFnbWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0ODAzMDcsImV4cCI6MjA1MzA1NjMwN30.DMOQKtaKBCjKx2KJr8SLHb1V4dYqN6hIZEXIQYy4-3k'
}

Write-Host "Checking source_scoring_at field..." -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri 'https://vpdclswgfvqxlprqgmjt.supabase.co/rest/v1/news_rss_items?select=id,title,source_scoring,source_scoring_at,llm_processed_at&source_scoring=not.is.null&order=source_scoring_at.desc.nullslast&limit=5' -Headers $headers -Method Get

Write-Host "Found $($response.Count) items with scoring" -ForegroundColor Green
Write-Host ""

$withTimestamp = 0
$withoutTimestamp = 0

foreach ($item in $response) {
    $num = $response.IndexOf($item) + 1
    $shortTitle = $item.title.Substring(0, [Math]::Min(60, $item.title.Length))
    Write-Host "$num. $shortTitle..."
    
    if ($item.llm_processed_at) {
        $llmDate = [DateTime]::Parse($item.llm_processed_at).ToString('dd.MM.yyyy HH:mm')
        Write-Host "   LLM processed: $llmDate" -ForegroundColor Gray
    }
    
    if ($item.source_scoring_at) {
        $scoringDate = [DateTime]::Parse($item.source_scoring_at).ToString('dd.MM.yyyy HH:mm')
        Write-Host "   Scoring at: $scoringDate" -ForegroundColor Yellow
        $withTimestamp++
    } else {
        Write-Host "   Scoring at: NULL (needs update)" -ForegroundColor Red
        $withoutTimestamp++
    }
    Write-Host ""
}

Write-Host "Statistics:" -ForegroundColor Cyan
Write-Host "  With timestamp: $withTimestamp" -ForegroundColor Green
Write-Host "  Without timestamp: $withoutTimestamp" -ForegroundColor Red
