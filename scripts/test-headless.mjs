/**
 * test-headless.mjs — Minimal Playwright headless browser smoke test
 *
 * Directly tests Crawlee + Playwright without needing to import
 * _discoverHeadless from seed.js.
 *
 * Usage: node scripts/test-headless.mjs
 */

async function test() {
  console.log(`\n🧪 Testing headless browser (Crawlee + Playwright)...\n`);

  let crawlee;
  try {
    crawlee = await import("crawlee");
    console.log("✅ Crawlee loaded successfully");
  } catch (err) {
    console.error(`❌ Failed to load Crawlee: ${err.message}`);
    process.exit(1);
  }

  const { PlaywrightCrawler } = crawlee;

  const results = [];
  const siteDomain = "sleepfoundation.org";

  console.log(`   Target: ${siteDomain}`);
  console.log(`   Launching Chromium...\n`);

  try {
    const crawler = new PlaywrightCrawler({
      headless: true,
      maxRequestsPerCrawl: 20,
      navigationTimeoutSecs: 30,
      requestHandlerTimeoutSecs: 15,
      maxRequestRetries: 1,
      useSessionPool: true,
      sessionPoolOptions: { maxPoolSize: 1 },
      launchContext: {
        launchOptions: {
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        },
      },

      async requestHandler({ page, log }) {
        const url = page.url();
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

        const title = await page.title();
        const links = await page.evaluate(() => {
          const anchors = document.querySelectorAll("a[href]");
          return Array.from(anchors).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 100) }));
        });

        results.push({
          url,
          title: title || null,
          linkCount: links.length,
        });

        log.info(`[${results.length}] ${url} — "${title}" — ${links.length} links`);
      },
    });

    const homepage = `https://${siteDomain}`;
    await crawler.run([homepage]);
    await crawler.teardown();

    console.log(`\n✅ Headless test PASSED!`);
    console.log(`   Pages crawled: ${results.length}`);
    if (results.length > 0) {
      console.log(`   First page: ${results[0].url}`);
      console.log(`   Title: "${results[0].title}"`);
      console.log(`   Links found: ${results[0].linkCount}`);
    }
  } catch (err) {
    console.error(`\n❌ Headless test FAILED: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

test();