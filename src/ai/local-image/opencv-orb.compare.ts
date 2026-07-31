import { Logger } from '@nestjs/common';
import type { LocalOpenCvScore } from './local-image.types';

type CvRuntime = {
  Mat: new () => CvMat;
  KeyPointVector: new () => CvKeyPointVector;
  DMatchVector: new () => CvDMatchVector;
  DMatchVectorVector: new () => CvDMatchVectorVector;
  ORB: new (nfeatures?: number) => CvOrb;
  BFMatcher: new (normType: number, crossCheck?: boolean) => CvBFMatcher;
  matFromImageData: (imageData: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }) => CvMat;
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void;
  COLOR_RGBA2GRAY: number;
  NORM_HAMMING: number;
};

type CvMat = {
  empty: () => boolean;
  delete: () => void;
};

type CvKeyPointVector = {
  size: () => number;
  delete: () => void;
};

type CvDMatch = { distance: number };

type CvDMatchVector = {
  size: () => number;
  get: (i: number) => CvDMatch;
  push_back: (m: CvDMatch) => void;
  delete: () => void;
};

type CvDMatchVectorVector = {
  size: () => number;
  get: (i: number) => { size: () => number; get: (j: number) => CvDMatch };
  delete: () => void;
};

type CvOrb = {
  detectAndCompute: (
    image: CvMat,
    mask: CvMat,
    keypoints: CvKeyPointVector,
    descriptors: CvMat,
  ) => void;
  delete: () => void;
};

type CvBFMatcher = {
  knnMatch: (
    query: CvMat,
    train: CvMat,
    matches: CvDMatchVectorVector,
    k: number,
  ) => void;
  delete: () => void;
};

export interface OpenCvOrbCompareOptions {
  nfeatures: number;
  matchRatio: number;
}

const logger = new Logger('OpenCvOrbCompare');

let cvReady: Promise<CvRuntime> | null = null;

async function loadOpenCv(): Promise<CvRuntime> {
  if (!cvReady) {
    cvReady = (async () => {
      const cvModule = require('@techstark/opencv-js') as
        | CvRuntime
        | Promise<CvRuntime>
        | (CvRuntime & { onRuntimeInitialized?: () => void; Mat?: unknown });

      if (cvModule instanceof Promise) {
        return cvModule;
      }
      if ((cvModule as CvRuntime).Mat) {
        return cvModule as CvRuntime;
      }
      await new Promise<void>((resolve) => {
        (cvModule as { onRuntimeInitialized: () => void }).onRuntimeInitialized =
          () => resolve();
      });
      return cvModule as CvRuntime;
    })();
  }
  return cvReady;
}

/** OpenCV ORB feature matching (비용 0). Feature Image는 생성하지 않는다. */
export async function compareOpenCvOrb(
  imageA: Buffer,
  imageB: Buffer,
  options: OpenCvOrbCompareOptions,
): Promise<LocalOpenCvScore> {
  const disposable: Array<{ delete: () => void }> = [];
  const track = <T extends { delete: () => void }>(obj: T): T => {
    disposable.push(obj);
    return obj;
  };

  try {
    const cv = await loadOpenCv();
    const rgbaA = track(await bufferToRgbaMat(cv, imageA));
    const rgbaB = track(await bufferToRgbaMat(cv, imageB));
    const grayA = track(new cv.Mat());
    const grayB = track(new cv.Mat());
    cv.cvtColor(rgbaA, grayA, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(rgbaB, grayB, cv.COLOR_RGBA2GRAY);

    const orb = track(new cv.ORB(options.nfeatures));
    const kp1 = track(new cv.KeyPointVector());
    const kp2 = track(new cv.KeyPointVector());
    const des1 = track(new cv.Mat());
    const des2 = track(new cv.Mat());
    const mask = track(new cv.Mat());

    orb.detectAndCompute(grayA, mask, kp1, des1);
    orb.detectAndCompute(grayB, mask, kp2, des2);

    const keyPointCount = kp1.size() + kp2.size();

    if (des1.empty() || des2.empty() || kp1.size() === 0 || kp2.size() === 0) {
      return {
        similarity: 0,
        keyPointCount,
        matchedFeatures: 0,
      };
    }

    const bf = track(new cv.BFMatcher(cv.NORM_HAMMING, false));
    const knnMatches = track(new cv.DMatchVectorVector());
    bf.knnMatch(des1, des2, knnMatches, 2);

    const goodMatches = track(new cv.DMatchVector());
    for (let i = 0; i < knnMatches.size(); i++) {
      const pair = knnMatches.get(i);
      if (pair.size() >= 2) {
        const best = pair.get(0);
        const second = pair.get(1);
        if (best.distance < options.matchRatio * second.distance) {
          goodMatches.push_back(best);
        }
      } else if (pair.size() === 1) {
        goodMatches.push_back(pair.get(0));
      }
    }

    const matchedFeatures = goodMatches.size();
    const denom = Math.max(Math.min(kp1.size(), kp2.size()), 1);
    const similarity =
      Math.round(Math.min(1, matchedFeatures / denom) * 1000) / 10;

    return {
      similarity,
      keyPointCount,
      matchedFeatures,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`OpenCV ORB compare failed: ${message}`);
    return {
      similarity: 0,
      keyPointCount: 0,
      matchedFeatures: 0,
      skipped: true,
      error: message,
    };
  } finally {
    for (let i = disposable.length - 1; i >= 0; i--) {
      try {
        disposable[i].delete();
      } catch {
        /* ignore */
      }
    }
  }
}

async function bufferToRgbaMat(cv: CvRuntime, image: Buffer): Promise<CvMat> {
  const sharp = require('sharp') as typeof import('sharp');
  const { data, info } = await sharp(image, { failOn: 'error' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height) {
    throw new Error('OpenCV ORB: unable to read image dimensions');
  }

  return cv.matFromImageData({
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  });
}
