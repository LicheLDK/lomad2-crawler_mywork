import { ConfigService } from '@nestjs/config';
import { BungaeAdapter } from './bungae.adapter';
import {
  isJunkJoongnaTitle,
  JoonggonaraAdapter,
  mapJoongnaApiItem,
} from './joonggonara.adapter';
import { KarrotAdapter, extractFleamarketArticles } from './karrot.adapter';
import { parseListedAt } from '@/common/utils/listed-at.util';

function mockConfig(): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'crawler.requestDelayMs') return 0;
      if (key === 'crawler.timeoutMs') return 5000;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('adapter normalize()', () => {
  it('번개장터: find_v2 item → NormalizedListing', async () => {
    const adapter = new BungaeAdapter(mockConfig());
    const [listing] = await adapter.normalize([
      {
        pid: 12345,
        name: '시몬스 침대',
        price: '150000.0',
        location: '서울',
        product_image: 'https://cdn.example/{res}/a.jpg',
        update_time: 1_700_000_000,
      },
    ]);

    expect(listing).toMatchObject({
      title: '시몬스 침대',
      price: 150000,
      region: '서울',
      url: 'https://www.bunjang.co.kr/products/12345',
      imageUrl: 'https://cdn.example/400/a.jpg',
    });
    expect(listing.listedAt?.toISOString()).toBe(
      new Date(1_700_000_000 * 1000).toISOString(),
    );
  });

  it('번개장터: url/title 없으면 제외', async () => {
    const adapter = new BungaeAdapter(mockConfig());
    const listings = await adapter.normalize([
      { name: '', pid: null, price: 1000 },
      { name: 'ok', pid: 1, price: 1000 },
    ]);
    expect(listings).toHaveLength(1);
    expect(listings[0].url).toContain('/products/1');
  });

  it('중고나라: API item sortDate → listedAt', async () => {
    const raw = mapJoongnaApiItem({
      seq: 224563219,
      title: '브리온베가 라디오포노그라포 스피커 화이트 색상 삽니다',
      price: 15000000,
      url: 'https://img.example/a.jpg',
      sortDate: '2026-01-26 19:19:02',
      mainLocationName: '물금읍',
      locationNames: ['경상남도 양산시 물금읍'],
    });
    expect(raw).toMatchObject({
      href: 'https://web.joongna.com/product/224563219',
      region: '물금읍',
      sortDate: '2026-01-26 19:19:02',
    });

    const adapter = new JoonggonaraAdapter(mockConfig());
    const [listing] = await adapter.normalize([raw!]);
    expect(listing.listedAt?.toISOString()).toBe(
      parseListedAt('2026-01-26 19:19:02')?.toISOString(),
    );
    expect(listing.region).toBe('물금읍');
  });

  it('중고나라: priceText 파싱', async () => {
    const adapter = new JoonggonaraAdapter(mockConfig());
    const [listing] = await adapter.normalize([
      {
        title: '쇼파',
        priceText: '1,200,000원',
        href: 'https://cafe.naver.com/joonggonara/1',
        image: 'https://img.example/a.jpg',
        seller: 'seller1',
        region: '경기',
        sortDate: '2026-01-26 19:19:02',
      },
    ]);

    expect(listing).toMatchObject({
      title: '쇼파',
      price: 1200000,
      url: 'https://cafe.naver.com/joonggonara/1',
      seller: 'seller1',
      region: '경기',
    });
    expect(listing.listedAt?.toISOString()).toBe('2026-01-26T10:19:02.000Z');
  });

  it('중고나라: isJunkJoongnaTitle 판별', () => {
    expect(isJunkJoongnaTitle('판매하기')).toBe(true);
    expect(isJunkJoongnaTitle('구매하기')).toBe(true);
    expect(isJunkJoongnaTitle('채팅하기')).toBe(true);
    expect(isJunkJoongnaTitle('채팅하기 버튼')).toBe(true);
    expect(isJunkJoongnaTitle('판매하기 버튼')).toBe(true);
    expect(isJunkJoongnaTitle('에어론 풀 체어')).toBe(false);
  });

  it('중고나라: UI 문구(판매하기) 제목은 제외', async () => {
    const adapter = new JoonggonaraAdapter(mockConfig());
    const listings = await adapter.normalize([
      {
        title: '판매하기',
        priceText: '10000원',
        href: 'https://web.joongna.com/product/1',
        image: 'https://img.example/a.jpg',
      },
      {
        title: '에어론 풀 체어 그라파이트',
        priceText: '800000원',
        href: 'https://web.joongna.com/product/2',
        image: 'https://img.example/b.jpg',
      },
    ]);
    expect(listings).toHaveLength(1);
    expect(listings[0].title).toBe('에어론 풀 체어 그라파이트');
  });

  it('중고나라: 가격 없는 정상 매물(채팅 버튼 아님)은 유지', async () => {
    const adapter = new JoonggonaraAdapter(mockConfig());
    const listings = await adapter.normalize([
      {
        // 실제 버그 사례: 채팅 아이콘의 접근성 라벨이 카드로 스크랩된 경우 (제목으로 제외)
        title: '채팅하기 버튼',
        priceText: null,
        href: 'https://web.joongna.com/product/9',
        image: 'https://img.example/chat-icon.png',
      },
      {
        // 정상 매물인데 카드에 가격이 노출되지 않는 경우도 있음 (가격 유무로 걸러선 안 됨)
        title: '브리온베가 스피커 라디오포노그라포 화이트 삽니다',
        priceText: null,
        href: 'https://web.joongna.com/product/10',
        image: 'https://img.example/c.jpg',
      },
    ]);
    expect(listings).toHaveLength(1);
    expect(listings[0].title).toBe(
      '브리온베가 스피커 라디오포노그라포 화이트 삽니다',
    );
  });

  it('당근: JSON-LD 형태 mapItem', async () => {
    const adapter = new KarrotAdapter(mockConfig());
    const [listing] = await adapter.normalize([
      {
        name: '식탁',
        price: 80000,
        url: 'https://www.daangn.com/articles/1',
        image: 'https://img.daangn.com/a.jpg',
        seller: '이웃',
        description: '깨끗함',
      },
    ]);

    expect(listing).toMatchObject({
      title: '식탁',
      price: 80000,
      url: 'https://www.daangn.com/articles/1',
      imageUrl: 'https://img.daangn.com/a.jpg',
      seller: '이웃',
      description: '깨끗함',
    });
  });

  it('당근: FleamarketArticle createdAt → listedAt', async () => {
    const html = `
      <script>
      [{"id":"/kr/buy-sell/iphone-abc/","href":"https://www.daangn.com/kr/buy-sell/iphone-abc/","price":"1450000.0","title":"아이폰 팝니다","thumbnail":"https://img.example/a.webp?q=82\\u0026s=300x300","status":"Ongoing","content":"상태 좋아요","createdAt":"2026-08-03T12:01:41.123+09:00","boostedAt":"2026-08-03T12:01:41.123+09:00","user":{"dbId":"1","nickname":"톰삭스","__typename":"KarrotUser"},"region":{"dbId":"6128","name":"서초동","__typename":"Region"},"__typename":"FleamarketArticle"}]
      </script>
    `;
    const items = extractFleamarketArticles(html);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: '아이폰 팝니다',
      url: 'https://www.daangn.com/kr/buy-sell/iphone-abc/',
      region: '서초동',
      seller: '톰삭스',
      createdAt: '2026-08-03T12:01:41.123+09:00',
    });

    const adapter = new KarrotAdapter(mockConfig());
    const [listing] = await adapter.normalize(items);
    expect(listing.listedAt?.toISOString()).toBe(
      parseListedAt('2026-08-03T12:01:41.123+09:00')?.toISOString(),
    );
    expect(listing.region).toBe('서초동');
    expect(listing.seller).toBe('톰삭스');
  });
});
