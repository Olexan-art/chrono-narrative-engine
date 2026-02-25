$ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
foreach ($p in @("/","/news/us","/news","/topics","/wiki","/wiki/jeffrey-epstein-2e2fa7f5")) {
    $r = Invoke-WebRequest -Uri "https://bravennow.com$p" -Headers @{"User-Agent"=$ua} -UseBasicParsing -TimeoutSec 20
    $m = [regex]::Match($r.Content, '<h1[^>]*>([\s\S]*?)</h1>')
    $h1 = ($m.Groups[1].Value -replace '<[^>]+>','' -replace '\s+',' ').Trim()
    Write-Host "$p  H1=[$h1]  size=$($r.Content.Length)"
}
