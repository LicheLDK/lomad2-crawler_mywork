export const QUEUE_NAMES = {
  CRAWL: 'crawl-queue',
  CRAWL_DLQ: 'crawl-queue-dlq',
} as const;

export const JOB_NAMES = {
  SEARCH_CRAWL: 'search-crawl',
  SITE_CRAWL: 'site-crawl',
} as const;
