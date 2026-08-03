import {
  isNationwideRegions,
  regionMatchesPresets,
  resolveKarrotIns,
  resolveSearchRegions,
  SEARCH_REGION_PRESETS,
} from './search-region';

describe('search-region', () => {
  it('resolves all when empty or all', () => {
    expect(resolveSearchRegions(null)).toHaveLength(
      SEARCH_REGION_PRESETS.length,
    );
    expect(resolveSearchRegions(['all'])).toHaveLength(
      SEARCH_REGION_PRESETS.length,
    );
    expect(isNationwideRegions(['all'])).toBe(true);
  });

  it('resolves subset codes', () => {
    const presets = resolveSearchRegions(['gyeonggi', 'seoul']);
    expect(presets.map((p) => p.code)).toEqual(['gyeonggi', 'seoul']);
    expect(isNationwideRegions(['gyeonggi'])).toBe(false);
  });

  it('matches joongna/bungae region text', () => {
    const presets = resolveSearchRegions(['gyeonggi']);
    expect(regionMatchesPresets('경기도 남양주시 진건읍', presets)).toBe(true);
    expect(regionMatchesPresets('서울특별시 서초구', presets)).toBe(false);
    expect(regionMatchesPresets(null, presets)).toBe(false);
  });

  it('karrot gyeonggi uses 읍·면 targets including 진건읍', () => {
    const ins = resolveKarrotIns(['gyeonggi']);
    expect(ins.some((x) => x.startsWith('진건읍-'))).toBe(true);
    expect(ins.every((x) => /읍-|면-/.test(x))).toBe(true);
    expect(ins.length).toBeGreaterThan(50);
    expect(ins.length).toBeLessThan(250);
  });
});
