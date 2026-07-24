const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1366, height: 768 },
  });

  async function probe(name, url) {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1500);

      const info = await page.evaluate(() => {
        const hrefs = Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href'))
          .filter(Boolean);
        const samples = hrefs
          .filter((h) =>
            /product|products|articles|buy-sell|item|goods|kr\//i.test(h),
          )
          .slice(0, 40);

        const counts = {
          a_products: document.querySelectorAll('a[href*="/products/"]').length,
          a_product: document.querySelectorAll('a[href*="/product"]').length,
          a_articles: document.querySelectorAll('a[href*="/articles/"]').length,
          a_buysell: document.querySelectorAll('a[href*="/buy-sell/"]').length,
          a_kr: document.querySelectorAll('a[href*="/kr/"]').length,
          articles: document.querySelectorAll('article').length,
          imgs: document.querySelectorAll('img').length,
        };

        const firstProduct = document.querySelector(
          'a[href*="/products/"], a[href*="/product/"], a[href*="/articles/"], a[href*="/kr/"]',
        );
        let sample = null;
        if (firstProduct) {
          const root =
            firstProduct.closest('li, article, section, div') || firstProduct;
          sample = {
            href: firstProduct.href,
            className: root.className,
            outer: root.outerHTML.slice(0, 1200),
            text: (root.textContent || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 250),
          };
        }

        const nextData = document.querySelector('#__NEXT_DATA__');
        let nextHint = null;
        if (nextData) {
          try {
            const j = JSON.parse(nextData.textContent || '{}');
            const pageProps = j.props?.pageProps || {};
            nextHint = {
              keys: Object.keys(pageProps),
              preview: JSON.stringify(pageProps).slice(0, 1500),
            };
          } catch (e) {
            nextHint = { error: String(e) };
          }
        }

        return {
          title: document.title,
          url: location.href,
          counts,
          samples,
          sample,
          hasNextData: !!nextData,
          nextHint,
          bodyPreview: (document.body?.innerText || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400),
        };
      });

      console.log('==== ' + name + ' ====');
      console.log(JSON.stringify(info, null, 2));
    } catch (e) {
      console.log('==== ' + name + ' ERROR ====');
      console.log(String(e && e.stack ? e.stack : e));
    } finally {
      await page.close();
    }
  }

  const q = encodeURIComponent('시몬스 침대');
  await probe('bungae', `https://www.bunjang.co.kr/search/product?q=${q}`);
  await probe('karrot', `https://www.daangn.com/search/${q}`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
