import type { RestInputs, StressInputs } from './types';

export const has = (v: number | undefined | null): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export interface Derived {
  EA?: number;
  avgE?: number; // average e'
  EeAvg?: number;
  EeSeptal?: number;
  EeLateral?: number;
  computed: Set<string>; // which of the above were computed (not typed)
}

/** Fill in ratios that can be computed from the raw values. Typed values always win. */
export function derive(i: {
  E?: number; A?: number; EA?: number;
  septalE?: number; lateralE?: number; averageE?: number;
  EeAvg?: number; EeSeptal?: number; EeLateral?: number;
}): Derived {
  const computed = new Set<string>();
  const d: Derived = { computed };

  if (has(i.EA)) d.EA = i.EA;
  else if (has(i.E) && has(i.A) && i.A > 0) {
    d.EA = round(i.E / i.A, 2);
    computed.add('EA');
  }

  if (has(i.averageE)) d.avgE = i.averageE;
  else if (has(i.septalE) && has(i.lateralE)) {
    d.avgE = round((i.septalE + i.lateralE) / 2, 1);
    computed.add('avgE');
  }

  if (has(i.EeAvg)) d.EeAvg = i.EeAvg;
  else if (has(i.E) && has(d.avgE) && d.avgE > 0) {
    d.EeAvg = round(i.E / d.avgE, 1);
    computed.add('EeAvg');
  }

  if (has(i.EeSeptal)) d.EeSeptal = i.EeSeptal;
  else if (has(i.E) && has(i.septalE) && i.septalE > 0) {
    d.EeSeptal = round(i.E / i.septalE, 1);
    computed.add('EeSeptal');
  }

  if (has(i.EeLateral)) d.EeLateral = i.EeLateral;
  else if (has(i.E) && has(i.lateralE) && i.lateralE > 0) {
    d.EeLateral = round(i.E / i.lateralE, 1);
    computed.add('EeLateral');
  }
  return d;
}

export const deriveRest = (r: RestInputs) => derive(r);
export const deriveStress = (s: StressInputs) => derive(s);

export const fmt = (v: number | undefined, unit = '', dp?: number) => {
  if (!has(v)) return '—';
  const s = dp === undefined ? String(round(v, 2)) : v.toFixed(dp);
  return unit ? `${s} ${unit}` : s;
};
