import {
  isBlockedIp,
  isHostAllowed,
  assertSafeImageUrl,
  UnsafeImageUrlError,
} from './safe-image-url.util';

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.10',
    '172.16.0.1',
    '172.31.255.255',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12::1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
  ])('blocks %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888'])(
    'allows public %s',
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe('isHostAllowed', () => {
  it('allows all when allowlist empty', () => {
    expect(isHostAllowed('cdn.example.com', [])).toBe(true);
    expect(isHostAllowed('cdn.example.com', undefined)).toBe(true);
  });

  it('matches exact and wildcard hosts', () => {
    const allow = ['media.bunjang.co.kr', '*.daangn.com'];
    expect(isHostAllowed('media.bunjang.co.kr', allow)).toBe(true);
    expect(isHostAllowed('img.daangn.com', allow)).toBe(true);
    expect(isHostAllowed('daangn.com', allow)).toBe(true);
    expect(isHostAllowed('evil.com', allow)).toBe(false);
  });
});

describe('assertSafeImageUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(
      assertSafeImageUrl('file:///etc/passwd', { allowHttp: true }),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);
  });

  it('rejects http when allowHttp=false', async () => {
    await expect(
      assertSafeImageUrl('http://example.com/a.jpg', { allowHttp: false }),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);
  });

  it('rejects localhost and private IPs', async () => {
    await expect(
      assertSafeImageUrl('https://localhost/a.jpg'),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);

    await expect(
      assertSafeImageUrl('https://127.0.0.1/a.jpg'),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);

    await expect(
      assertSafeImageUrl('https://169.254.169.254/latest/meta-data'),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);
  });

  it('rejects credentials in URL', async () => {
    await expect(
      assertSafeImageUrl('https://user:pass@example.com/a.jpg'),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);
  });

  it('rejects hosts outside allowlist', async () => {
    await expect(
      assertSafeImageUrl('https://evil.example/a.jpg', {
        allowHosts: ['cdn.trusted.com'],
      }),
    ).rejects.toBeInstanceOf(UnsafeImageUrlError);
  });
});
