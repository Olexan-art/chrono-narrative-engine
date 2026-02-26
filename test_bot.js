const ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
function isBot(userAgent){
  if(!userAgent) return false;
  const ua=userAgent.toLowerCase();
  const commonBrowserHints=/mozilla\/|applewebkit|gecko\/|chrome\/|safari\/|windows nt|macintosh|edg\//i;
  const explicitBotToken=/\b(bot|crawler|spider|crawl|slurp|preview|fetch)\b/i;
  if(commonBrowserHints.test(userAgent) && !explicitBotToken.test(ua)) return false;
  const patterns=[ 'googlebot','google-extended','googleother','google-inspectiontool','bingbot','msnbot','yandex','duckduckbot','baiduspider','gptbot','chatgpt-user','anthropic-ai','claudebot','claude-web','perplexitybot','gemini','google-gemini','cohere-ai','bytespider','amazonbot','meta-externalagent','youbot','diffbot','ccbot','omgili','twitterbot','facebookexternalhit','linkedinbot','slackbot','telegrambot','whatsapp','discordbot','applebot','semrush','ahrefs','mj12bot','screaming frog','ahrefsbot','semrushbot','crawler','spider','bot/'];
  for(const p of patterns){
    const esc=p.replace(/[-\\/\\^$*+?.()|[\\]{}]/g,'\\$&');
    const re=new RegExp('\\b'+esc+'\\b','i');
    if(re.test(ua)) return true;
  }
  return false;
}
console.log('isBot? ', isBot(ua));
