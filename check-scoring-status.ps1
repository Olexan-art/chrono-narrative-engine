# Check scoring cron status using Supabase REST API
# UTF-8 BOM encoding for PowerShell compatibility
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SUPABASE_URL = "https://tuledxqigzufkecztnlo.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0OTA3MjEsImV4cCI6MjA1MTA2NjcyMX0.Yjz91OlXMLfpvPSw2kZw5moCa2WWNX5ycK1ypjRjfaI"

$headers = @{
    "apikey" = $SUPABASE_ANON_KEY
    "Authorization" = "Bearer $SUPABASE_ANON_KEY"
    "Content-Type" = "application/json"
}

Write-Host "=== News Scoring Cron Status ===" -ForegroundColor Cyan
Write-Host ""

# Check total scorings
Write-Host "Scoring Statistics:" -ForegroundColor Yellow
$totalUrl = "$SUPABASE_URL/rest/v1/news_rss_items?select=id,title,source_scoring_at,source_scoring&source_scoring=not.is.null&order=source_scoring_at.desc&limit=20"
try {
    $scorings = Invoke-RestMethod -Uri $totalUrl -Headers $headers -Method Get
    
    if ($scorings.Count -eq 0) {
        Write-Host "  No scorings found" -ForegroundColor Red
    } else {
        Write-Host "  Last $($scorings.Count) scorings found" -ForegroundColor Green
        
        # Calculate today's scorings (last 24 hours)
        $oneDayAgo = (Get-Date).AddDays(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        $todayScorings = $scorings | Where-Object { $_.source_scoring_at -gt $oneDayAgo }
        
        Write-Host "  Last 24 hours: $($todayScorings.Count)/20" -ForegroundColor Cyan
        
        if ($todayScorings.Count -ge 20) {
            Write-Host "  Daily limit reached (20 scorings)" -ForegroundColor Yellow
        } else {
            Write-Host "  Remaining quota: $(20 - $todayScorings.Count) scorings" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Recent scorings (last 24h):" -ForegroundColor Yellow
        
        foreach ($item in $todayScorings | Select-Object -First 10) {
            $scoringTime = [DateTime]::Parse($item.source_scoring_at).ToLocalTime()
            $model = $item.source_scoring.json.model
            $score = $item.source_scoring.json.scores.overall
            
            $provider = "Unknown"
            if ($model -like "*glm*") { $provider = "Z.AI" }
            elseif ($model -like "*gemini*") { $provider = "Gemini" }
            elseif ($model -like "*deepseek*") { $provider = "DeepSeek" }
            elseif ($model -like "*gpt*") { $provider = "OpenAI" }
            
            $title = if ($item.title.Length -gt 60) { $item.title.Substring(0, 57) + "..." } else { $item.title }
            
            Write-Host "  [$provider] $score/100 - $title" -ForegroundColor Gray
            Write-Host "    Time: $scoringTime" -ForegroundColor DarkGray
        }
    }
} catch {
    Write-Host "  Error fetching scorings: $_" -ForegroundColor Red
}

Write-Host ""

# Check news ready for scoring
Write-Host "News ready for scoring:" -ForegroundColor Yellow
$readyUrl = "$SUPABASE_URL/rest/v1/news_rss_items?select=id,title,published_at&content=not.is.null&news_analysis=not.is.null&source_scoring=is.null&order=llm_processed_at.desc&limit=5"
try {
    $ready = Invoke-RestMethod -Uri $readyUrl -Headers $headers -Method Get
    
    if ($ready.Count -eq 0) {
        Write-Host "  No news ready for scoring" -ForegroundColor Yellow
        Write-Host "  (need: retelling + analysis + no scoring)" -ForegroundColor Gray
    } else {
        Write-Host "  Found $($ready.Count) news ready for scoring" -ForegroundColor Green
        foreach ($item in $ready) {
            $title = if ($item.title.Length -gt 70) { $item.title.Substring(0, 67) + "..." } else { $item.title }
            Write-Host "  - $title" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Cron schedule (pg_cron in Supabase):" -ForegroundColor Yellow
Write-Host "  - Z.AI (GLM-4.7-Flash): every 30 min (00 and 30)" -ForegroundColor Gray
Write-Host "  - Gemini (2.5-flash): hourly at :15" -ForegroundColor Gray
Write-Host "  - OpenAI (gpt-4o-mini): every 3 hours at :00" -ForegroundColor Gray
Write-Host "  - Total limit: 20 scorings / 24 hours" -ForegroundColor Gray
Write-Host ""
