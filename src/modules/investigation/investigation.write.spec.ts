import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InvestigationService } from './investigation.service';
import {
  InvestigationCaseEntity,
  InvestigationNote,
} from '@/database/entities/investigation-case.entity';
import { CrawlerResult } from '@/database/entities/crawler-result.entity';

describe('InvestigationService write APIs', () => {
  function seedCase(
    overrides: Partial<InvestigationCaseEntity> = {},
  ): InvestigationCaseEntity {
    return {
      id: 'case-1',
      caseNo: 'CASE-20260729-000001',
      productName: '테스트 매물',
      aiScore: 0.9,
      status: 'Open',
      priority: 'High',
      assignee: null,
      siteCode: 'bungae',
      url: 'https://example.com/listing-1',
      imageUrl: null,
      price: '100000',
      resultId: 'result-1',
      searchHistoryId: 'history-1',
      searchJobId: 'job-1',
      orderNo: 'ORDER-1',
      contractNo: null,
      customerName: null,
      orderProductName: null,
      listingTitle: '테스트 매물',
      autoCreated: true,
      timeline: [],
      aiAnalysis: null,
      notes: [],
      finalDecision: null,
      finalDecisionNote: null,
      decidedAt: null,
      dueDate: null,
      createdAt: new Date('2026-07-29T00:00:00.000Z'),
      updatedAt: new Date('2026-07-29T00:00:00.000Z'),
      ...overrides,
    } as InvestigationCaseEntity;
  }

  function createHarness(opts?: {
    cases?: InvestigationCaseEntity[];
    results?: CrawlerResult[];
  }) {
    const cases = opts?.cases ?? [seedCase()];
    const results = opts?.results ?? [];

    const caseRepo = {
      findOne: jest.fn(
        async ({
          where,
        }: {
          where: Partial<InvestigationCaseEntity>;
        }) => {
          if (where.id) {
            return cases.find((item) => item.id === where.id) ?? null;
          }
          if (where.resultId) {
            return cases.find((item) => item.resultId === where.resultId) ?? null;
          }
          return null;
        },
      ),
      create: jest.fn((data: Partial<InvestigationCaseEntity>) => ({
        ...data,
      })),
      save: jest.fn(async (entity: Partial<InvestigationCaseEntity>) => {
        const normalized = {
          ...seedCase(),
          ...entity,
          id: entity.id ?? `case-${cases.length + 1}`,
          notes: entity.notes ?? [],
          timeline: entity.timeline ?? [],
          updatedAt: new Date('2026-07-29T12:00:00.000Z'),
        } as InvestigationCaseEntity;
        const index = cases.findIndex((item) => item.id === normalized.id);
        if (index >= 0) {
          cases[index] = normalized;
        } else {
          cases.push(normalized);
        }
        return normalized;
      }),
      createQueryBuilder: jest.fn((_alias?: string) => {
        const state: {
          whereSince?: Date;
          groupByStatus?: boolean;
          likePrefix?: string;
        } = {};
        const qb: {
          where: jest.Mock;
          select: jest.Mock;
          addSelect: jest.Mock;
          groupBy: jest.Mock;
          orderBy: jest.Mock;
          getCount: jest.Mock;
          getRawMany: jest.Mock;
          getOne: jest.Mock;
        } = {
          where: jest.fn(),
          select: jest.fn(),
          addSelect: jest.fn(),
          groupBy: jest.fn(),
          orderBy: jest.fn(),
          getCount: jest.fn(),
          getRawMany: jest.fn(),
          getOne: jest.fn(),
        };
        qb.where.mockImplementation(
          (clause: string, params?: { since?: Date; prefix?: string }) => {
            if (clause.includes('createdAt') && params?.since) {
              state.whereSince = params.since;
            }
            if (clause.includes('caseNo LIKE') && params?.prefix) {
              state.likePrefix = params.prefix;
            }
            return qb;
          },
        );
        qb.select.mockReturnValue(qb);
        qb.addSelect.mockReturnValue(qb);
        qb.groupBy.mockImplementation(() => {
          state.groupByStatus = true;
          return qb;
        });
        qb.orderBy.mockReturnValue(qb);
        qb.getCount.mockImplementation(async () => {
          if (!state.whereSince) return cases.length;
          return cases.filter((c) => c.createdAt >= state.whereSince!).length;
        });
        qb.getRawMany.mockImplementation(async () => {
          if (!state.groupByStatus) return [];
          const map = new Map<string, number>();
          for (const c of cases) {
            map.set(c.status, (map.get(c.status) ?? 0) + 1);
          }
          return [...map.entries()].map(([status, cnt]) => ({
            status,
            cnt: String(cnt),
          }));
        });
        qb.getOne.mockImplementation(async () => {
          const latest = [...cases]
            .filter((c) =>
              state.likePrefix ? c.caseNo.startsWith(state.likePrefix) : true,
            )
            .sort((a, b) => b.caseNo.localeCompare(a.caseNo))[0];
          return latest ?? null;
        });
        return qb;
      }),
    };

    const historyResultRepo = {
      findOne: jest.fn(async () => null),
    };

    const historyRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'history-1'
          ? { id: 'history-1', keyword: '테스트' }
          : null,
      ),
    };

    const jobRepo = {
      findOne: jest.fn(async ({ where }: { where: { id?: string } }) => {
        if (where.id === 'job-1') {
          return { id: 'job-1', orderNo: 'ORDER-1' };
        }
        return null;
      }),
    };

    const resultRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        results.find((r) => r.id === where.id) ?? null,
      ),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'investigation.autoCreateEnabled') return true;
        if (key === 'investigation.aiScoreThreshold') return 90;
        if (key === 'investigation.orderUrlTemplate')
          return '/getOrderInfo?order_id={orderNo}';
        return undefined;
      }),
    };

    const service = new InvestigationService(
      caseRepo as never,
      historyResultRepo as never,
      historyRepo as never,
      jobRepo as never,
      resultRepo as never,
      config as never,
      { canAnalyzeInvestigation: jest.fn(() => false) } as never,
      undefined,
    );

    return { service, cases, caseRepo, resultRepo, historyRepo };
  }

  describe('updateStatus', () => {
    it('allows Open → Investigating and records a timeline event', async () => {
      const { service, cases } = createHarness();
      const dto = await service.updateStatus('case-1', {
        status: 'Investigating',
      });
      expect(dto.status).toBe('Investigating');
      expect(cases[0].status).toBe('Investigating');
      expect(
        cases[0].timeline.some((e) => e.kind === 'status_changed'),
      ).toBe(true);
    });

    it('rejects illegal transitions with BadRequestException', async () => {
      const { service } = createHarness();
      await expect(
        service.updateStatus('case-1', { status: 'Completed' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.updateStatus('case-1', { status: 'Archived' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects any transition from Archived', async () => {
      const { service } = createHarness({
        cases: [seedCase({ status: 'Archived' })],
      });
      await expect(
        service.updateStatus('case-1', { status: 'Completed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is a no-op when status is unchanged', async () => {
      const { service, caseRepo } = createHarness();
      const dto = await service.updateStatus('case-1', { status: 'Open' });
      expect(dto.status).toBe('Open');
      expect(caseRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('notes CRUD', () => {
    it('adds, updates, and deletes notes', async () => {
      const { service, cases } = createHarness();

      const added = await service.addNote('case-1', {
        body: '첫 메모',
        author: 'kim',
      });
      expect(added.notes).toHaveLength(1);
      expect(added.notes[0].body).toBe('첫 메모');
      expect(added.notes[0].author).toBe('kim');
      expect(
        cases[0].timeline.some((e) => e.kind === 'note_added'),
      ).toBe(true);

      const noteId = (added.notes[0] as InvestigationNote).id;
      const updated = await service.updateNote('case-1', noteId, {
        body: '수정된 메모',
      });
      expect(updated.notes[0].body).toBe('수정된 메모');

      const deleted = await service.deleteNote('case-1', noteId);
      expect(deleted.notes).toHaveLength(0);
    });

    it('throws NotFound when noteId is missing', async () => {
      const { service } = createHarness();
      await expect(
        service.updateNote('case-1', '00000000-0000-4000-8000-000000000099', {
          body: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('applyFinalDecision', () => {
    it('sets Completed + decidedAt and is idempotent for the same decision', async () => {
      const { service, cases, caseRepo } = createHarness({
        cases: [seedCase({ status: 'Review' })],
      });

      const first = await service.applyFinalDecision('case-1', {
        decision: 'resale_confirmed',
        note: '확인됨',
      });
      expect(first.status).toBe('Completed');
      expect(first.finalDecision).toBe('resale_confirmed');
      expect(first.finalDecisionNote).toBe('확인됨');
      expect(first.decidedAt).toBeTruthy();
      expect(cases[0].status).toBe('Completed');
      expect(
        cases[0].timeline.some((e) => e.kind === 'final_decision'),
      ).toBe(true);

      caseRepo.save.mockClear();
      const second = await service.applyFinalDecision('case-1', {
        decision: 'resale_confirmed',
        note: '확인됨',
      });
      expect(second.status).toBe('Completed');
      expect(caseRepo.save).not.toHaveBeenCalled();
    });

    it('rejects Archived cases', async () => {
      const { service } = createHarness({
        cases: [seedCase({ status: 'Archived' })],
      });
      await expect(
        service.applyFinalDecision('case-1', {
          decision: 'excluded',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createManual', () => {
    it('returns the existing case when resultId already has a case', async () => {
      const { service, cases, caseRepo } = createHarness();
      const dto = await service.createManual({ resultId: 'result-1' });
      expect(dto.id).toBe('case-1');
      expect(cases).toHaveLength(1);
      expect(caseRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new non-auto case for a fresh resultId', async () => {
      const listing = {
        id: 'result-new',
        siteCode: 'bungae',
        title: '신규 매물',
        url: 'https://example.com/new',
        imageUrl: null,
        price: '50000',
        description: null,
        searchHistoryId: 'history-1',
        titleSimilarity: 0.8,
        imageSimilarity: 0.5,
      } as CrawlerResult;

      const { service, cases } = createHarness({
        cases: [],
        results: [listing],
      });

      const dto = await service.createManual({
        resultId: 'result-new',
        searchHistoryId: 'history-1',
        searchJobId: 'job-1',
      });

      expect(cases).toHaveLength(1);
      expect(cases[0].resultId).toBe('result-new');
      expect(cases[0].autoCreated).toBe(false);
      expect(dto.autoCreated).toBe(false);
      expect(dto.orderNo).toBe('ORDER-1');
    });

    it('throws NotFound when crawler result is missing', async () => {
      const { service } = createHarness({ cases: [] });
      await expect(
        service.createManual({ resultId: 'missing-result' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('returns last24h and byStatus counts', async () => {
      const { service } = createHarness({
        cases: [
          seedCase({ id: 'a', status: 'Open' }),
          seedCase({
            id: 'b',
            status: 'Completed',
            resultId: 'result-2',
            caseNo: 'CASE-20260729-000002',
          }),
          seedCase({
            id: 'c',
            status: 'Open',
            resultId: 'result-3',
            caseNo: 'CASE-20260729-000003',
            createdAt: new Date('2020-01-01T00:00:00.000Z'),
          }),
        ],
      });

      const stats = await service.getStats();
      expect(stats.last24h).toBe(2);
      expect(stats.byStatus.Open).toBe(2);
      expect(stats.byStatus.Completed).toBe(1);
      expect(stats.byStatus.Investigating).toBe(0);
    });
  });

  describe('updateAssignment', () => {
    it('updates assignee, priority, and dueDate', async () => {
      const { service } = createHarness();
      const dto = await service.updateAssignment('case-1', {
        assignee: 'lee',
        priority: 'Medium',
        dueDate: '2026-08-01T00:00:00.000Z',
      });
      expect(dto.assignee).toBe('lee');
      expect(dto.priority).toBe('Medium');
      expect(dto.dueDate).toBeTruthy();
    });
  });
});
