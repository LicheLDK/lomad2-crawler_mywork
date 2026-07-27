import { registerAs } from '@nestjs/config';

/**
 * 외부 이미지 다운로드 보안/용량 제한.
 * SSRF·메모리 고갈 방지를 위한 기본값.
 */
export default registerAs('image', () => ({
  /** 응답 본문 최대 바이트 (기본 5MB) */
  maxBytes: parseInt(process.env.IMAGE_MAX_BYTES || String(5 * 1024 * 1024), 10),
  /** fetch 타임아웃 ms */
  timeoutMs: parseInt(process.env.IMAGE_DOWNLOAD_TIMEOUT_MS || '15000', 10),
  /** 수동 리다이렉트 최대 횟수 */
  maxRedirects: parseInt(process.env.IMAGE_MAX_REDIRECTS || '3', 10),
  /**
   * 허용 호스트(쉼표 구분). 비우면 공인 IP만 통과한 모든 호스트 허용.
   * 예: media.bunjang.co.kr,*.daangn.com,cafeptthumb-phinf.pstatic.net
   */
  allowHosts: (process.env.IMAGE_DOWNLOAD_ALLOW_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
  /** http 허용 여부 (기본: 개발만 true, 운영은 https만) */
  allowHttp:
    process.env.IMAGE_ALLOW_HTTP !== undefined
      ? process.env.IMAGE_ALLOW_HTTP === 'true'
      : (process.env.NODE_ENV || 'development') !== 'production',
}));
