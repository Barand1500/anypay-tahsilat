/** Serbest jest yolu — normalize + benzerlik */

export type Pt = { x: number; y: number };

const SAMPLE_N = 64;

export function resample(points: Pt[], n = SAMPLE_N): Pt[] {
  if (points.length < 2) return points.slice();
  const dists: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    total += d;
    dists.push(total);
  }
  if (total < 1) return Array.from({ length: n }, () => ({ ...points[0] }));

  const step = total / (n - 1);
  const out: Pt[] = [{ ...points[0] }];
  let j = 1;
  for (let i = 1; i < n - 1; i++) {
    const target = step * i;
    while (j < dists.length - 1 && dists[j] < target) j++;
    const t0 = dists[j - 1];
    const t1 = dists[j];
    const r = t1 === t0 ? 0 : (target - t0) / (t1 - t0);
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * r,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * r,
    });
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

/** Bounding box’a göre 0–1 kareye oturt */
export function normalize(points: Pt[]): Pt[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const scale = Math.max(w, h);
  return points.map((p) => ({
    x: (p.x - minX) / scale,
    y: (p.y - minY) / scale,
  }));
}

export function preparePath(raw: Pt[]): Pt[] {
  return normalize(resample(raw));
}

/** Ortalama mesafe (0 = aynı). Eşik ~0.18–0.22 iyi. */
export function pathDistance(a: Pt[], b: Pt[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  }
  return sum / n;
}

export const MATCH_THRESHOLD = 0.2;

export function pathLength(points: Pt[]): number {
  let t = 0;
  for (let i = 1; i < points.length; i++) {
    t += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return t;
}
