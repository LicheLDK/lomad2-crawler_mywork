const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR' }, timeout: 20000 }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      })
      .on('error', reject);
  });
}
(async () => {
  const q = encodeURIComponent('시몬스 침대');
  const html = await get(`https://www.daangn.com/kr/buy-sell/?search=${q}`);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const j = JSON.parse(ld[1]);
  console.log(JSON.stringify(j.itemListElement.slice(0, 2), null, 2));
})();
