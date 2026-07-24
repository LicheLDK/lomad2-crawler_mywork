/**
 * HTTP adapter smoke test (no Nest bootstrap)
 * Usage: node scripts/test-http-adapters.mjs
 */
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const keyword = process.argv[2] || '시몬스 침대';
const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testBungae() {
  const q = encodeURIComponent(keyword);
  const url = `https://api.bunjang.co.kr/api/1/find_v2.json?q=${q}&order=score&page=0&n=5&version=4`;
  const res = await fetch(url, { headers: { 'User-Agent': ua } });
  if (!res.ok) throw new Error(`bungae HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data.list) ? data.list : [];
  const mapped = list.map((item) => ({
    title: item.name,
    price: item.price,
    url: `https://www.bunjang.co.kr/products/${item.pid}`,
    imageUrl: String(item.product_image || '').replace('{res}', '400'),
    region: item.location || null,
  }));
  console.log('[bungae]', mapped.length, mapped[0]?.title, mapped[0]?.url);
  return mapped.length;
}

async function testKarrot() {
  const q = encodeURIComponent(keyword);
  const url = `https://www.daangn.com/kr/buy-sell/?search=${q}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': ua, 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) throw new Error(`karrot HTTP ${res.status}`);
  const raw = await res.text();
  const scripts = [
    ...raw.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  let items = [];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const docs = Array.isArray(parsed) ? parsed : [parsed];
      for (const doc of docs) {
        if (doc?.['@type'] === 'ItemList' && Array.isArray(doc.itemListElement)) {
          items = doc.itemListElement
            .map((e) => e.item)
            .filter(Boolean)
            .map((item) => ({
              title: item.name,
              price: item.offers?.price,
              url: item.url,
              seller: item.offers?.seller?.name,
            }));
        }
      }
    } catch {
      /* continue */
    }
  }
  console.log('[karrot]', items.length, items[0]?.title, items[0]?.url);
  return items.length;
}

const b = await testBungae();
const k = await testKarrot();
if (b <= 0 || k <= 0) process.exit(1);
console.log('OK');
