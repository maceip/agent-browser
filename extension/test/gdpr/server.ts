/**
 * GDPR Cookie Banner Test Server
 *
 * A media site demo with GDPR cookie banner that:
 * 1. Shows banner on first visit (no cookies)
 * 2. Hides banner after consent (cookies set)
 * 3. Demonstrates smart modal detection
 */

import indexHtml from './index.html';

const PORT = 3500;

Bun.serve({
  port: PORT,
  development: {
    hmr: true,
  },

  async fetch(req) {
    const url = new URL(req.url);

    // Serve main page (both / and /story use same HTML)
    if (url.pathname === '/' || url.pathname === '/story') {
      return new Response(indexHtml, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // Serve app.tsx (Bun will transpile and bundle)
    if (url.pathname === '/app.tsx') {
      const file = Bun.file('./app.tsx');
      return new Response(file, {
        headers: {
          'Content-Type': 'application/javascript',
        },
      });
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`
🚀 GDPR Test Server Running!

📍 URL: http://localhost:${PORT}

🧪 Test Flow:
  1. Visit http://localhost:${PORT}/
     → Should show GDPR banner (no cookies)

  2. Auto-modal detects and clicks "Accept All"
     → Cookies are set

  3. Navigate to http://localhost:${PORT}/story
     → Banner should NOT appear (cookies exist)
     → Auto-modal SKIPS check (already accepted)

📊 Debug Console: Top-right corner shows detection status

🔄 Reset: Click "Clear Cookies" in nav to reset test

Press Ctrl+C to stop
`);
