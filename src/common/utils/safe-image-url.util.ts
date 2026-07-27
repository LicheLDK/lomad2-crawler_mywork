import { lookup } from 'dns/promises';
import { isIP } from 'net';

export type SafeImageUrlOptions = {
  allowHttp?: boolean;
  allowHosts?: string[];
};

export class UnsafeImageUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeImageUrlError';
  }
}

/** IPv4/IPv6 사설·루프백·링크로컬·메타데이터 대역 */
export function isBlockedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  if (!normalized) return true;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIp(normalized.slice(7));
  }

  const version = isIP(normalized);
  if (version === 4) {
    return isBlockedIpv4(normalized);
  }
  if (version === 6) {
    return isBlockedIpv6(normalized);
  }
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA
  if (ip.startsWith('fe80')) return true; // link-local
  if (ip.startsWith('ff')) return true; // multicast
  return false;
}

export function isHostAllowed(
  hostname: string,
  allowHosts: string[] | undefined,
): boolean {
  if (!allowHosts || allowHosts.length === 0) return true;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowHosts.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // .example.com
      return host === pattern.slice(2) || host.endsWith(suffix);
    }
    return host === pattern;
  });
}

/**
 * URL 프로토콜·호스트·DNS 해석 IP를 검증한다.
 * 리다이렉트 대상마다 호출해야 한다.
 */
export async function assertSafeImageUrl(
  rawUrl: string,
  options: SafeImageUrlOptions = {},
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeImageUrlError('Invalid image URL');
  }

  const protocol = parsed.protocol.toLowerCase();
  const allowHttp = options.allowHttp === true;
  if (protocol === 'https:') {
    // ok
  } else if (protocol === 'http:' && allowHttp) {
    // ok
  } else {
    throw new UnsafeImageUrlError(
      `Blocked image URL protocol: ${parsed.protocol}`,
    );
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeImageUrlError('Image URL must not include credentials');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new UnsafeImageUrlError('Image URL host is empty');
  }

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new UnsafeImageUrlError(`Blocked image host: ${hostname}`);
  }

  if (!isHostAllowed(hostname, options.allowHosts)) {
    throw new UnsafeImageUrlError(`Image host not in allowlist: ${hostname}`);
  }

  // 호스트가 이미 IP면 DNS 없이 검사
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new UnsafeImageUrlError(`Blocked image IP: ${hostname}`);
    }
    return parsed;
  }

  let addresses: string[];
  try {
    const result = await lookup(hostname, { all: true, verbatim: true });
    addresses = result.map((r) => r.address);
  } catch {
    throw new UnsafeImageUrlError(`DNS lookup failed for ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new UnsafeImageUrlError(`No DNS records for ${hostname}`);
  }

  for (const address of addresses) {
    if (isBlockedIp(address)) {
      throw new UnsafeImageUrlError(
        `Blocked image resolved IP ${address} for ${hostname}`,
      );
    }
  }

  return parsed;
}
