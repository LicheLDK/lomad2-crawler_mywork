export class SiteCode {
  static readonly JOONGGONARA = 'joonggonara';
  static readonly BUNGAE = 'bungae';
  static readonly KARROT = 'karrot';

  static readonly ALL = [
    SiteCode.JOONGGONARA,
    SiteCode.BUNGAE,
    SiteCode.KARROT,
  ] as const;
}

export type SupportedSiteCode = (typeof SiteCode.ALL)[number];
