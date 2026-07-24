const https = require('https');
const { chromium } = require('playwright');

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/json,*/*',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
          timeout: 20000,
        },
        (res) => {
          if (
            [301, 302, 307, 308].includes(res.statusCode) &&
            res.headers.location &&
            redirects < 5
          ) {
            const next = new URL(res.headers.location, url).toString();
            res.resume();
            return resolve(get(next, redirects + 1));
          }
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () =>
            resolve({ status: res.statusCode, url, data }),
          );
        },
      )
      .on('error', reject);
  });
}

(async () => {
  const q = encodeURIComponent('시몬스 침대');
  const htmlRes = await get(
    `https://www.daangn.com/kr/buy-sell/?_search=${q}`,
  );
  console.log('final url', htmlRes.url, 'status', htmlRes.status);
  const html = htmlRes.data;
  const next = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  console.log('hasNextData', !!next);
  if (next) {
    const j = JSON.parse(next[1]);
    console.log('pageProps keys', Object.keys(j.props?.pageProps || {}));
    console.log(JSON.stringify(j.props?.pageProps || {}).slice(0, 2000));
  }

  // href patterns
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  console.log(
    'sample hrefs',
    hrefs.filter((h) => /article|buy-sell|products|kr\//.test(h)).slice(0, 30),
  );

  // Playwright DOM
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  try {
    await page.goto(`https://www.daangn.com/kr/buy-sell/?_search=${q}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]')).map(
        (a) => ({
          href: a.href,
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        }),
      );
      const useful = links
        .filter((l) => /articles|buy-sell\/|\/kr\//.test(l.href))
        .slice(0, 40);
      const article = document.querySelector('article a, a[href*="articles"]');
      return {
        title: document.title,
        url: location.href,
        useful,
        sampleHtml: article
          ? (article.closest('article, li, div') || article).outerHTML.slice(
              0,
              1500,
            )
          : null,
        counts: {
          articles: document.querySelectorAll('article').length,
          aArticles: document.querySelectorAll('a[href*="articles"]').length,
          aBuySell: document.querySelectorAll('a[href*="buy-sell"]').length,
        },
      };
    });
    console.log('PLAYWRIGHT', JSON.stringify(info, null, 2));
  } catch (e) {
    console.log('PLAYWRIGHT ERROR', String(e));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
