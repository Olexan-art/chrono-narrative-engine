addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

const BOT_USER_AGENTS = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
    'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
    'discordbot', 'slackbot', 'pinterestbot', 'redditbot',
    'applebot', 'petalbot', 'semrushbot', 'ahrefsbot', 'dotbot',
    'mj12bot', 'screaming frog', 'sitebulb', 'deepcrawl',
    'gptbot', 'claudebot', 'perplexitybot', 'anthropic-ai', 'cohere-ai',
    'meta-externalagent', 'bytespider', 'sogou', 'seznambot'
]

function isBot(userAgent) {
    if (!userAgent) return false
    const ua = userAgent.toLowerCase()
    return BOT_USER_AGENTS.some(bot => ua.includes(bot))
}

async function handleRequest(request) {
    const url = new URL(request.url)
    const userAgent = request.headers.get('user-agent') || ''

    // Якщо це бот - викликаємо SSR
    if (isBot(userAgent)) {
        try {
            // Викликаємо Supabase Edge Function для SSR
            const ssrUrl = `https://tuledxqigzufkecztnlo.supabase.co/functions/v1/ssr-render`

            const ssrResponse = await fetch(ssrUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url.pathname + url.search,
                    userAgent: userAgent
                })
            })

            if (ssrResponse.ok) {
                const html = await ssrResponse.text()

                return new Response(html, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'public, max-age=300, s-maxage=600',
                        'X-SSR-Bot': 'true',
                        'X-SSR-Source': 'cloudflare-worker',
                        'X-SSR-Path': url.pathname
                    }
                })
            }
        } catch (error) {
            console.error('SSR error:', error)
            // Якщо SSR не спрацював - проксуємо до Netlify
        }
    }

    // Для звичайних користувачів - проксуємо до Netlify
    // Add cache buster to ensure Netlify serves fresh content
    const cacheBuster = `cb=${Date.now()}`
    const separator = url.search ? '&' : '?'
    const netlifyUrl = `https://chrono-narrative-engine.netlify.app${url.pathname}${url.search}${separator}${cacheBuster}`

    try {
        const response = await fetch(netlifyUrl, {
            method: request.method,
            headers: request.headers,
            body: request.body
        })

        // Якщо Netlify повертає 404 для SPA маршруту - повертаємо index.html
        if (response.status === 404 && !url.pathname.includes('.')) {
            const indexResponse = await fetch(`https://chrono-narrative-engine.netlify.app/?${cacheBuster}`, {
                headers: request.headers
            })

            const newResponse = new Response(indexResponse.body, {
                status: 200,
                headers: indexResponse.headers
            })
            newResponse.headers.set('X-Proxy-Worker', 'v2.0')
            return newResponse
        }

        const newResponse = new Response(response.body, response)
        newResponse.headers.set('X-Proxy-Worker', 'v2.0')
        return newResponse
    } catch (error) {
        return new Response('Error proxying to Netlify', { status: 502 })
    }
}
