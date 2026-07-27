import { ConfigService } from '@nestjs/config';
import { ImageStorageService } from './image-storage.service';

function mockConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'image.maxBytes': 1024,
    'image.timeoutMs': 5000,
    'image.maxRedirects': 2,
    'image.allowHttp': true,
    'image.allowHosts': [],
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ImageStorageService download guards', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects private IP image URLs (SSRF)', async () => {
    const service = new ImageStorageService(mockConfig());
    const result = await service.downloadAndStore(
      'https://127.0.0.1/secret.jpg',
      'r1',
    );
    expect(result).toBeNull();
  });

  it('rejects oversized body by Content-Length', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'image/jpeg';
            if (name === 'content-length') return '99999';
            return null;
          },
        },
        body: null,
        arrayBuffer: async () => new ArrayBuffer(8),
      }) as unknown as Response,
    );

    const service = new ImageStorageService(mockConfig({ 'image.maxBytes': 100 }));
    const result = await service.downloadAndStore(
      'https://8.8.8.8/big.jpg',
      'r2',
    );
    // 8.8.8.8 is public IP — blocked by Content-Length before body
    // DNS for 8.8.8.8 as hostname: isIP so no DNS, allowed
    expect(result).toBeNull();
  });

  it('rejects non-image Content-Type', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name === 'content-type' ? 'text/html' : null,
        },
        body: null,
        arrayBuffer: async () => new ArrayBuffer(8),
      }) as unknown as Response,
    );

    const service = new ImageStorageService(mockConfig());
    const result = await service.downloadAndStore(
      'https://1.1.1.1/page.html',
      'r3',
    );
    expect(result).toBeNull();
  });
});
