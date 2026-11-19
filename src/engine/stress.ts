/**
 * Diastolic exercise (stress) echocardiography.
 *
 * ASE 2025 (Section 13): measured during exercise or 1–2 min after stopping, once E and A separate.
 *   Positive (elevated filling pressure): average E/e' ≥14 or septal E/e' ≥15 AND peak TR >3.2 m/s.
 *   Normal: average (or septal) E/e' <10 and peak TR <2.8 m/s.
 *   HFpEF likely: E/e' >14 with TR >2.8 but <3.2 m/s.
 *   Not supported: E/e' <14, even if TR rises above 3.2 m/s.
 *
 * ASE/EACVI 2016 (referenced by EACVI 2022): positive when all three are met:
 *   average E/e' >14 (or septal >15) with exercise, peak TR >2.8 m/s, and septal e' <7 cm/s at rest.
 * HFA-PEFF (ESC HFA 2019) exercise step: average E/e' ≥15 = 2 points; plus TR >3.4 m/s = 3 points.
 */
import { derive, fmt, has } from './derive';
import type { Assessment, Finding, RestInputs, StressInputs, Status } from './types';

const st = (c: boolean): Status => (c ? 'abnormal' : 'normal');

function exerciseEe(s: StressInputs) {
  const d = derive(s);
  return { d, ee: d.EeAvg ?? d.EeSeptal, which: has(d.EeAvg) ? 'average' : has(d.EeSeptal) ? 'septal' : undefined };
}

function stressContext(s: StressInputs, rest: RestInputs): string[] {
  const out: string[] = [];
  const parts = [s.modality === 'bike' ? 'Supine bike' : s.modality === 'treadmill' ? 'Treadmill' : '', s.workload ? `workload ${s.workload}` : '', has(s.HR) ? `HR ${s.HR} bpm` : '', s.timing ? (s.timing === 'peak' ? 'peak exercise' : 'early recovery') : '']
    .filter(Boolean);
  if (parts.length) out.push(parts.join(', ') + '.');
  if (has(s.HR) && s.HR > 100) out.push('At higher heart rates E and A can fuse. Measure when E and A have separated (E at onset of A ideally <20 cm/s).');
  const rd = derive(rest);
  const sd = derive(s);
  if (has(rd.avgE) && has(sd.avgE)) {
    const delta = sd.avgE - rd.avgE;
    out.push(`Average e' changed by ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} cm/s from rest (normally rises about 3–5 cm/s with exercise).`);
  } else if (has(rest.septalE) && has(s.septalE)) {
    const delta = s.septalE - rest.septalE;
    out.push(`Septal e' changed by ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} cm/s from rest (normally rises about 3–5 cm/s).`);
  }
  if (s.modality === 'treadmill') out.push('Treadmill: record TR first, then mitral inflow and annular velocities once E and A separate.');
  return out;
}

export function hasStressData(s: StressInputs) {
  return [s.E, s.septalE, s.lateralE, s.averageE, s.EeAvg, s.EeSeptal, s.TR].some(has);
}

export function assessStressASE(s: StressInputs, rest: RestInputs): Assessment {
  const { ee, which } = exerciseEe(s);
  const tr = s.TR;
  const findings: Finding[] = [
    { label: "Exercise E/e'", value: has(ee) ? `${which} ${fmt(ee)}` : undefined, status: has(ee) ? st(which === 'septal' ? ee >= 15 : ee >= 14) : 'missing', rule: 'average ≥14 or septal ≥15' },
    { label: 'Exercise TR velocity', value: has(tr) ? fmt(tr, 'm/s') : undefined, status: has(tr) ? st(tr > 3.2) : 'missing', rule: '>3.2 m/s (2.8–3.2 intermediate)' },
  ];
  const needed: string[] = [];
  const steps: string[] = stressContext(s, rest);
  const cut = which === 'septal' ? 15 : 14;
  let lap: Assessment['lap'];
  let confidence: Assessment['confidence'] = 'definitive';
  let lean: Assessment['lean'];
  let headline: string;
  let leanReason: string | undefined;

  if (!has(ee) && !has(tr)) {
    return { id: 'ase_stress', title: 'ASE 2025 · exercise', headline: 'Not enough data yet', lap: 'insufficient', confidence: 'insufficient', findings, steps, needed: ["Exercise E and e' (E/e')", 'Exercise TR velocity'], caveats: [], reportSentence: '' };
  }
  if (!has(ee)) {
    needed.push("Exercise E/e' (E and septal or average e')");
    lap = 'indeterminate'; confidence = 'leaning';
    lean = tr! > 3.2 ? 'elevated' : tr! < 2.8 ? 'normal' : undefined;
    headline = 'Incomplete: E/e\' needed';
    leanReason = `TR ${tr} m/s alone cannot call the test. ASE does not support HFpEF without an exercise E/e' of at least ${cut}.`;
  } else if (ee < 10 && (!has(tr) || tr < 2.8)) {
    lap = 'normal';
    headline = 'Normal exercise filling pressure';
    if (!has(tr)) { confidence = 'leaning'; lean = 'normal'; needed.push('Exercise TR velocity (to confirm a normal test)'); headline = 'Likely normal (TR needed to confirm)'; }
  } else if (ee < cut) {
    lap = 'indeterminate';
    confidence = 'leaning';
    lean = 'normal';
    headline = `Not supportive of HFpEF (E/e' ${ee} below ${cut})`;
    leanReason = `Exercise ${which} E/e' ${ee} is under ${cut}. ASE says this does not support HFpEF${has(tr) && tr > 3.2 ? ', even with TR above 3.2 m/s' : ''}.${ee >= 10 ? ' It is above 10, so the test is not clearly normal either.' : ''}`;
    if (!has(tr)) needed.push('Exercise TR velocity');
  } else {
    // E/e' elevated
    if (!has(tr)) {
      lap = 'indeterminate'; confidence = 'leaning'; lean = 'elevated';
      headline = "E/e' elevated, TR needed";
      leanReason = `Exercise ${which} E/e' ${ee} meets the cutoff. ASE needs peak TR >3.2 m/s for a positive test.`;
      needed.push('Exercise TR velocity');
    } else if (tr > 3.2) {
      lap = 'elevated';
      headline = 'Positive diastolic stress test';
    } else if (tr > 2.8) {
      lap = 'elevated'; confidence = 'leaning'; lean = 'elevated';
      headline = 'HFpEF likely (TR 2.8–3.2 m/s)';
      leanReason = `E/e' ${ee} with TR ${tr} m/s: ASE considers HFpEF likely, short of a fully positive test.`;
    } else {
      lap = 'indeterminate'; confidence = 'leaning'; lean = 'elevated';
      headline = "Indeterminate: E/e' high, TR normal";
      leanReason = `E/e' ${ee} is elevated but TR ${tr} m/s is not. Check TR signal quality. A rest-to-exercise rise in E/e' still supports raised filling pressure.`;
    }
  }

  const sentence =
    headline.startsWith('Positive') ? `Exercise diastolic stress test positive for elevated LV filling pressure by ASE 2025 criteria (${which} E/e' ${ee}, peak TR ${tr} m/s).` :
    headline.startsWith('Normal') ? `Exercise diastolic stress test normal by ASE 2025 criteria (${which} E/e' ${ee}${has(tr) ? `, peak TR ${tr} m/s` : ''}).` :
    headline.startsWith('HFpEF likely') ? `Exercise diastolic stress test: ${which} E/e' ${ee} with peak TR ${tr} m/s, HFpEF likely by ASE 2025 criteria.` :
    `Exercise diastolic stress test indeterminate by ASE 2025 criteria${lean ? `, favoring ${lean === 'elevated' ? 'elevated' : 'normal'} filling pressure` : ''} (${[has(ee) ? `${which} E/e' ${ee}` : '', has(tr) ? `peak TR ${tr} m/s` : ''].filter(Boolean).join(', ')}).`;

  return { id: 'ase_stress', title: 'ASE 2025 · exercise', headline, lap, confidence, lean, leanReason, findings, steps, needed, caveats: [], reportSentence: sentence };
}

export function assessStressEACVI(s: StressInputs, rest: RestInputs): Assessment {
  const { ee, which } = exerciseEe(s);
  const tr = s.TR;
  const restSep = rest.septalE;
  const eeAbn = has(ee) ? (which === 'septal' ? ee > 15 : ee > 14) : undefined;
  const findings: Finding[] = [
    { label: "Exercise E/e'", value: has(ee) ? `${which} ${fmt(ee)}` : undefined, status: eeAbn === undefined ? 'missing' : st(eeAbn), rule: 'average >14 or septal >15' },
    { label: 'Exercise TR velocity', value: has(tr) ? fmt(tr, 'm/s') : undefined, status: has(tr) ? st(tr > 2.8) : 'missing', rule: '>2.8 m/s' },
    { label: "Resting septal e'", value: has(restSep) ? fmt(restSep, 'cm/s') : undefined, status: has(restSep) ? st(restSep < 7) : 'missing', rule: '<7 cm/s' },
  ];
  const steps = ['All three criteria must be met for a positive test (ASE/EACVI 2016, referenced by EACVI 2022).'];
  const needed: string[] = [];
  const avail = findings.filter((f) => f.status !== 'missing');
  findings.filter((f) => f.status === 'missing').forEach((f) => needed.push(f.label));

  let lap: Assessment['lap'];
  let confidence: Assessment['confidence'] = 'definitive';
  let lean: Assessment['lean'];
  let headline: string;
  if (avail.length === 0) {
    return { id: 'eacvi_stress', title: 'EACVI · exercise', headline: 'Not enough data yet', lap: 'insufficient', confidence: 'insufficient', findings, steps, needed, caveats: [], reportSentence: '' };
  }
  const [fEe, fTr, fRest] = findings.map((f) => f.status);
  if (fEe === 'normal' || fTr === 'normal') {
    lap = 'normal';
    headline = 'Negative diastolic stress test';
  } else if (fEe === 'abnormal' && fTr === 'abnormal') {
    if (fRest === 'abnormal') { lap = 'elevated'; headline = 'Positive diastolic stress test'; }
    else if (fRest === 'normal') {
      lap = 'indeterminate'; confidence = 'leaning'; lean = 'elevated';
      headline = "Exercise values abnormal, resting e' normal";
    } else {
      lap = 'indeterminate'; confidence = 'leaning'; lean = 'elevated';
      headline = "Leans positive (resting septal e' needed)";
    }
  } else {
    lap = 'indeterminate'; confidence = 'leaning';
    lean = fEe === 'abnormal' || fTr === 'abnormal' ? 'elevated' : undefined;
    headline = lean ? 'Incomplete, leans positive' : 'Incomplete';
  }

  // HFA-PEFF exercise points
  let peff: string | undefined;
  if (has(d0(s)) && which === 'average') {
    const e = d0(s)!;
    peff = e >= 15 ? (has(tr) && tr > 3.4 ? 'HFA-PEFF exercise step: 3 points (average E/e\' ≥15 and TR >3.4 m/s).' : 'HFA-PEFF exercise step: 2 points (average E/e\' ≥15).') : 'HFA-PEFF exercise step: 0 points (average E/e\' <15).';
  }
  const sentence =
    lap === 'elevated' ? `Exercise diastolic stress test positive by ASE/EACVI 2016 criteria (exercise ${which} E/e' ${ee}, peak TR ${tr} m/s, resting septal e' ${restSep} cm/s).` :
    lap === 'normal' ? `Exercise diastolic stress test negative by ASE/EACVI 2016 criteria.` :
    `Exercise diastolic stress test indeterminate by ASE/EACVI 2016 criteria.`;
  return { id: 'eacvi_stress', title: 'EACVI · exercise', headline, lap, confidence, lean, findings, steps, needed, caveats: peff ? [peff] : [], reportSentence: sentence };
}

const d0 = (s: StressInputs) => derive(s).EeAvg;
