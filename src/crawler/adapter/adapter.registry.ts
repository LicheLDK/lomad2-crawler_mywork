import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JoonggonaraAdapter } from './joonggonara.adapter';
import { BungaeAdapter } from './bungae.adapter';
import { KarrotAdapter } from './karrot.adapter';
import { SearchAdapter } from './search-adapter.interface';
import { SiteCode } from '@/common/constants/site-code';

@Injectable()
export class AdapterRegistry implements OnModuleDestroy {
  private readonly adapters: Map<string, SearchAdapter>;

  constructor(
    joonggonara: JoonggonaraAdapter,
    bungae: BungaeAdapter,
    karrot: KarrotAdapter,
  ) {
    this.adapters = new Map<string, SearchAdapter>([
      [SiteCode.JOONGGONARA, joonggonara],
      [SiteCode.BUNGAE, bungae],
      [SiteCode.KARROT, karrot],
    ]);
  }

  get(siteCode: string): SearchAdapter {
    const adapter = this.adapters.get(siteCode);
    if (!adapter) {
      throw new Error(`Unsupported site adapter: ${siteCode}`);
    }
    return adapter;
  }

  getAll(siteCodes?: string[]): SearchAdapter[] {
    if (!siteCodes || siteCodes.length === 0) {
      return Array.from(this.adapters.values());
    }
    return siteCodes.map((code) => this.get(code));
  }

  listCodes(): string[] {
    return Array.from(this.adapters.keys());
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.values()).map((adapter) =>
        adapter.dispose?.() ?? Promise.resolve(),
      ),
    );
  }
}
