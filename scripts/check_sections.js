#!/usr/bin/env node
// Usage: node scripts/check_sections.js /news/us/... 
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1';
const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';
const path = process.argv[2] || '/';

const checks = [
  {key:'Verified', terms:['Verified','Verified —']},
  {key:'Cartoons', terms:['cartoon','карикатур','карикатура','caricature']},
  {key:'Keywords', terms:['Keywords:','Keywords','Ключові слова','Ключові']},
  {key:'Key Takeaways', terms:['Key Takeaways','Key takeaways','Takeaways']},
  {key:'Topics', terms:['Topics:','Topics','Top Topics','# Topics']},
  {key:'Retelling', terms:['Full retelling','retelling','Пересказ','retell']},
  {key:'Why It Matters', terms:['Why It Matters']},
  {key:'Context & Background', terms:['Context & Background','Context & background']},
  {key:'What Happens Next', terms:['What Happens Next']},
  {key:'FAQ', terms:['Frequently Asked Questions','FAQ','Frequently asked']},
  {key:'More news about', terms:['More news about','More about']},
  {key:'Entity Intersection Graph', terms:['Entity Intersection Graph','Intersection Graph']},
  {key:'Source', terms:['Source','Sources']},
  {key:'Mentioned Entities', terms:['Mentioned Entities','Mentioned']},
  {key:'TopicsNav', terms:['nav.topics','Topics','/topics/']}
];

async function fetchSSR(p,useCache){
  const u = `${SUPABASE_FUNCTIONS_URL.replace(/\/+$/,'')}/ssr-render?path=${encodeURIComponent(p)}&lang=en&cache=${useCache?'true':'false'}`;
  const r = await fetch(u,{headers:{Accept:'text/html'}});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText} for ${u}`);
  return await r.text();
}

function present(html, term){
  try{
    const lh = html.toLowerCase();
    return lh.includes(term.toLowerCase());
  }catch(e){return false}
}

(async()=>{
  console.log('Checking',path);
  try{
    const cached = await fetchSSR(path,true);
    const live = await fetchSSR(path,false);
    const report = { path, cached:{}, live:{} };
    for(const c of checks){
      report.cached[c.key]=c.terms.some(t=>present(cached,t));
      report.live[c.key]=c.terms.some(t=>present(live,t));
    }
    const fs = await import('fs');
    const out = `section_presence_${Date.now()}.json`;
    await fs.promises.writeFile(out, JSON.stringify(report,null,2));
    console.log('Wrote',out);
    console.table([['Section','Live','Cached'], ...checks.map(c=>[c.key, report.live[c.key], report.cached[c.key]])]);
  }catch(e){ console.error('Error',e.message); process.exit(1); }
})();
