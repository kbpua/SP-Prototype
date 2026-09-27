export type EffectMeasure = "RR" | "OR" | "HR" | "MD";

export interface StudyInput {
  id: string;
  label: string;
  year: number;
  nT: number;
  eT: number;
  nC: number;
  eC: number;
  hr?: { est: number; lo: number; hi: number };
}

export interface StudyEffect {
  id: string;
  label: string;
  year: number;
  yi: number;
  vi: number;
  est: number;
  lo: number;
  hi: number;
  weight: number;
}

export interface PooledResult {
  studies: StudyEffect[];
  est: number;
  lo: number;
  hi: number;
  z: number;
  p: number;
  q: number;
  df: number;
  pQ: number;
  i2: number;
  tau2: number;
}

const Z = 1.959964;

function effectFor(measure: EffectMeasure, s: StudyInput): { yi: number; vi: number } | null {
  if (measure === "HR") {
    if (!s.hr || s.hr.lo <= 0 || s.hr.hi <= 0 || s.hr.est <= 0) return null;
    const se = (Math.log(s.hr.hi) - Math.log(s.hr.lo)) / (2 * Z);
    return { yi: Math.log(s.hr.est), vi: se * se };
  }
  let { eT, nT, eC, nC } = s;
  if (![eT, nT, eC, nC].every((v) => Number.isFinite(v) && v >= 0) || nT === 0 || nC === 0) return null;
  // Haldane continuity correction for zero cells.
  if (eT === 0 || eC === 0 || eT === nT || eC === nC) {
    eT += 0.5;
    eC += 0.5;
    nT += 1;
    nC += 1;
  }
  if (measure === "RR") {
    return {
      yi: Math.log(eT / nT / (eC / nC)),
      vi: 1 / eT - 1 / nT + 1 / eC - 1 / nC,
    };
  }
  const a = eT, b = nT - eT, c = eC, d = nC - eC;
  return { yi: Math.log((a * d) / (b * c)), vi: 1 / a + 1 / b + 1 / c + 1 / d };
}

export function dersimonianLaird(measure: EffectMeasure, inputs: StudyInput[]): PooledResult | null {
  const rows = inputs
    .map((s) => ({ s, e: effectFor(measure, s) }))
    .filter((r): r is { s: StudyInput; e: { yi: number; vi: number } } => r.e !== null);
  if (rows.length === 0) return null;

  const w = rows.map((r) => 1 / r.e.vi);
  const sw = w.reduce((a, b) => a + b, 0);
  const fixed = rows.reduce((acc, r, i) => acc + w[i] * r.e.yi, 0) / sw;
  const q = rows.reduce((acc, r, i) => acc + w[i] * (r.e.yi - fixed) ** 2, 0);
  const df = rows.length - 1;
  const c = sw - w.reduce((a, b) => a + b * b, 0) / sw;
  const tau2 = df > 0 && c > 0 ? Math.max(0, (q - df) / c) : 0;

  const wr = rows.map((r) => 1 / (r.e.vi + tau2));
  const swr = wr.reduce((a, b) => a + b, 0);
  const pooled = rows.reduce((acc, r, i) => acc + wr[i] * r.e.yi, 0) / swr;
  const se = Math.sqrt(1 / swr);
  const z = pooled / se;

  return {
    studies: rows.map((r, i) => {
      const s = Math.sqrt(r.e.vi);
      return {
        id: r.s.id,
        label: r.s.label,
        year: r.s.year,
        yi: r.e.yi,
        vi: r.e.vi,
        est: Math.exp(r.e.yi),
        lo: Math.exp(r.e.yi - Z * s),
        hi: Math.exp(r.e.yi + Z * s),
        weight: (wr[i] / swr) * 100,
      };
    }),
    est: Math.exp(pooled),
    lo: Math.exp(pooled - Z * se),
    hi: Math.exp(pooled + Z * se),
    z,
    p: 2 * (1 - normalCdf(Math.abs(z))),
    q,
    df,
    pQ: df > 0 ? chiSquareSf(q, df) : 1,
    i2: q > 0 && df > 0 ? Math.max(0, ((q - df) / q) * 100) : 0,
    tau2,
  };
}

export function parseRatioWithCi(text: string): { est: number; lo: number; hi: number } | undefined {
  const nums = text.match(/\d+(\.\d+)?/g)?.map(Number);
  if (!nums || nums.length < 3) return undefined;
  return { est: nums[0], lo: nums[1], hi: nums[2] };
}

export function formatP(p: number) {
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

function normalCdf(x: number) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Upper regularised incomplete gamma Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    let ap = a;
    for (let n = 0; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function chiSquareSf(x: number, df: number) {
  return gammaQ(df / 2, x / 2);
}
