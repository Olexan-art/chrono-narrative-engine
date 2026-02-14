import type { Plugin } from 'vite';

/**
 * Vite plugin that fetches pre-rendered HTML from the cached_pages table
 * after build and writes them as static .html files into /dist.
 * This enables wiki entity pages (and other cached pages) to be served
 * as pure static HTML without JS or edge-function SSR.
 */
export function staticPagesPlugin(): Plugin {
  const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHd4bm9pbGR2dmVwc29heHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTM2MzQsImV4cCI6MjA4NDc2OTYzNH0.FaLsz1zWVZMLCWizBnKG1ARFFO3N_I1Vmri9xMVVXFk';

  return {
    name: 'vite-plugin-static-pages',
    apply: 'build',
    enforce: 'post',

    async closeBundle() {
      const { writeFileSync, mkdirSync, existsSync } = await import('fs');
      const { resolve, dirname } = await import('path');

      const distDir = resolve(process.cwd(), 'dist');
      if (!existsSync(distDir)) {
        console.warn('[static-pages] dist/ not found, skipping.');
        return;
      }

      console.log('[static-pages] Fetching cached pages from database...');

      // Fetch all wiki + key pages from cached_pages
      // We fetch in batches of 1000 to handle large datasets
      let allPages: { path: string; html: string }[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const url = `${SUPABASE_URL}/rest/v1/cached_pages?select=path,html&order=path.asc&limit=${batchSize}&offset=${offset}`;
        const res = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          console.error(`[static-pages] Failed to fetch cached_pages: ${res.status}`);
          return;
        }

        const rows = (await res.json()) as { path: string; html: string }[];
        if (!rows || rows.length === 0) break;

        allPages = allPages.concat(rows);
        if (rows.length < batchSize) break;
        offset += batchSize;
      }

      if (allPages.length === 0) {
        console.log('[static-pages] No cached pages found.');
        return;
      }

      // Filter to only wiki and key SSR routes
      const targetPatterns = [
        /^\/wiki\/[a-z0-9-]+$/,
        /^\/wiki$/,
        /^\/news\/[a-z]{2}\/[a-z0-9-]+$/,
        /^\/news\/[a-z]{2}$/,
        /^\/news$/,
        /^\/$/,
        /^\/chapters$/,
        /^\/volumes$/,
        /^\/calendar$/,
        /^\/ink-abyss$/,
      ];

      const filteredPages = allPages.filter(page =>
        targetPatterns.some(p => p.test(page.path))
      );

      console.log(`[static-pages] Writing ${filteredPages.length} static HTML files...`);

      let written = 0;
      for (const page of filteredPages) {
        if (!page.html || !page.path) continue;

        // Convert path to file path: /wiki/some-entity -> dist/wiki/some-entity/index.html
        const cleanPath = page.path === '/' ? '' : page.path.replace(/^\//, '');
        const filePath = cleanPath
          ? resolve(distDir, cleanPath, 'index.html')
          : resolve(distDir, 'index.html'); // skip root — SPA already has it

        // Don't overwrite the root index.html (SPA entry)
        if (page.path === '/') continue;

        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(filePath, page.html, 'utf-8');
        written++;
      }

      console.log(`[static-pages] ✅ ${written} static HTML files written to dist/`);
    },
  };
}
