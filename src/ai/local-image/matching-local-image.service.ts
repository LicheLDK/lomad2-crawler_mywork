import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageStorageService } from '@/storage/image-storage.service';
import { compareColorHistogram } from './color-histogram.compare';
import {
  decideEarlyLocalGate,
  decideLocalVisionGate,
} from './decide-local-vision-gate';
import { compareLooksSame } from './looks-same.compare';
import type { MatchingLocalImageGateResult } from './local-image.types';
import { compareOpenCvOrb } from './opencv-orb.compare';
import { comparePHash } from './phash.compare';
import { preprocessForLocalCompare } from './preprocess';
import { compareSsim } from './ssim.compare';

/**
 * Matching 파이프라인용 로컬 이미지 게이트.
 * Color → pHash → LooksSame + SSIM + OpenCV → (threshold) Vision
 */
@Injectable()
export class MatchingLocalImageService {
  private readonly logger = new Logger(MatchingLocalImageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<boolean>('ai.localImageGate') !== false;
  }

  /**
   * 렌탈/리스팅 썸네일을 로컬 비교하고 Vision 호출 여부를 반환한다.
   * 다운로드 실패 시 null (호출측에서 Vision fallback).
   */
  async evaluate(input: {
    rentalImageUrl: string;
    listingImageUrl: string;
  }): Promise<MatchingLocalImageGateResult | null> {
    const [rentalRaw, listingRaw] = await Promise.all([
      this.imageStorage.fetchBuffer(input.rentalImageUrl),
      this.imageStorage.fetchBuffer(input.listingImageUrl),
    ]);

    if (!rentalRaw || !listingRaw) {
      this.logger.warn(
        'Local image gate skipped: download failed (Vision may fallback)',
      );
      return null;
    }

    const maxWidth =
      this.config.get<number>('ai.localPreprocessMaxWidth') ?? 512;
    const maxHeight =
      this.config.get<number>('ai.localPreprocessMaxHeight') ?? 512;
    const backgroundHex =
      this.config.get<string>('ai.localPreprocessBackground') ?? 'ffffff';
    const normalize =
      this.config.get<boolean>('ai.localPreprocessNormalize') !== false;

    const [rental, listing] = await Promise.all([
      preprocessForLocalCompare(rentalRaw, {
        maxWidth,
        maxHeight,
        backgroundHex,
        normalize,
      }),
      preprocessForLocalCompare(listingRaw, {
        maxWidth,
        maxHeight,
        backgroundHex,
        normalize,
      }),
    ]);

    const colorRejectThreshold =
      this.config.get<number>('ai.localColorRejectThreshold') ?? 35;
    const pHashRejectThreshold =
      this.config.get<number>('ai.localPHashRejectThreshold') ?? 30;
    const pHashPassThreshold =
      this.config.get<number>('ai.localPHashPassThreshold') ?? 90;
    const looksSameThreshold =
      this.config.get<number>('ai.localLooksSameThreshold') ?? 70;
    const openCvThreshold =
      this.config.get<number>('ai.localOpenCvThreshold') ?? 60;
    const ssimThreshold =
      this.config.get<number>('ai.localSsimThreshold') ?? 75;
    const ssimPassThreshold =
      this.config.get<number>('ai.localSsimPassThreshold') ?? 92;

    // 1) 저비용 게이트: Color + pHash
    const [colorHist, pHash] = await Promise.all([
      compareColorHistogram(rental, listing),
      comparePHash(rental, listing),
    ]);

    const early = decideEarlyLocalGate({
      colorHist,
      pHash,
      thresholds: {
        colorRejectThreshold,
        pHashRejectThreshold,
        pHashPassThreshold,
      },
    });

    if (early.action !== 'continue') {
      this.logger.debug(
        `local image early gate stage=${early.result.stage}` +
          ` shouldVision=${early.result.shouldCallVision}` +
          ` color=${colorHist.skipped ? 'skip' : colorHist.similarity}` +
          ` pHash=${pHash.skipped ? 'skip' : pHash.similarity}` +
          ` localSim=${early.result.localSimilarity}`,
      );
      return early.result;
    }

    // 2) LooksSame + SSIM + OpenCV (SSIM은 LooksSame 보완)
    const [looksSame, ssim, openCv] = await Promise.all([
      compareLooksSame(rental, listing, {
        threshold: looksSameThreshold,
        strict: this.config.get<boolean>('ai.localLooksSameStrict') === true,
        tolerance: this.config.get<number>('ai.localLooksSameTolerance') ?? 2.5,
        ignoreAntialiasing:
          this.config.get<boolean>('ai.localLooksSameIgnoreAntialiasing') !==
          false,
        backgroundHex,
      }),
      compareSsim(rental, listing),
      compareOpenCvOrb(rental, listing, {
        nfeatures: this.config.get<number>('ai.localOpenCvOrbNfeatures') ?? 500,
        matchRatio:
          this.config.get<number>('ai.localOpenCvOrbMatchRatio') ?? 0.75,
      }),
    ]);

    const gate = decideLocalVisionGate({
      colorHist,
      pHash,
      ssim,
      looksSame,
      openCv,
      looksSameThreshold,
      openCvThreshold,
      ssimThreshold,
      ssimPassThreshold,
    });

    this.logger.debug(
      `local image gate stage=${gate.stage}` +
        ` shouldVision=${gate.shouldCallVision}` +
        ` color=${colorHist.skipped ? 'skip' : colorHist.similarity}` +
        ` pHash=${pHash.skipped ? 'skip' : pHash.similarity}` +
        ` ssim=${ssim.skipped ? 'skip' : ssim.similarity}` +
        ` looksSame=${looksSame.skipped ? 'skip' : looksSame.similarity}` +
        ` openCv=${openCv.skipped ? 'skip' : openCv.similarity}` +
        ` localSim=${gate.localSimilarity}`,
    );

    return gate;
  }
}
