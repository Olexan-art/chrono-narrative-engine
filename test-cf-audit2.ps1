
# Purge caches
$secret = "bnn-cache-purge-key-2026"
$purgePaths = @("/", "/news/us", "/news/ua", "/news/pl", "/news/in", "/news", "/wiki", "/wiki/ukraine", "/topics")

Write-Host "Purging caches via new endpoint..." -ForegroundColor Yellow
foreach ($p in $purgePaths) {
    try {
        $body = "{`"secret`":`"$secret`",`"path`":`"$p`"}"
        $r = Invoke-WebRequest -Uri "https://bravennow.com/api/cache-purge" -Method POST `
            -Headers @{"Content-Type"="application/json"} `
            -Body $body -UseBasicParsing -TimeoutSec 10
        Write-Host "  OK $p : $($r.Content)" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED $p : $_" -ForegroundColor Red
    }
}

Write-Host "`nWaiting 6s for SSR to regenerate..." -ForegroundColor Yellow
Start-Sleep 6

# Audit
$ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
$pages = @("/", "/news/us", "/news", "/wiki", "/wiki/ukraine", "/topics")

Write-Host "`n=== H1 AUDIT ===" -ForegroundColor Cyan
foreach ($p in $pages) {
    try {
        $r = Invoke-WebRequest -Uri "https://bravennow.com$p" `
            -Headers @{"User-Agent"=$ua} -UseBasicParsing -TimeoutSec 25
        $h1s = [regex]::Matches($r.Content, '<h1[^>]*>([\s\S]*?)</h1>') |
               ForEach-Object { ($_.Groups[1].Value -replace '<[^>]+>','' -replace '\s+',' ').Trim() }
        $h2s = [regex]::Matches($r.Content, '<h2[^>]*>([\s\S]*?)</h2>') |
               ForEach-Object { ($_.Groups[1].Value -replace '<[^>]+>','' -replace '\s+',' ').Trim() } |
               Select-Object -First 2
        $hasH1 = $h1s -and $h1s.Count -gt 0 -and $h1s[0].Length -gt 0
        $color = if ($hasH1) { "Green" } else { "Red" }
        $h1text = if ($hasH1) { $h1s[0] } else { "(MISSING)" }
        if ($h1text.Length -gt 55) { $h1text = $h1text.Substring(0,55) + "..." }
        Write-Host ("  " + $p.PadRight(18) + " | " + "$($r.Content.Length)B".PadRight(10) + " | H1: $h1text") -ForegroundColor $color
        if ($h2s) {
            Write-Host ("  " + "".PadRight(18) + "   H2s: " + ($h2s -join " | ")) -ForegroundColor Gray
        }
    } catch {
        Write-Host "  $p  ERROR: $_" -ForegroundColor Red
    }
}
