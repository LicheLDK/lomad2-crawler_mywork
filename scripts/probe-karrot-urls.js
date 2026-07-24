const https = require('https');

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            Accept: 'text/html,application/json,*/*',
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
  const urls = [
    `https://www.daangn.com/kr/buy-sell/s/?search=${q}`,
    `https://www.daangn.com/kr/buy-sell/s/?in=${encodeURIComponent('서초동-6128')}&search=${q}`,
    `https://www.daangn.com/kr/buy-sell/?search=${q}`,
    `https://www.daangn.com/search/${q}`,
  ];

  for (const u of urls) {
    try {
      const r = await get(u);
      const hrefs = [...r.data.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((h) =>
          /articles|article\/|buy-sell\/[a-zA-Z0-9_-]{5,}|\/kr\/[^"'?]+\d/i.test(
            h,
          ),
        )
        .slice(0, 25);
      console.log('URL', r.url);
      console.log('status', r.status, 'len', r.data.length);
      console.log('hrefs', hrefs);
      console.log(
        'markers',
        {
          hasArticles: r.data.includes('/articles/'),
          hasPrice: /원/.test(r.data),
          hasRemix: r.data.includes('_remix'),
          hasJsonLd: r.data.includes('application/ld+json'),
        },
      );
      const ld = r.data.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      );
      if (ld) console.log('ld+json', ld[1].slice(0, 500));
      console.log('---');
    } catch (e) {
      console.log('ERR', u, e.message);
    }
  }
})();
