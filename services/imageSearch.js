import { logger } from '../helpers/logger.js';

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;

  const { chromium } = await import('playwright');
  browserInstance = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  return browserInstance;
}

export async function searchImages(query, count = 20) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
  });

  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3&first=1`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, window.innerHeight * 2);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    const results = await page.evaluate((limit) => {
      const images = [];
      const seenUrls = new Set();
      const nodes = [...document.querySelectorAll('.iusc')];

      for (const node of nodes) {
        if (images.length >= limit) break;

        let metadata = null;
        try {
          const rawData = node.getAttribute('m');
          if (rawData) metadata = JSON.parse(rawData);
        } catch {}

        const imageUrl = metadata?.murl || metadata?.turl || null;
        const thumbnailUrl = metadata?.turl || metadata?.murl || null;
        const sourceUrl = metadata?.purl || metadata?.hostPageUrl || '';
        const imageTitle = metadata?.t || node.getAttribute('aria-label') || '';

        if (imageUrl && !seenUrls.has(imageUrl)) {
          seenUrls.add(imageUrl);
          images.push({
            url: imageUrl,
            thumbnail: thumbnailUrl,
            source: sourceUrl,
            title: imageTitle,
          });
        }
      }

      return images;
    }, count);

    await page.close();
    logger.info(`Image search: "${query}" → ${results.length} results`);
    return results;
  } catch (searchError) {
    await page.close();
    throw searchError;
  }
}
