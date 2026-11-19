import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export interface OrientationAnalysis {
  width: number;
  height: number;
  ratioVH: number;
  asym: number;
  recommendedRotation: 0 | 90 | 180 | 270;
}

function decodeToGrayscaleGrid(
  buffer: Buffer,
  mimeType = 'image/jpeg'
): { w: number; h: number; origW: number; origH: number; gray: Float32Array } | null {
  let origW = 0;
  let origH = 0;
  let rgba: Uint8Array | Buffer | null = null;

  const isPng =
    mimeType.includes('png') ||
    (buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47);

  try {
    if (isPng) {
      const parsed = PNG.sync.read(buffer);
      origW = parsed.width;
      origH = parsed.height;
      rgba = parsed.data;
    } else {
      const parsed = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 128 });
      origW = parsed.width;
      origH = parsed.height;
      rgba = parsed.data;
    }
  } catch {
    // Try fallback decoder if extension/header mismatched
    try {
      const parsed = isPng
        ? jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 128 })
        : PNG.sync.read(buffer);
      origW = parsed.width;
      origH = parsed.height;
      rgba = parsed.data;
    } catch {
      return null;
    }
  }

  if (!rgba || origW < 24 || origH < 24) return null;

  const scale = Math.max(1, Math.floor(Math.max(origW, origH) / 260));
  const w = Math.max(16, Math.floor(origW / scale));
  const h = Math.max(16, Math.floor(origH / scale));
  const gray = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const sy = Math.min(origH - 1, y * scale);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(origW - 1, x * scale);
      const idx = (sy * origW + sx) * 4;
      gray[y * w + x] = 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
    }
  }

  return { w, h, origW, origH, gray };
}

function profileModulation(prof: number[]): number {
  if (prof.length < 6) return 0;
  let mean = 0;
  for (let i = 0; i < prof.length; i++) mean += prof[i];
  mean /= prof.length;

  let diffSq = 0;
  for (let i = 0; i + 2 < prof.length; i++) {
    const d = prof[i + 2] - prof[i];
    diffSq += d * d;
  }
  diffSq /= Math.max(1, prof.length - 2);
  return diffSq / (mean * mean + 1);
}

/**
 * 分析名片影像文字行排列方向，回傳順時針旋轉角度 (0 | 90 | 180 | 270) 以讓文字呈現水平正立閱讀。
 */
export function detectCardClockwiseRotation(
  buffer: Buffer,
  mimeType = 'image/jpeg',
  currentRotation = 0
): OrientationAnalysis | null {
  const decoded = decodeToGrayscaleGrid(buffer, mimeType);
  if (!decoded) return null;

  const { w, h, origW, origH, gray } = decoded;
  const mx = Math.floor(w * 0.08);
  const my = Math.floor(h * 0.08);
  const x0 = mx;
  const x1 = w - mx;
  const y0 = my;
  const y1 = h - my;

  const edge = new Float32Array(w * h);
  for (let y = y0; y < y1 - 1; y++) {
    for (let x = x0; x < x1 - 1; x++) {
      const g = gray[y * w + x];
      const dx = Math.abs(gray[y * w + x + 1] - g);
      const dy = Math.abs(gray[(y + 1) * w + x] - g);
      edge[y * w + x] = dx + dy;
    }
  }

  const angles = [-12, -8, -4, 0, 4, 8, 12];
  let bestHMod = 0;
  let bestVMod = 0;
  let bestVProfile: number[] | null = null;

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  for (const deg of angles) {
    const tanA = Math.tan((deg * Math.PI) / 180);
    const hBins = new Float32Array(h);
    const hCnt = new Uint16Array(h);
    const vBins = new Float32Array(w);
    const vCnt = new Uint16Array(w);

    for (let y = y0; y < y1 - 1; y++) {
      for (let x = x0; x < x1 - 1; x++) {
        const val = edge[y * w + x];
        const ry = Math.round(y - (x - cx) * tanA);
        if (ry >= y0 && ry < y1) {
          hBins[ry] += val;
          hCnt[ry]++;
        }
        const rx = Math.round(x + (y - cy) * tanA);
        if (rx >= x0 && rx < x1) {
          vBins[rx] += val;
          vCnt[rx]++;
        }
      }
    }

    const hProf: number[] = [];
    for (let y = y0 + 2; y < y1 - 2; y++) {
      if (hCnt[y] > 8) hProf.push(hBins[y] / hCnt[y]);
    }
    const vProf: number[] = [];
    for (let x = x0 + 2; x < x1 - 2; x++) {
      if (vCnt[x] > 8) vProf.push(vBins[x] / vCnt[x]);
    }

    const hm = profileModulation(hProf);
    const vm = profileModulation(vProf);
    if (hm > bestHMod) bestHMod = hm;
    if (vm > bestVMod) {
      bestVMod = vm;
      bestVProfile = vProf;
    }
  }

  const ratioVH = bestVMod / (bestHMod + 1e-6);

  let rise = 0;
  let fall = 0;
  if (bestVProfile) {
    for (let i = 1; i < bestVProfile.length; i++) {
      const d = bestVProfile[i] - bestVProfile[i - 1];
      if (d > 0) rise += d * d * d;
      else fall += -d * -d * -d;
    }
  }
  const asym = fall / (rise + 1e-6);

  const normalizedCur = (((Math.round(currentRotation / 90) * 90) % 360) + 360) % 360;

  let recommendedRotation: 0 | 90 | 180 | 270 = 0;

  // Sideways vertical text lines detected (90 or 270 deg)
  if (ratioVH >= 1.12) {
    if (normalizedCur === 270) {
      recommendedRotation = 270;
    } else if (normalizedCur === 90) {
      recommendedRotation = 90;
    } else if (asym < 0.62) {
      recommendedRotation = 270;
    } else {
      recommendedRotation = 90;
    }
  } else if (ratioVH <= 0.85) {
    // Clearly horizontal text lines (0 or 180 deg)
    recommendedRotation = normalizedCur === 180 ? 180 : 0;
  } else {
    // Borderline zone (0.85 < ratioVH < 1.12): use aspect ratio + existing rotation
    if (normalizedCur === 90 || normalizedCur === 270) {
      recommendedRotation = normalizedCur as 90 | 270;
    } else if (origH > origW * 1.25 && ratioVH >= 0.98) {
      recommendedRotation = 90;
    } else {
      recommendedRotation = 0;
    }
  }

  return {
    width: origW,
    height: origH,
    ratioVH: Number(ratioVH.toFixed(3)),
    asym: Number(asym.toFixed(3)),
    recommendedRotation,
  };
}
