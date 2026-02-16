export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const WORKER_VERSION = 'v2026.02.16-1';

    // Proxy Supabase API requests
    if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/functions/')) {
      const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
      const targetUrl = supabaseUrl + url.pathname + url.search;

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      // Create a new response to modify headers (headers are immutable in the original response)
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('X-Worker-Version', WORKER_VERSION);

      // If it's ssr-render, we might want to ensure Cloudflare respects the cache headers 
      // or explicitly allows re-validation if the user requested it.

      return newResponse;
    }

    // For all other requests, fetch from the origin
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Worker-Version', WORKER_VERSION);

    return newResponse;
  }
};
