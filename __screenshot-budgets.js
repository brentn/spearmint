const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  await page.goto('http://localhost:4200/budgets', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=cash flow', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: '/private/tmp/claude-503/-Users-brent-nesbitt-Documents-Develop-Personal-Spearmint/49764e4f-b96f-4cc4-9eef-bf24ef11e984/scratchpad/budgets-full.png', fullPage: true });

  const card = page.locator('.budgets__card', { hasText: 'cash flow' });
  if (await card.count()) {
    await card.first().screenshot({ path: '/private/tmp/claude-503/-Users-brent-nesbitt-Documents-Develop-Personal-Spearmint/49764e4f-b96f-4cc4-9eef-bf24ef11e984/scratchpad/budgets-cashflow.png' });
  }

  await browser.close();
})();
