const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json,text/html,*/*',
          },
          timeout: 20000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () =>
            resolve({ status: res.statusCode, headers: res.headers, data }),
          );
        },
      )
      .on('error', reject);
  });
}

(async () => {
  const q = encodeURIComponent('시몬스 침대');
  const urls = [
    `https://api.bunjang.co.kr/api/1/find_v2.json?q=${q}&order=score&page=0&request_id=probe&stat_uid=probe&n=5&version=4`,
    `https://api.bunjang.co.kr/api/1/find_v2.json?q=${q}&order=date&page=1&n=5`,
    `https://www.daangn.com/search/${q}`,
    `https://www.daangn.com/kr/buy-sell/?_search=${q}`,
  ];

  for (const url of urls) {
    try {
      const res = await get(url);
      console.log('====', url);
      console.log('status', res.status);
      console.log('ctype', res.headers['content-type']);
      console.log(res.data.slice(0, 800));
      console.log('');
    } catch (e) {
      console.log('==== ERROR', url);
      console.log(String(e));
      console.log('');
    }
  }
})();
