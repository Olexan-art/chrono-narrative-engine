export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Proxy Supabase API requests
    if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/functions/')) {
      const supabaseUrl = 'https://bgdwxnoildvvepsoaxrf.supabase.co';
      const targetUrl = supabaseUrl + url.pathname + url.search;
      
      return fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }
    
    // For all other requests, fetch from the origin
    return fetch(request);
  }
};
