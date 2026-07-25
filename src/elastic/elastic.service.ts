import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export interface ElasticResultDoc {
  id: string;
  title: string;
  price: number | null;
  seller: string | null;
  site: string;
  image: string | null;
  url: string;
  createdAt: string;
  hash: string;
  keyword?: string;
  titleSimilarity?: number | null;
  imageSimilarity?: number | null;
  searchHistoryId?: string;
  region?: string | null;
}

@Injectable()
export class ElasticService implements OnModuleInit {
  private readonly logger = new Logger(ElasticService.name);
  private client!: Client;
  private index!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const node = this.config.get<string>('elastic.node')!;
    const username = this.config.get<string>('elastic.username');
    const password = this.config.get<string>('elastic.password');
    this.index = this.config.get<string>('elastic.index')!;

    this.client = new Client({
      node,
      auth: username && password ? { username, password } : undefined,
    });

    try {
      await this.ensureIndex();
    } catch (error) {
      this.logger.warn(
        `Elasticsearch not ready: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.index });
    if (!exists) {
      await this.client.indices.create({
        index: this.index,
        settings: {
          analysis: {
            analyzer: {
              korean_search: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding'],
              },
            },
          },
        },
        mappings: {
          properties: {
            title: {
              type: 'text',
              analyzer: 'korean_search',
              fields: { keyword: { type: 'keyword' } },
            },
            price: { type: 'long' },
            seller: { type: 'keyword' },
            site: { type: 'keyword' },
            image: { type: 'keyword', index: false },
            url: { type: 'keyword' },
            createdAt: { type: 'date' },
            hash: { type: 'keyword' },
            keyword: {
              type: 'text',
              analyzer: 'korean_search',
              fields: { keyword: { type: 'keyword' } },
            },
            titleSimilarity: { type: 'float' },
            imageSimilarity: { type: 'float' },
            searchHistoryId: { type: 'keyword' },
            region: { type: 'keyword' },
          },
        },
      });
      this.logger.log(`Created elasticsearch index: ${this.index}`);
      return;
    }

    // 기존 인덱스: 캐시 정확 조회용 keyword.keyword 서브필드 보강
    try {
      await this.client.indices.putMapping({
        index: this.index,
        properties: {
          keyword: {
            type: 'text',
            analyzer: 'korean_search',
            fields: { keyword: { type: 'keyword' } },
          },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not put keyword.keyword mapping (may already exist): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async indexResult(doc: ElasticResultDoc): Promise<void> {
    try {
      await this.client.index({
        index: this.index,
        id: doc.id,
        document: doc,
        refresh: true,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to index doc ${doc.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * 캐시 조회 — 크롤 시 저장된 keyword 필드 정확 일치만 사용.
   * multi_match(title) 쓰면 "아이폰 13" / "아이폰 15" 가 같은 매물로 섞임.
   */
  async searchExactKeyword(params: {
    keyword: string;
    sites?: string[];
    size?: number;
  }): Promise<ElasticResultDoc[]> {
    try {
      const keyword = params.keyword.trim();
      if (!keyword) return [];

      const filter: object[] = [
        {
          bool: {
            should: [
              { term: { 'keyword.keyword': keyword } },
              { match_phrase: { keyword } },
            ],
            minimum_should_match: 1,
          },
        },
      ];
      if (params.sites?.length) {
        filter.push({ terms: { site: params.sites } });
      }

      const response = await this.client.search<ElasticResultDoc>({
        index: this.index,
        size: params.size ?? 50,
        query: {
          bool: { filter },
        },
        sort: [{ createdAt: { order: 'desc' } }],
      });

      return response.hits.hits
        .map((hit) => hit._source)
        .filter((doc): doc is ElasticResultDoc => Boolean(doc));
    } catch (error) {
      this.logger.warn(
        `Elastic exact keyword search failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  async search(params: {
    keyword: string;
    sites?: string[];
    size?: number;
  }): Promise<ElasticResultDoc[]> {
    try {
      const must: object[] = [
        {
          multi_match: {
            query: params.keyword,
            fields: ['title^3', 'keyword^2', 'description'],
            fuzziness: 'AUTO',
          },
        },
      ];

      const filter: object[] = [];
      if (params.sites?.length) {
        filter.push({ terms: { site: params.sites } });
      }

      const response = await this.client.search<ElasticResultDoc>({
        index: this.index,
        size: params.size ?? 50,
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: [{ createdAt: { order: 'desc' } }],
      });

      return response.hits.hits
        .map((hit) => hit._source)
        .filter((doc): doc is ElasticResultDoc => Boolean(doc));
    } catch (error) {
      this.logger.warn(
        `Elastic search failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  async ping(): Promise<boolean> {
    try {
      return await this.client.ping();
    } catch {
      return false;
    }
  }

  async deleteByKeyword(keyword: string): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: this.index,
        query: {
          match: { keyword },
        },
        refresh: true,
      });
    } catch (error) {
      this.logger.warn(
        `Elastic deleteByKeyword failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
