# BOT SSR AUDIT — bravennow.com
# Перевіряє: контент, слова, посилання, зображення, SEO, JSON-LD, canonical
# Порівнює відповіді для ботів vs звичайного браузера (клоакінг-детектор)

$urls = [ordered]@{
  "Головна" = "https://bravennow.com/"
  "Новина"  = "https://bravennow.com/news/US/netflix-prime-video-and-other-streamers-in-uk-will-be-subject-to-enhanced-regulation-and-ofcom-inves"
  "Wiki"    = "https://bravennow.com/wiki/1f515c0a-2e92-4540-b57e-f04807826a2c"
  "Topics"  = "https://bravennow.com/topics"
}

$bots = [ordered]@{
  "Googlebot"  = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
  "GPTBot"     = "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
  "Twitterbot" = "Twitterbot/1.0"
  "Bingbot"    = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
  "Facebook"   = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
  "Browser"    = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36"
}

function Analyze-Html($html, $url) {
  $title  = if ($html -match '<title>([^<]+)</title>')                        { $matches[1].Trim() } else { "" }
  $desc   = if ($html -match 'name="description"\s+content="([^"]+)"')        { $matches[1].Trim() }
            elseif ($html -match 'content="([^"]+)"\s+name="description"')    { $matches[1].Trim() } else { "" }
  $canon  = if ($html -match 'rel="canonical"\s+href="([^"]+)"')              { $matches[1].Trim() }
            elseif ($html -match 'href="([^"]+)"\s+rel="canonical"')          { $matches[1].Trim() } else { "" }
  $h1     = if ($html -match '<h1[^>]*>\s*([^<]+)\s*</h1>')                  { $matches[1].Trim() } else { "" }

  $text   = $html -replace '(?s)<script[^>]*>.*?</script>', ' '
  $text   = $text  -replace '(?s)<style[^>]*>.*?</style>',  ' '
  $text   = $text  -replace '<[^>]+>', ' '
  $text   = $text  -replace '&[a-z]+;', ' '
  $text   = $text  -replace '\s+', ' '
  $words  = ($text.Trim().Split(' ') | Where-Object { $_.Length -gt 2 }).Count

  $intLinks = ([regex]::Matches($html, 'href="(/[^"#?][^"]*|https://bravennow\.com/[^"]*)"') |
               Where-Object { $_.Groups[1].Value -notmatch '\.(css|js|png|svg|ico|xml|txt|webp|jpg|jpeg)' }).Count
  $extLinks = ([regex]::Matches($html, 'href="https?://(?!bravennow\.com)[^"]+"')).Count
  $imgTotal = ([regex]::Matches($html, '<img\s')).Count
  $imgAlt   = ([regex]::Matches($html, '<img\s[^>]*alt="[^"]{2,}')).Count

  $ldMatches = [regex]::Matches($html, '<script type="application/ld\+json">([\s\S]*?)</script>')
  $ldTypes   = $ldMatches | ForEach-Object {
    [regex]::Matches($_.Groups[1].Value, '"@type"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  } | Select-Object -Unique

  $ogOk   = [bool]($html -match 'property="og:title"') -and [bool]($html -match 'property="og:image"') -and [bool]($html -match 'property="og:description"')
  $twOk   = [bool]($html -match 'name="twitter:card"')
  $canonOk = $canon.TrimEnd('/') -eq $url.TrimEnd('/')
  $isSpa  = ($html -match '<div id="root">\s*</div>') -and ($html.Length -lt 8000)

  return [PSCustomObject]@{
    Title    = if ($title.Length -gt 72) { $title.Substring(0,69)+"..." } else { $title }
    Desc     = if ($desc.Length -gt 90)  { $desc.Substring(0,87)+"..." }  else { $desc }
    H1       = if ($h1.Length -gt 65)    { $h1.Substring(0,62)+"..." }    else { $h1 }
    Canon    = $canon
    CanonOk  = $canonOk
    SizeKB   = [Math]::Round($html.Length / 1024, 1)
    Words    = $words
    LinksInt = $intLinks
    LinksExt = $extLinks
    ImgTotal = $imgTotal
    ImgAlt   = $imgAlt
    LdTypes  = ($ldTypes -join ", ")
    OgOk     = $ogOk
    TwOk     = $twOk
    IsSpa    = $isSpa
  }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BOT SSR AUDIT — bravennow.com — $(Get-Date -Format 'yyyy-MM-dd HH:mm')               ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

foreach ($pageName in $urls.Keys) {
  $pageUrl = $urls[$pageName]

  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan
  Write-Host "  📄  $pageName  $pageUrl" -ForegroundColor Yellow
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan

  $refResult = $null  # Googlebot result for comparison

  foreach ($botName in $bots.Keys) {
    $ua = $bots[$botName]
    try {
      $t0   = Get-Date
      $resp = Invoke-WebRequest -Uri $pageUrl `
                -Headers @{ "User-Agent" = $ua; "Accept" = "text/html,application/xhtml+xml,*/*;q=0.9" } `
                -TimeoutSec 25 -UseBasicParsing -ErrorAction Stop
      $ms   = [int]((Get-Date) - $t0).TotalMilliseconds

      $xCache  = if ($resp.Headers["X-Cache"])          { $resp.Headers["X-Cache"] }          else { "—" }
      $xBotH   = if ($resp.Headers["X-Bot-Detected"])   { $resp.Headers["X-Bot-Detected"] }   else { "—" }

      $a = Analyze-Html $resp.Content $pageUrl
      if ($botName -eq "Googlebot") { $refResult = $a }

      $quality = if     ($a.IsSpa)                               { "🔴 SPA-ЗАГЛУШКА" }
                 elseif ($xCache -eq "BYPASS-SPA")               { "🟡 SPA (bypass)" }
                 elseif ($xCache -eq "SSR-TOO-SMALL")            { "🔴 SSR<10KB" }
                 elseif ($xCache -eq "STALE-DB-FALLBACK")        { "🟠 Stale-DB" }
                 elseif ($xCache -eq "STALE-FALLBACK")           { "🟠 Stale-SSR" }
                 elseif ($a.SizeKB -gt 15 -and $a.Words -gt 80)  { "🟢 ПОВНИЙ HTML" }
                 elseif ($a.SizeKB -gt 5)                        { "🟡 Частковий" }
                 else                                             { "🔴 Порожній" }

      $seo = @()
      if ($a.OgOk)    { $seo += "OG✅" } else { $seo += "OG❌" }
      if ($a.CanonOk) { $seo += "Canon✅" } else { $seo += "Canon⚠️" }
      if ($a.TwOk)    { $seo += "TW✅" } else { $seo += "TW❌" }
      if ($a.LdTypes) { $seo += "LD✅" } else { $seo += "LD❌" }

      $col = switch -Wildcard ($quality) {
        "*ПОВНИЙ*" { "Green" }; "*🔴*" { "Red" }; "*🟠*" { "Yellow" }; default { "DarkYellow" }
      }

      Write-Host ""
      Write-Host ("  ▶  {0,-12}  [{1}] {2,5}ms  {3}  X-Cache:{4}" -f $botName,$resp.StatusCode,$ms,$quality,$xCache) -ForegroundColor $col
      Write-Host ("     Розмір:{0,7}KB  Слів:{1,5}  Посил:{2}вн/{3}зов  Зобр:{4}({5}alt)" -f `
        $a.SizeKB, $a.Words, $a.LinksInt, $a.LinksExt, $a.ImgTotal, $a.ImgAlt) -ForegroundColor DarkGray
      Write-Host ("     SEO: {0}  JSON-LD:[{1}]" -f ($seo -join " "), $(if($a.LdTypes){$a.LdTypes}else{"—"})) -ForegroundColor DarkGray
      if ($a.Title) { Write-Host ("     title: {0}" -f $a.Title) -ForegroundColor DarkGray }
      if ($botName -eq "Googlebot" -and $a.H1)  { Write-Host ("     h1:    {0}" -f $a.H1) -ForegroundColor DarkGray }
      if ($botName -eq "Googlebot" -and $a.Desc) { Write-Host ("     desc:  {0}" -f $a.Desc) -ForegroundColor DarkGray }
      if (-not $a.CanonOk -and $a.Canon) {
        Write-Host ("     ⚠️  Canonical: '{0}'" -f $a.Canon) -ForegroundColor Yellow
      }

      # Cloaking check: Browser vs Googlebot
      if ($botName -eq "Browser" -and $refResult) {
        $dw = $a.Words    - $refResult.Words
        $dl = $a.LinksInt - $refResult.LinksInt
        $ds = $a.SizeKB   - $refResult.SizeKB
        $warn = [Math]::Abs($dw) -gt 200 -or [Math]::Abs($ds) -gt 20
        Write-Host ""
        Write-Host "  ┌─ ПОРІВНЯННЯ Browser vs Googlebot ─────────────────────────" -ForegroundColor DarkMagenta
        Write-Host ("  │  Слів:     Googlebot={0,5}  Browser={1,5}  Δ={2}" -f $refResult.Words, $a.Words, $dw) `
          -ForegroundColor $(if([Math]::Abs($dw) -gt 200){"Yellow"}else{"DarkMagenta"})
        Write-Host ("  │  Посилань: Googlebot={0,5}  Browser={1,5}  Δ={2}" -f $refResult.LinksInt, $a.LinksInt, $dl) `
          -ForegroundColor $(if([Math]::Abs($dl) -gt 10){"Yellow"}else{"DarkMagenta"})
        Write-Host ("  │  Розмір:   Googlebot={0,6}KB  Browser={1,6}KB  Δ={2}KB" -f $refResult.SizeKB, $a.SizeKB, ([Math]::Round($ds,1))) `
          -ForegroundColor DarkMagenta
        if ($warn) {
          Write-Host "  │  ⚠️  УВАГА: ВЕЛИКА РІЗНИЦЯ — підозра на клоакінг!" -ForegroundColor Red
        } else {
          Write-Host "  │  ✅ Контент ідентичний — клоакінг не виявлено" -ForegroundColor Green
        }
        Write-Host "  └────────────────────────────────────────────────────────────" -ForegroundColor DarkMagenta
      }

    } catch {
      Write-Host ("  ▶  {0,-12}  ❌ {1}" -f $botName, $_.Exception.Message) -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 250
  }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan
Write-Host "✅  Аудит завершено — $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Green
Write-Host ""
