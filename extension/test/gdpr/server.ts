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

const server = Bun.serve({
  port: PORT,

  routes: {
    '/': indexHtml,
    '/story': indexHtml,
  },

  development: {
    hmr: true,
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
