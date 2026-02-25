$secret = "bnn-cache-purge-key-2026"
$purgePaths = @("/", "/news/us", "/news/ua", "/news/pl", "/news/in", "/news", "/wiki", "/wiki/ukraine", "/topics")
Write-Host "Purging caches..." -ForegroundColor Yellow
foreach ($p in $purgePaths) {
    try {
        $body = "{`"secret`":`"$secret`",`"path`":`"$p`"}"
        Invoke-WebRequest -Uri "https://bravennow.com/api/cache-purge" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -UseBasicParsing -TimeoutSec 8 | Out-Null
        Write-Host "  PURGED $p" -ForegroundColor Green
    } catch { Write-Host "  FAILED $p" -ForegroundColor Red }
}
Write-Host "Waiting 5s..." -ForegroundColor Yellow
Start-Sleep 5

$ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
$pages = @("/", "/news/us", "/wiki", "/wiki/ukraine", "/topics")

foreach ($p in $pages) {
    try {
        $r = Invoke-WebRequest -Uri "https://bravennow.com$p" -Headers @{"User-Agent"=$ua} -UseBasicParsing -TimeoutSec 20
        $h1s = [regex]::Matches($r.Content, '<h1[^>]*>([\s\S]*?)</h1>') | ForEach-Object { $_.Groups[1].Value -replace '<[^>]+>','' -replace '\s+',' ' -replace '^\s+|\s+$','' }
        $h2s = [regex]::Matches($r.Content, '<h2[^>]*>([\s\S]*?)</h2>') | ForEach-Object { $_.Groups[1].Value -replace '<[^>]+>','' -replace '\s+',' ' -replace '^\s+|\s+$','' } | Select-Object -First 3
        $links = ([regex]::Matches($r.Content, '<a\s+href=')).Count
        $oldH1Header = $r.Content -match '<h1 class="font-sans'
        $hasItemprop  = $r.Content -match 'h1.*itemprop="headline"'

        Write-Host ""
        Write-Host "=== $p ===" -ForegroundColor Cyan
        Write-Host "  Status : $($r.StatusCode) | Size: $($r.Content.Length)B | X-Cache: $($r.Headers['X-Cache'])"
        Write-Host "  H1     : $(if ($h1s) { $h1s[0].Substring(0,[Math]::Min(60,$h1s[0].Length)) } else { '(none)' })" -ForegroundColor $(if ($h1s) { 'Green' } else { 'Red' })
        Write-Host "  H2s    : $($h2s -join ' | ')"
        Write-Host "  Links  : $links | Old H1 header: $oldH1Header | H1 itemprop: $hasItemprop"
    } catch {
        Write-Host "=== $p === ERROR: $_" -ForegroundColor Red
    }
}
