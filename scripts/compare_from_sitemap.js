#!/usr/bin/env node
// Fetch sitemap.xml, pick top N urls for /news/, /topics/, /wiki/ and compare SSR cached vs live

const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const headers = { Accept: 'application/xml' };
if (ANON_KEY) { headers['Authorization'] = `Bearer ${ANON_KEY}`; headers['apikey'] = ANON_KEY; }

function extractUrlsFromSitemap(xml) {
  const re = /<loc>([^<]+)<\/loc>/gi;
  const urls = [];
  let m;
  while ((m = re.exec(xml))) {
    urls.push(m[1]);
  }
  return urls;
}

async function fetchText(u, accept='text/html'){
  const r = await fetch(u, { headers: { Accept: accept } });
  if (!r.ok) throw new Error(`${r.status} for ${u}`);
  return await r.text();
}

function pathFromUrl(u){
  try{ return new URL(u).pathname; } catch(e){ return null; }
}

async function comparePaths(paths){
  // reuse compare logic from compare_ssr.js (inline)
  function stripHtml(html){ return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
  function extractImages(html){ const imgs=[]; const re=/<img[^>]+src=(?:"|')([^"'>]+)(?:"|')/gi; let m; while((m=re.exec(html))){const src=m[1]; if(!src) continue; if(src.startsWith('data:')) continue; const abs = src.startsWith('http')?src:(PROD_BASE_URL.replace(/\/+$/,'')+(src.startsWith('/')?src:'/'+src)); imgs.push(abs);} return Array.from(new Set(imgs)); }
  function extractInternalLinks(html){ const links=[]; const re=/href=(?:"|')([^"'#]+)(?:"|')/gi; let m; while((m=re.exec(html))){const href=m[1]; if(!href) continue; if(href.startsWith('/')) links.push(href); else if(href.startsWith(PROD_BASE_URL)){ try{ const p=new URL(href); links.push(p.pathname);}catch(e){} } } return Array.from(new Set(links)); }
  function wordFreq(html){ const txt=stripHtml(html).toLowerCase(); const words=txt.split(/\s+/).filter(Boolean); const freq=Object.create(null); for(const w of words){ const clean=w.replace(/[^a-zA-Zа-яА-Я0-9\u0400-\u04FF'-]/g,''); if(!clean) continue; freq[clean]=(freq[clean]||0)+1;} return { total: words.length, freq }; }
  async function fetchSSR(path,useCache){ const u=`${SUPABASE_FUNCTIONS_URL.replace(/\/+$/,'')}/ssr-render?path=${encodeURIComponent(path)}&lang=en&cache=${useCache?'true':'false'}`; const res=await fetch(u,{headers:{Accept:'text/html'}}); if(!res.ok) throw new Error(`${res.status} for ${u}`); return await res.text(); }
  const report={generatedAt:new Date().toISOString(),items:[]};
  for(const p of paths){
    try{
      console.log('Comparing',p);
      const live=await fetchSSR(p,false);
      const cached=await fetchSSR(p,true);
      const liveImgs=extractImages(live);
      const cachedImgs=extractImages(cached);
      const missingImgs=liveImgs.filter(x=>!cachedImgs.includes(x));
      const liveLinks=extractInternalLinks(live);
      const cachedLinks=extractInternalLinks(cached);
      const missingLinks=liveLinks.filter(x=>!cachedLinks.includes(x));
      const liveWords=wordFreq(live);
      const cachedWords=wordFreq(cached);
      // top diffs
      const keys=new Set([...Object.keys(liveWords.freq),...Object.keys(cachedWords.freq)]);
      const diffs=[];
      for(const k of keys){ const a=liveWords.freq[k]||0; const b=cachedWords.freq[k]||0; const diff=b-a; if(diff!==0) diffs.push({word:k,live:a,cached:b,diff}); }
      diffs.sort((x,y)=>Math.abs(y.diff)-Math.abs(x.diff));
      report.items.push({path:p,summary:{live:{images:liveImgs.length,links:liveLinks.length,words:liveWords.total},cached:{images:cachedImgs.length,links:cachedLinks.length,words:cachedWords.total}},missingImages:missingImgs.slice(0,200),missingLinks:missingLinks.slice(0,200),wordDiffs:diffs.slice(0,40)});
      console.log(`  Live img:${liveImgs.length} links:${liveLinks.length} words:${liveWords.total}`);
      console.log(`  Cached img:${cachedImgs.length} links:${cachedLinks.length} words:${cachedWords.total}`);
    }catch(e){ console.error('Error',p,e.message||e); }
  }
  const fs = await import('fs');
  const out=`compare_report_sitemap_${Date.now()}.json`;
  await fs.promises.writeFile(out,JSON.stringify(report,null,2));
  console.log('Wrote',out);
}

(async()=>{
  console.log('Looking for sitemap...');
  const candidates = ['/sitemap.xml','/sitemap_index.xml','/sitemap-index.xml','/sitemap.xml.gz','/sitemap-index.xml.gz','/sitemap-index.xml'];
  let xml = null;
  let sitemapUrl = null;
  for(const c of candidates){
    const u = PROD_BASE_URL.replace(/\/+$/,'') + c;
    try{ xml = await fetchText(u,'application/xml'); sitemapUrl = u; console.log('Found sitemap at',u); break; }catch(e){}
  }
  let urls = [];
  if(xml){
    urls = extractUrlsFromSitemap(xml);
    console.log(`Found ${urls.length} urls in sitemap (${sitemapUrl})`);
  } else {
    // Try to use local cached root HTML if available
    const fs = await import('fs');
    const localPath = 'archive/generated/cached_root.json';
    try{
      const text = await fs.promises.readFile(localPath,'utf8');
      const parsed = JSON.parse(text);
      if(Array.isArray(parsed) && parsed.length>0 && parsed[0].html){
        const html = parsed[0].html;
        const re = /href=(?:\"|\')([^\"'#]+)(?:\"|\')/gi;
        let m;
        while((m=re.exec(html))){
          let href=m[1]; if(!href) continue;
          if(href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')) continue;
          if(href.startsWith('/')) urls.push(PROD_BASE_URL.replace(/\/+$/,'')+href);
          else if(href.startsWith(PROD_BASE_URL)) urls.push(href);
        }
        urls = Array.from(new Set(urls));
        console.log(`Extracted ${urls.length} urls from ${localPath}`);
      }
    }catch(e){
      // fallback to crawling
      console.log('No local cached_root.json; falling back to quick crawl of homepage to discover links');
      const visited = new Set();
      const queue = ['/'];
      while(queue.length && visited.size < 1000){
        const p = queue.shift();
        if(visited.has(p)) continue;
        visited.add(p);
        try{
          const html = await fetchText(PROD_BASE_URL.replace(/\/+$/,'') + p);
          const re = /href=(?:\"|\')([^\"'#]+)(?:\"|\')/gi;
          let m;
          while((m=re.exec(html))){
            let href = m[1];
            if(!href) continue;
            if(href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')) continue;
            if(href.startsWith('/')){
              if(!visited.has(href) && !queue.includes(href)) queue.push(href);
              urls.push(PROD_BASE_URL.replace(/\/+$/,'')+href);
            } else if(href.startsWith(PROD_BASE_URL)){
              try{ const nu=new URL(href); const path=nu.pathname; if(!visited.has(path) && !queue.includes(path)) queue.push(path); urls.push(href); }catch(e){}
            }
          }
        }catch(e){}
      }
      urls = Array.from(new Set(urls));
      console.log(`Crawl discovered ${urls.length} candidate urls`);
    }
  }
  const news = urls.filter(u=>u.includes('/news/')).slice(0,20).map(pathFromUrl).filter(Boolean);
  const topics = urls.filter(u=>u.includes('/topics/')).slice(0,20).map(pathFromUrl).filter(Boolean);
  const wiki = urls.filter(u=>u.includes('/wiki/')).slice(0,20).map(pathFromUrl).filter(Boolean);
  const toCompare = [...news,...topics,...wiki];
  console.log(`Comparing ${toCompare.length} paths (${news.length} news, ${topics.length} topics, ${wiki.length} wiki)`);
  await comparePaths(toCompare);
})();
