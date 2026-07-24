import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  CrawlerResult,
  SearchHistory,
  SearchKeyword,
} from '@/database/entities';
import { CrawlQueueService } from '@/queue/crawl-queue.service';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(CrawlerResult)
    private readonly resultRepo: Repository<CrawlerResult>,
    @InjectRepository(SearchHistory)
    private readonly historyRepo: Repository<SearchHistory>,
    @InjectRepository(SearchKeyword)
    private readonly keywordRepo: Repository<SearchKeyword>,
    private readonly crawlQueue: CrawlQueueService,
  ) {}

  async getOverview() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalResults,
      totalSearches,
      totalKeywords,
      results24h,
      searches24h,
      bySiteRaw,
      byStatusRaw,
      topKeywords,
      recentSearches,
      searchTrendRaw,
      resultTrendRaw,
      queue,
    ] = await Promise.all([
      this.resultRepo.count(),
      this.historyRepo.count(),
      this.keywordRepo.count(),
      this.resultRepo.count({
        where: { createdAt: MoreThanOrEqual(since24h) },
      }),
      this.historyRepo.count({
        where: { createdAt: MoreThanOrEqual(since24h) },
      }),
      this.resultRepo
        .createQueryBuilder('r')
        .select('r.siteCode', 'siteCode')
        .addSelect('COUNT(*)', 'count')
        .groupBy('r.siteCode')
        .orderBy('count', 'DESC')
        .getRawMany<{ siteCode: string; count: string }>(),
      this.historyRepo
        .createQueryBuilder('h')
        .select('h.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('h.status')
        .orderBy('count', 'DESC')
        .getRawMany<{ status: string; count: string }>(),
      this.keywordRepo.find({
        order: { searchCount: 'DESC', lastSearchedAt: 'DESC' },
        take: 8,
      }),
      this.historyRepo.find({
        order: { createdAt: 'DESC' },
        take: 12,
      }),
      this.historyRepo
        .createQueryBuilder('h')
        .select(`TO_CHAR(h."createdAt", 'YYYY-MM-DD')`, 'day')
        .addSelect('COUNT(*)', 'count')
        .where('h."createdAt" >= :since', { since: since14d })
        .groupBy(`TO_CHAR(h."createdAt", 'YYYY-MM-DD')`)
        .orderBy('day', 'ASC')
        .getRawMany<{ day: string; count: string }>(),
      this.resultRepo
        .createQueryBuilder('r')
        .select(`TO_CHAR(r."createdAt", 'YYYY-MM-DD')`, 'day')
        .addSelect('COUNT(*)', 'count')
        .where('r."createdAt" >= :since', { since: since14d })
        .groupBy(`TO_CHAR(r."createdAt", 'YYYY-MM-DD')`)
        .orderBy('day', 'ASC')
        .getRawMany<{ day: string; count: string }>(),
      this.crawlQueue.getJobCounts().catch(() => null),
    ]);

    const searchByDay = new Map(
      searchTrendRaw.map((r) => [r.day, Number(r.count)]),
    );
    const resultByDay = new Map(
      resultTrendRaw.map((r) => [r.day, Number(r.count)]),
    );
    const searchTrend = fillDailyTrend(since14d, searchByDay, resultByDay);

    return {
      totals: {
        results: totalResults,
        searches: totalSearches,
        keywords: totalKeywords,
      },
      last24h: {
        results: results24h,
        searches: searches24h,
      },
      bySite: bySiteRaw.map((row) => ({
        siteCode: row.siteCode,
        count: Number(row.count),
      })),
      byStatus: byStatusRaw.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      topKeywords: topKeywords.map((k) => ({
        keyword: k.keyword,
        searchCount: k.searchCount,
        lastSearchedAt: k.lastSearchedAt,
      })),
      recentSearches: recentSearches.map((h) => ({
        searchId: h.id,
        keyword: h.keyword,
        status: h.status,
        resultCount: h.resultCount,
        sites: h.sites,
        createdAt: h.createdAt,
        finishedAt: h.finishedAt,
        errorMessage: h.errorMessage,
      })),
      searchTrend,
      queue,
      generatedAt: new Date().toISOString(),
    };
  }
}

function fillDailyTrend(
  since: Date,
  searches: Map<string, number>,
  results: Map<string, number>,
) {
  const days: { day: string; searches: number; results: number }[] = [];
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (cursor <= today) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    days.push({
      day: key,
      searches: searches.get(key) ?? 0,
      results: results.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
