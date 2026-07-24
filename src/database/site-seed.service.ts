import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrawlerSite } from '@/database/entities';
import { SiteCode } from '@/common/constants/site-code';

@Injectable()
export class SiteSeedService implements OnModuleInit {
  private readonly logger = new Logger(SiteSeedService.name);

  constructor(
    @InjectRepository(CrawlerSite)
    private readonly siteRepo: Repository<CrawlerSite>,
  ) {}

  async onModuleInit(): Promise<void> {
    const seeds = [
      {
        code: SiteCode.JOONGGONARA,
        name: '중고나라',
        baseUrl: 'https://web.joongna.com',
        priority: 1,
      },
      {
        code: SiteCode.BUNGAE,
        name: '번개장터',
        baseUrl: 'https://www.bunjang.co.kr',
        priority: 2,
      },
      {
        code: SiteCode.KARROT,
        name: '당근',
        baseUrl: 'https://www.daangn.com',
        priority: 3,
      },
    ];

    for (const seed of seeds) {
      const exists = await this.siteRepo.findOne({ where: { code: seed.code } });
      if (!exists) {
        await this.siteRepo.save(this.siteRepo.create({ ...seed, enabled: true }));
        this.logger.log(`Seeded site: ${seed.code}`);
      }
    }
  }
}
