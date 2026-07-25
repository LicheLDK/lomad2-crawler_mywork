import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AiPromptHistory } from '@/database/entities/ai-prompt-history.entity';
import { AiPromptVersion } from '@/database/entities/ai-prompt-version.entity';
import { AiEngineError } from '../ai.types';
import { isPromptKey, PROMPT_KEYS, type PromptKey } from './catalog';
import { renderPromptTemplate } from './prompt-render';
import type {
  PromptHistoryItem,
  PromptTemplateContent,
  PromptTreeNode,
  PromptUpdateInput,
  PromptVars,
  RenderedPrompt,
} from './prompt.types';

/**
 * Prompt Management
 * - 본문은 prompt/templates/{key}/v{n}/ 파일 (코드에 직접 작성 금지)
 * - Version + History (DB)
 * - 관리자 수정 API용 updatePrompt (히스토리 저장)
 */
@Injectable()
export class PromptManagerService implements OnModuleInit {
  private readonly logger = new Logger(PromptManagerService.name);
  /** key → 활성 템플릿 캐시 */
  private readonly cache = new Map<string, PromptTemplateContent>();

  constructor(
    @InjectRepository(AiPromptVersion)
    private readonly versionRepo: Repository<AiPromptVersion>,
    @InjectRepository(AiPromptHistory)
    private readonly historyRepo: Repository<AiPromptHistory>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncFromFiles();
    await this.reloadCache();
  }

  /** 파일 → DB seed (없는 key/version만) */
  async syncFromFiles(): Promise<void> {
    const fromFiles = this.loadAllFromFiles();
    for (const tpl of fromFiles) {
      try {
        const exists = await this.versionRepo.findOne({
          where: { key: tpl.key, version: tpl.version },
        });
        if (exists) continue;

        const hasActive = await this.versionRepo.findOne({
          where: { key: tpl.key, active: true },
        });

        await this.versionRepo.save(
          this.versionRepo.create({
            key: tpl.key,
            version: tpl.version,
            name: tpl.name,
            description: tpl.description,
            systemTemplate: tpl.systemTemplate,
            userTemplate: tpl.userTemplate,
            active: !hasActive,
            source: 'file',
          }),
        );

        await this.historyRepo.save(
          this.historyRepo.create({
            key: tpl.key,
            version: tpl.version,
            systemTemplate: tpl.systemTemplate,
            userTemplate: tpl.userTemplate,
            note: 'seed from prompt/templates',
            changedBy: 'system',
          }),
        );
        this.logger.log(`Prompt seeded ${tpl.key}@v${tpl.version}`);
      } catch (error) {
        this.logger.warn(
          `Prompt seed ${tpl.key}@v${tpl.version} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async reloadCache(): Promise<void> {
    this.cache.clear();
    try {
      const actives = await this.versionRepo.find({ where: { active: true } });
      for (const row of actives) {
        this.cache.set(row.key, {
          key: row.key,
          version: row.version,
          name: row.name,
          description: row.description,
          systemTemplate: row.systemTemplate,
          userTemplate: row.userTemplate,
          source: row.source === 'admin' ? 'db' : 'file',
          active: true,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Prompt DB cache failed, using files: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // DB 비어 있으면 파일 fallback
    for (const key of PROMPT_KEYS) {
      if (this.cache.has(key)) continue;
      const fileTpl = this.loadLatestFromFiles(key);
      if (fileTpl) this.cache.set(key, fileTpl);
    }
  }

  /** 활성 Prompt 렌더 */
  render(key: PromptKey | string, vars: PromptVars = {}): RenderedPrompt {
    const tpl = this.cache.get(key) ?? this.loadLatestFromFiles(key);
    if (!tpl) {
      throw new AiEngineError(
        `Prompt not found: ${key}`,
        'INVALID_REQUEST',
      );
    }
    return {
      key: tpl.key,
      version: tpl.version,
      system: renderPromptTemplate(tpl.systemTemplate, vars),
      user: renderPromptTemplate(tpl.userTemplate, vars),
    };
  }

  getActive(key: string): PromptTemplateContent | null {
    return this.cache.get(key) ?? this.loadLatestFromFiles(key);
  }

  async listVersions(key: string): Promise<AiPromptVersion[]> {
    return this.versionRepo.find({
      where: { key },
      order: { version: 'DESC' },
    });
  }

  async getHistory(key: string, limit = 50): Promise<PromptHistoryItem[]> {
    const rows = await this.historyRepo.find({
      where: { key },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      version: r.version,
      systemTemplate: r.systemTemplate,
      userTemplate: r.userTemplate,
      note: r.note,
      changedBy: r.changedBy,
      createdAt: r.createdAt,
    }));
  }

  /**
   * 관리자용 Prompt 수정 → 새 version + History
   * (UI 미구현, API 구조만)
   */
  async updatePrompt(
    key: string,
    input: PromptUpdateInput,
  ): Promise<AiPromptVersion> {
    if (!isPromptKey(key) && !this.cache.has(key)) {
      // 신규 key 도 허용 (확장)
    }

    const latestRows = await this.versionRepo.find({
      where: { key },
      order: { version: 'DESC' },
      take: 1,
    });
    const latest = latestRows[0] ?? null;
    const nextVersion = (latest?.version ?? 0) + 1;

    await this.versionRepo.update({ key, active: true }, { active: false });

    const saved = await this.versionRepo.save(
      this.versionRepo.create({
        key,
        version: nextVersion,
        name: input.name || latest?.name || key,
        description:
          input.description !== undefined
            ? input.description
            : latest?.description ?? null,
        systemTemplate: input.systemTemplate,
        userTemplate: input.userTemplate,
        active: true,
        source: 'admin',
      }),
    );

    await this.historyRepo.save(
      this.historyRepo.create({
        key,
        version: nextVersion,
        systemTemplate: input.systemTemplate,
        userTemplate: input.userTemplate,
        note: input.note ?? 'admin update',
        changedBy: input.changedBy ?? 'admin',
      }),
    );

    await this.reloadCache();
    this.logger.log(`Prompt updated ${key}@v${nextVersion}`);
    return saved;
  }

  /** Prompt Tree (관리자·문서용) */
  async getPromptTree(): Promise<PromptTreeNode[]> {
    const nodes: PromptTreeNode[] = [];

    for (const key of PROMPT_KEYS) {
      let versions: AiPromptVersion[] = [];
      try {
        versions = await this.listVersions(key);
      } catch {
        versions = [];
      }
      const fileVersions = this.listFileVersions(key);
      const versionNums = [
        ...new Set([
          ...versions.map((v) => v.version),
          ...fileVersions,
        ]),
      ].sort((a, b) => a - b);

      const active = versions.find((v) => v.active) ?? null;
      const fileMeta = this.loadLatestFromFiles(key);

      nodes.push({
        key,
        name: active?.name || fileMeta?.name || key,
        activeVersion: active?.version ?? fileMeta?.version ?? null,
        versions: versionNums,
        description: active?.description ?? fileMeta?.description ?? null,
        source:
          versions.length && fileVersions.length
            ? 'mixed'
            : versions.length
              ? 'db'
              : 'file',
      });
    }

    return nodes;
  }

  /** 파일 시스템 Prompt Tree 문자열 */
  getFilePromptTreeText(): string {
    const root = this.resolveTemplatesRoot();
    const lines = ['src/ai/prompt/', '├── catalog.ts', '├── prompt-manager.service.ts', '├── prompt-render.ts', '├── prompt.types.ts', '├── builders/', '├── templates/'];

    if (!root || !existsSync(root)) {
      lines.push('└── (templates missing)');
      return lines.join('\n');
    }

    const keys = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    keys.forEach((key, ki) => {
      const keyBranch = ki === keys.length - 1 ? '└──' : '├──';
      const keyPad = ki === keys.length - 1 ? '    ' : '│   ';
      lines.push(`│   ${keyBranch} ${key}/`);

      const keyDir = join(root, key);
      const vers = readdirSync(keyDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^v\d+$/i.test(d.name))
        .map((d) => d.name)
        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

      vers.forEach((ver, vi) => {
        const verBranch = vi === vers.length - 1 ? '└──' : '├──';
        const verPad = vi === vers.length - 1 ? '    ' : '│   ';
        lines.push(`│   ${keyPad}${verBranch} ${ver}/`);
        const files = ['meta.json', 'system.md', 'user.md'];
        files.forEach((f, fi) => {
          const fb = fi === files.length - 1 ? '└──' : '├──';
          lines.push(`│   ${keyPad}${verPad}${fb} ${f}`);
        });
      });
    });

    return lines.join('\n');
  }

  private loadAllFromFiles(): PromptTemplateContent[] {
    const root = this.resolveTemplatesRoot();
    if (!root || !existsSync(root)) return [];
    const out: PromptTemplateContent[] = [];
    for (const key of readdirSync(root, { withFileTypes: true })) {
      if (!key.isDirectory()) continue;
      for (const ver of this.listFileVersions(key.name)) {
        const tpl = this.loadFromFiles(key.name, ver);
        if (tpl) out.push(tpl);
      }
    }
    return out;
  }

  private loadLatestFromFiles(key: string): PromptTemplateContent | null {
    const vers = this.listFileVersions(key);
    if (!vers.length) return null;
    return this.loadFromFiles(key, vers[vers.length - 1]);
  }

  private listFileVersions(key: string): number[] {
    const root = this.resolveTemplatesRoot();
    if (!root) return [];
    const dir = join(root, key);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^v\d+$/i.test(d.name))
      .map((d) => parseInt(d.name.slice(1), 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  private loadFromFiles(
    key: string,
    version: number,
  ): PromptTemplateContent | null {
    const root = this.resolveTemplatesRoot();
    if (!root) return null;
    const dir = join(root, key, `v${version}`);
    const systemPath = join(dir, 'system.md');
    const userPath = join(dir, 'user.md');
    const metaPath = join(dir, 'meta.json');
    if (!existsSync(systemPath) || !existsSync(userPath)) return null;

    let name = key;
    let description: string | null = null;
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
          name?: string;
          description?: string;
        };
        name = meta.name || name;
        description = meta.description ?? null;
      } catch {
        // ignore
      }
    }

    return {
      key,
      version,
      name,
      description,
      systemTemplate: readFileSync(systemPath, 'utf8').trim(),
      userTemplate: readFileSync(userPath, 'utf8').trim(),
      source: 'file',
      active: true,
    };
  }

  private resolveTemplatesRoot(): string | null {
    const candidates = [
      join(__dirname, 'templates'),
      join(__dirname, '..', 'prompt', 'templates'),
      join(process.cwd(), 'src', 'ai', 'prompt', 'templates'),
      join(process.cwd(), 'dist', 'ai', 'prompt', 'templates'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  }
}
