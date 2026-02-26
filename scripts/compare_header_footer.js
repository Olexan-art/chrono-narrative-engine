#!/usr/bin/env node
// Compare <header> and <footer> of live root vs local cached_root.json
const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1';
const fs = await import('fs');

function extract(tag, html){
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`,`i`);
  const m = html.match(re);
  return m ? m[0] : null;
}
function normalize(s){
  if(!s) return '';
  return s.replace(/\s+/g,' ').replace(/\s*(>)+/g,'>$1').trim();
}
(async()=>{
  try{
    // read cached
    const cachedPath = 'archive/generated/cached_root.json';
    const raw = await fs.promises.readFile(cachedPath,'utf8');
    const parsed = JSON.parse(raw);
    const cachedHtml = parsed && parsed[0] && parsed[0].html ? parsed[0].html : null;
    if(!cachedHtml) { console.error('No cached HTML found in',cachedPath); process.exit(2); }
    // fetch live
    const liveUrl = PROD_BASE_URL.replace(/\/+$/,'') + '/';
    let r = await fetch(liveUrl,{headers:{Accept:'text/html'}});
    if(!r.ok) { console.error('Failed to fetch live root',r.status); process.exit(2); }
    let liveHtml = await r.text();
    // if direct fetch didn't return header/footer (SPA redirect), try SSR render endpoint
    const headerLiveTry = extract('header', liveHtml);
    const footerLiveTry = extract('footer', liveHtml);
    if((!headerLiveTry || !footerLiveTry) && SUPABASE_FUNCTIONS_URL){
      try{
        const u = SUPABASE_FUNCTIONS_URL.replace(/\/+$/,'') + '/ssr-render?path=%2F&cache=false';
        const rr = await fetch(u,{headers:{Accept:'text/html'}});
        if(rr.ok){ liveHtml = await rr.text(); }
      }catch(e){}
    }
    const headerCached = extract('header', cachedHtml);
    const footerCached = extract('footer', cachedHtml);
    const headerLive = extract('header', liveHtml);
    const footerLive = extract('footer', liveHtml);
    await fs.promises.writeFile('header_cached.html', headerCached||'');
    await fs.promises.writeFile('footer_cached.html', footerCached||'');
    await fs.promises.writeFile('header_live.html', headerLive||'');
    await fs.promises.writeFile('footer_live.html', footerLive||'');
    const hEqual = normalize(headerCached) === normalize(headerLive);
    const fEqual = normalize(footerCached) === normalize(footerLive);
    console.log('Header match:', hEqual);
    console.log('Footer match:', fEqual);
    console.log('Cached header length:', (headerCached||'').length, 'Live header length:', (headerLive||'').length);
    console.log('Cached footer length:', (footerCached||'').length, 'Live footer length:', (footerLive||'').length);
    if(!hEqual){ console.log('Header differences saved to header_cached.html and header_live.html'); }
    if(!fEqual){ console.log('Footer differences saved to footer_cached.html and footer_live.html'); }
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
