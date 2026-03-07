$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZGNsc3dnZnZxeGxwcnFnbWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0ODAzMDcsImV4cCI6MjA1MzA1NjMwN30.DMOQKtaKBCjKx2KJr8SLHb1V4dYqN6hIZEXIQYy4-3k'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZGNsc3dnZnZxeGxwcnFnbWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0ODAzMDcsImV4cCI6MjA1MzA1NjMwN30.DMOQKtaKBCjKx2KJr8SLHb1V4dYqN6hIZEXIQYy4-3k'
}

Write-Host "📊 Перевірка source_scoring_at field`n" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri 'https://vpdclswgfvqxlprqgmjt.supabase.co/rest/v1/news_rss_items?select=id,title,source_scoring,source_scoring_at,llm_processed_at&source_scoring=not.is.null&order=source_scoring_at.desc.nullslast&limit=5' -Headers $headers -Method Get
    
    Write-Host "✅ Знайдено $($response.Count) записів зі скорінгом`n" -ForegroundColor Green
    
    if ($response.Count -gt 0) {
        $withTimestamp = 0
        $withoutTimestamp = 0
        
        foreach ($item in $response) {
            $num = $response.IndexOf($item) + 1
            $shortTitle = $item.title.Substring(0, [Math]::Min(60, $item.title.Length))
            Write-Host "$num. $shortTitle..." -ForegroundColor White
            
            if ($item.llm_processed_at) {
                $llmDate = [DateTime]::Parse($item.llm_processed_at).ToString('dd.MM.yyyy HH:mm')
                Write-Host "   📰 LLM processed: $llmDate" -ForegroundColor Gray
            } else {
                Write-Host "   📰 LLM processed: N/A" -ForegroundColor Gray
            }
            
            if ($item.source_scoring_at) {
                $scoringDate = [DateTime]::Parse($item.source_scoring_at).ToString('dd.MM.yyyy HH:mm')
                Write-Host "   ⭐ Scoring at: $scoringDate" -ForegroundColor Yellow
                $withTimestamp++
            } else {
                Write-Host "   ⭐ Scoring at: ❌ NULL (потрібно оновити)" -ForegroundColor Red
                $withoutTimestamp++
            }
            Write-Host ""
        }
        
        Write-Host "`n📈 Статистика:" -ForegroundColor Cyan
        Write-Host "   ✅ З source_scoring_at: $withTimestamp" -ForegroundColor Green
        Write-Host "   ❌ Без source_scoring_at: $withoutTimestamp" -ForegroundColor Red
        
        if ($withoutTimestamp -gt 0) {
            Write-Host "`n⚠️  $withoutTimestamp записів мають скорінг, але без timestamp" -ForegroundColor Yellow
            Write-Host "   Це нормально для старих записів. Нові будуть з timestamp." -ForegroundColor Gray
        }
    } else {
        Write-Host "ℹ️  Немає записів зі скорінгом для перевірки" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Помилка: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -like '*source_scoring_at*') {
        Write-Host "`n⚠️  Колонка source_scoring_at ще не існує!" -ForegroundColor Yellow
        Write-Host "Потрібно застосувати міграцію в Supabase Dashboard:`n" -ForegroundColor Yellow
        Write-Host "ALTER TABLE public.news_rss_items" -ForegroundColor White
        Write-Host "ADD COLUMN IF NOT EXISTS source_scoring_at TIMESTAMP WITH TIME ZONE;" -ForegroundColor White
    }
}
