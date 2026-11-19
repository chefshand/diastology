/**
 * Age context. ASE 2025 Table 6 (age-specific cutoffs for reduced e', cm/s) and Table 5
 * (5th–95th percentile normal ranges). The app applies the standard guideline cutoffs and uses
 * these only for an interpretive comment.
 */
import { derive, has } from './derive';
import type { RestInputs } from './types';

const AGE_E_CUTOFFS = [
  { band: '20–39', min: 20, max: 39, septal: 7, lateral: 10, average: 9 },
  { band: '40–65', min: 40, max: 65, septal: 6, lateral: 8, average: 7 },
  { band: '>65', min: 66, max: 200, septal: 6, lateral: 7, average: 6.5 },
];

const EA_RANGES = [
  { band: '20–39', min: 20, max: 39, lo: 0.88, hi: 2.73 },
  { band: '40–60', min: 40, max: 60, lo: 0.69, hi: 2.07 },
  { band: '60–80', min: 61, max: 200, lo: 0.5, hi: 1.4 },
];

export function ageComment(r: RestInputs): string[] {
  if (!has(r.age)) return [];
  const age = r.age;
  const out: string[] = [];
  const d = derive(r);
  const band = AGE_E_CUTOFFS.find((b) => age >= b.min && age <= b.max);
  if (band && (has(r.septalE) || has(r.lateralE) || has(d.avgE))) {
    const stdReduced =
      (has(r.septalE) && r.septalE <= 6) || (has(r.lateralE) && r.lateralE <= 7) || (has(d.avgE) && d.avgE <= 6.5);
    const ageReduced =
      (has(r.septalE) && r.septalE < band.septal) || (has(r.lateralE) && r.lateralE < band.lateral) || (has(d.avgE) && d.avgE < band.average);
    const vals = [has(r.septalE) ? `septal ${r.septalE}` : '', has(r.lateralE) ? `lateral ${r.lateralE}` : '', has(d.avgE) ? `average ${d.avgE}` : ''].filter(Boolean).join(', ');
    const cut = `age ${band.band}: reduced if septal <${band.septal}, lateral <${band.lateral}, average <${band.average} cm/s`;
    if (stdReduced === ageReduced) {
      out.push(`Age-adjusted e' (ASE 2025 Table 6, ${cut}) agrees with the standard cutoffs: e' (${vals}) is ${ageReduced ? 'reduced' : 'normal'} for age ${age}.`);
    } else if (ageReduced) {
      out.push(`Age-adjusted e' (ASE 2025 Table 6, ${cut}): e' (${vals}) is normal by the standard cutoffs but reduced for age ${age}. Relaxation may be impaired for age, so a borderline result deserves extra weight toward dysfunction.`);
    } else {
      out.push(`Age-adjusted e' (ASE 2025 Table 6, ${cut}): e' (${vals}) is reduced by the standard cutoffs but within the expected range for age ${age}. Some of the reduction may reflect normal aging.`);
    }
  }
  const eaBand = EA_RANGES.find((b) => age >= b.min && age <= b.max);
  if (eaBand && has(d.EA)) {
    if (d.EA < eaBand.lo || d.EA > eaBand.hi) out.push(`E/A ${d.EA} is outside the 5th–95th percentile for age ${eaBand.band} (${eaBand.lo}–${eaBand.hi}).`);
  }
  if (age > 65 && has(d.EeAvg) && d.EeAvg > 8 && d.EeAvg < 14) {
    out.push(`Average E/e' ${d.EeAvg} is in the gray zone (8–14). The normal upper range rises with age (about 14 at 60–80 years).`);
  }
  return out;
}
