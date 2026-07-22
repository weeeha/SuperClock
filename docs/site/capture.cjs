const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'shots');
const URL = 'http://localhost:5180';

const APPS = [
  'clock', 'weather', 'calendar', 'quote', 'photo-frame', 'fireplace',
  'fitness', 'habits', 'time-tracking', 'github', 'claude-usage', 'breathing',
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
  });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__nav, null, { timeout: 20000 });

  // The dev-only gesture debug chip would appear in every capture.
  await page.addStyleTag({ content: '#gesture-debug { display: none !important; }' });

  const results = [];

  for (const id of APPS) {
    await page.evaluate((appId) => {
      window.__nav.setState({
        mode: 'app',
        activeAppId: appId,
        activeInstanceId: null,
        transitionDirection: null,
      });
    }, id);

    // Lazy chunk + first paint + any initial fetch settling.
    await page.waitForTimeout(3000);

    const file = path.join(OUT, `${id}.png`);
    await page.screenshot({ path: file });

    const size = fs.statSync(file).size;
    // A near-uniform capture usually means the app never painted.
    const state = await page.evaluate(() => {
      const s = window.__nav.getState();
      return { mode: s.mode, active: s.activeAppId, text: document.body.innerText.slice(0, 120) };
    });
    results.push({ id, bytes: size, ...state });
    console.log(`captured ${id.padEnd(14)} ${String(size).padStart(7)}B  active=${state.active}`);
  }

  // Tier-0 app grid, for the sitemap section of the index.
  await page.evaluate(() => window.__nav.getState().showGrid());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'app-grid.png') });
  console.log('captured app-grid');

  await browser.close();

  console.log('\n--- console errors ---');
  console.log(consoleErrors.length ? consoleErrors.slice(0, 15).join('\n') : 'none');
  fs.writeFileSync(path.join(__dirname, 'capture-report.json'), JSON.stringify(results, null, 2));
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
