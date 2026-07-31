import { ConfigService } from '@nestjs/config';
import { BungaeAdapter } from './bungae.adapter';
import {
  isJunkJoongnaTitle,
  JoonggonaraAdapter,
} from './joonggonara.adapter';
import { KarrotAdapter } from './karrot.adapter';

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
      },
    ]);

    expect(listing).toMatchObject({
      title: '시몬스 침대',
      price: 150000,
      region: '서울',
      url: 'https://www.bunjang.co.kr/products/12345',
      imageUrl: 'https://cdn.example/400/a.jpg',
    });
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
      },
    ]);

    expect(listing).toMatchObject({
      title: '쇼파',
      price: 1200000,
      url: 'https://cafe.naver.com/joonggonara/1',
      seller: 'seller1',
      region: '경기',
    });
  });

  it('중고나라: isJunkJoongnaTitle 판별', () => {
    expect(isJunkJoongnaTitle('판매하기')).toBe(true);
    expect(isJunkJoongnaTitle('구매하기')).toBe(true);
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
});
