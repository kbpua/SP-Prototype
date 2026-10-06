/** Smallest number of paired decisions for which kappa is reported. */
export const KAPPA_MIN_N = 5;

/**
 * Percent agreement and Cohen's kappa for two raters over nominal categories.
 * kappa is null (not estimable) when n is too small or expected agreement is 1.
 */
export function cohenKappa(pairs: [string, string][]): { n: number; percent: number | null; kappa: number | null } {
  const n = pairs.length;
  if (n === 0) return { n, percent: null, kappa: null };
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const cats = new Set(pairs.flat());
  let pe = 0;
  for (const c of cats) {
    const pa = pairs.filter(([a]) => a === c).length / n;
    const pb = pairs.filter(([, b]) => b === c).length / n;
    pe += pa * pb;
  }
  const kappa = n < KAPPA_MIN_N || pe >= 1 ? null : (po - pe) / (1 - pe);
  return { n, percent: po * 100, kappa };
}
