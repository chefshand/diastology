/**
 * EACVI pathway: the 2016 ASE/EACVI algorithm (Nagueh SF et al. Eur Heart J Cardiovasc Imaging
 * 2016;17:1321-1360) as refined by the 2022 EACVI HFpEF consensus (Smiseth OA et al. Eur Heart J
 * Cardiovasc Imaging 2022;23:e34-e61), which adds LA reservoir strain <18% as a replacement for a
 * missing criterion when the other two disagree. The EACVI 2022 document is still the current
 * EACVI statement (compared with ASE 2025 by Grapsa, Argulian, Smiseth, EHJ-CVI 2025;26:1725).
 *
 * Step A (normal LVEF without known myocardial disease): is there diastolic dysfunction?
 *   average E/e' >14; septal e' <7 or lateral e' <10; TR >2.8 m/s; LAVi >34 mL/m²
 *   >50% positive = dysfunction, <50% = normal, 50% = indeterminate.
 * Step B (reduced LVEF, myocardial disease, or dysfunction in step A): LV filling pressure
 *   E/A ≤0.8 and E ≤50 cm/s -> normal LAP (grade I)
 *   E/A ≥2 -> elevated LAP (grade III)
 *   otherwise: average E/e' >14, TR >2.8 m/s (or PASP >35), LAVi >34
 *     3 available: ≥2 positive elevated (grade II), ≤1 normal (grade I)
 *     2 available: both positive elevated, both negative normal, split -> LARS <18% decides
 *   Supportive: PV S/D <1 (reduced EF), Ar–A ≥30 ms.
 */
import { derive, fmt, has } from './derive';
import type { Assessment, Finding, RestInputs, Status } from './types';
import { assessAF } from './af';
import { excludesStandardAlgorithm, specialConditionNotes } from './special';
import { keyValues } from './ase2025';

const st = (c: boolean): Status => (c ? 'abnormal' : 'normal');

export function assessEACVI(r: RestInputs): Assessment {
  const title = 'EACVI 2022 (ASE/EACVI 2016 algorithm)';
  if (r.rhythm === 'af') return { ...assessAF(r, 'eacvi'), title };

  const d = derive(r);
  const steps: string[] = [];
  const caveats: string[] = specialConditionNotes(r);
  const needed: string[] = [];
  const findings: Finding[] = [];

  if (excludesStandardAlgorithm(r)) {
    return {
      id: 'eacvi', title, lap: 'not_applicable', confidence: 'insufficient', headline: 'Standard algorithm not applicable',
      findings, steps: ['A selected condition needs a condition-specific approach.'], needed, caveats,
      reportSentence: 'Diastolic function: standard EACVI algorithm not applicable given the clinical condition.',
    };
  }

  // Shared criteria
  const eeS: Status = has(d.EeAvg) ? st(d.EeAvg > 14)
    : has(d.EeSeptal) || has(d.EeLateral) ? st((has(d.EeSeptal) && d.EeSeptal > 15) || (has(d.EeLateral) && d.EeLateral > 13))
    : 'missing';
  const trS: Status = has(r.TR) || has(r.PASP) ? st((has(r.TR) && r.TR > 2.8) || (has(r.PASP) && r.PASP > 35)) : 'missing';
  const laS: Status = has(r.LAVi) ? st(r.LAVi > 34) : 'missing';
  const eS: Status = has(r.septalE) || has(r.lateralE) ? st((has(r.septalE) && r.septalE < 7) || (has(r.lateralE) && r.lateralE < 10)) : 'missing';

  const eeVal = has(d.EeAvg) ? `average ${fmt(d.EeAvg)}` : [has(d.EeSeptal) ? `septal ${fmt(d.EeSeptal)}` : '', has(d.EeLateral) ? `lateral ${fmt(d.EeLateral)}` : ''].filter(Boolean).join(', ') || undefined;
  const fEe: Finding = { label: "E/e'", value: eeVal, status: eeS, rule: has(d.EeAvg) || eeS === 'missing' ? 'average >14' : 'septal >15 or lateral >13' };
  const fTr: Finding = { label: 'TR velocity / PASP', value: [has(r.TR) ? `TR ${fmt(r.TR, 'm/s')}` : '', has(r.PASP) ? `PASP ${fmt(r.PASP, 'mmHg')}` : ''].filter(Boolean).join(', ') || undefined, status: trS, rule: 'TR >2.8 m/s (PASP >35 mmHg)' };
  const fLa: Finding = { label: 'LA volume index', value: has(r.LAVi) ? fmt(r.LAVi, 'mL/m²') : undefined, status: laS, rule: '>34 mL/m²' };
  const fE: Finding = { label: "e' (dysfunction step)", value: [has(r.septalE) ? `septal ${fmt(r.septalE)}` : '', has(r.lateralE) ? `lateral ${fmt(r.lateralE)}` : ''].filter(Boolean).join(', ') || undefined, status: eS, rule: 'septal <7 or lateral <10 cm/s' };

  // Step A
  const normalEF = !has(r.lvef) || r.lvef >= 50;
  let goToB = true;
  let stepAResult: 'normal' | 'dd' | 'indeterminate' | undefined;
  if (normalEF && !r.myocardialDisease) {
    findings.push(fE);
    const crit = [eeS, eS, trS, laS];
    const avail = crit.filter((c) => c !== 'missing');
    const pos = avail.filter((c) => c === 'abnormal').length;
    if (!has(r.lvef)) caveats.push('LVEF not entered. The normal-EF pathway was assumed.');
    if (avail.length === 0) {
      return { id: 'eacvi', title, lap: 'insufficient', confidence: 'insufficient', headline: 'Not enough data yet', findings: [fE, fEe, fTr, fLa], steps, needed: ["E/e'", "Septal and lateral e'", 'TR velocity', 'LAVi'], caveats, reportSentence: '' };
    }
    if (pos > avail.length / 2) stepAResult = 'dd';
    else if (pos < avail.length / 2) stepAResult = 'normal';
    else stepAResult = 'indeterminate';
    steps.push(`Normal LVEF, no known myocardial disease: ${pos} of ${avail.length} dysfunction criteria positive (${stepAResult === 'dd' ? 'diastolic dysfunction' : stepAResult === 'normal' ? 'normal diastolic function' : 'indeterminate'}).`);
    if (avail.length < 4) {
      const missing = (['E/e\'', "e'", 'TR velocity', 'LAVi'] as const).filter((_, i) => crit[i] === 'missing');
      // Could a missing value flip it?
      const best = pos + missing.length;
      const n = 4;
      const worstRes = pos > n / 2 ? 'dd' : pos < n / 2 ? 'normal' : 'ind';
      const bestRes = best > n / 2 ? 'dd' : best < n / 2 ? 'normal' : 'ind';
      if (worstRes !== bestRes) needed.push(...missing.map((m) => `${m} (dysfunction step)`));
    }
    if (stepAResult === 'normal') {
      goToB = false;
    }
  }

  if (!goToB) {
    return {
      id: 'eacvi', title, lap: 'normal', grade: 'Normal diastolic function', confidence: needed.length ? 'leaning' : 'definitive',
      lean: needed.length ? 'normal' : undefined, leanReason: needed.length ? 'Fewer than half of the available criteria are positive, but missing values could change this.' : undefined,
      headline: 'Normal diastolic function', findings: [fE, fEe, fTr, fLa], steps, needed, caveats,
      reportSentence: `Normal diastolic function by EACVI (ASE/EACVI 2016) criteria${kvTail(r, d)}`,
    };
  }
  if (!normalEF || r.myocardialDisease) steps.push(!normalEF ? `LVEF ${r.lvef}%: go straight to the filling-pressure algorithm.` : 'Known myocardial disease: go straight to the filling-pressure algorithm.');

  // Step B
  const EA = d.EA;
  const fEA: Finding = { label: 'Mitral E/A and E', value: [has(EA) ? `E/A ${fmt(EA)}` : '', has(r.E) ? `E ${fmt(r.E, 'cm/s')}` : ''].filter(Boolean).join(', ') || undefined, status: !has(EA) ? 'missing' : EA >= 2 ? 'abnormal' : 'normal', rule: 'E/A ≤0.8 with E ≤50 cm/s → normal LAP; E/A ≥2 → elevated' };
  findings.push(fEA, fEe, fTr, fLa);
  if (has(r.LARS)) findings.push({ label: 'LA reservoir strain', value: fmt(r.LARS, '%'), status: st(r.LARS < 18), rule: '<18% replaces a missing criterion when the other two disagree' });
  if (has(r.PVSD)) findings.push({ label: 'Pulmonary vein S/D', value: fmt(r.PVSD), status: st(r.PVSD < 1), rule: '<1 supports elevated LAP (reduced EF)' });
  if (has(r.ArA)) findings.push({ label: 'Ar–A duration', value: fmt(r.ArA, 'ms'), status: st(r.ArA >= 30), rule: '≥30 ms supports elevated LVEDP' });

  const ddGrade = (g: string) => (stepAResult === 'indeterminate' ? `${g} (dysfunction step indeterminate)` : g);

  if (has(EA) && EA <= 0.8 && has(r.E) && r.E <= 50) {
    steps.push(`E/A ${fmt(EA)} ≤0.8 with E ${r.E} cm/s ≤50: normal LAP.`);
    return done('normal', ddGrade('Grade I'), 'definitive');
  }
  if (has(EA) && EA >= 2) {
    const young = has(r.age) && r.age < 40 && eS === 'normal';
    if (young) {
      steps.push(`E/A ${fmt(EA)} ≥2 but age ${r.age} with normal e': may be a normal young pattern.`);
      caveats.push("In younger people E/A ≥2 can be normal unless e' is reduced.");
      return done('normal', 'Likely normal (young, normal e\')', 'leaning', 'normal');
    }
    steps.push(`E/A ${fmt(EA)} ≥2: elevated LAP.`);
    return done('elevated', 'Grade III', 'definitive');
  }
  if (!has(EA)) {
    needed.push('E/A ratio (and E velocity)');
    steps.push('E/A not available: going to the three criteria. The grade may change once E/A is known.');
  } else steps.push(`E/A ${fmt(EA)}${has(r.E) ? `, E ${r.E} cm/s` : ''}: intermediate pattern, so the three criteria decide.`);

  let crit: { name: string; s: Status }[] = [
    { name: "E/e'", s: eeS },
    { name: 'TR velocity', s: trS },
    { name: 'LAVi', s: laS },
  ];
  let usedLars = false;
  const missing = crit.filter((c) => c.s === 'missing');
  if (missing.length === 1 && has(r.LARS)) {
    const others = crit.filter((c) => c.s !== 'missing');
    if (others[0].s !== others[1].s) {
      crit = [...others, { name: 'LARS', s: st(r.LARS < 18) }];
      usedLars = true;
      steps.push(`${missing[0].name} missing and the other two disagree: LARS ${r.LARS}% used in its place.`);
    }
  }
  const avail = crit.filter((c) => c.s !== 'missing');
  const pos = avail.filter((c) => c.s === 'abnormal').length;
  steps.push(`${pos} of ${avail.length} criteria positive (${avail.map((c) => `${c.name} ${c.s}`).join(', ')}).`);

  const supportive: string[] = [];
  const against: string[] = [];
  if (has(r.PVSD)) (r.PVSD < 1 ? supportive : against).push(`PV S/D ${r.PVSD}`);
  if (has(r.ArA)) (r.ArA >= 30 ? supportive : against).push(`Ar–A ${r.ArA} ms`);
  if (has(r.LARS) && !usedLars) (r.LARS < 18 ? supportive : against).push(`LARS ${r.LARS}%`);
  if (eS === 'abnormal') supportive.push("reduced e'");

  if (avail.length === 3) {
    return pos >= 2 ? done('elevated', 'Grade II', 'definitive') : done('normal', ddGrade('Grade I'), 'definitive');
  }
  if (avail.length === 2) {
    if (pos === 2) return done('elevated', 'Grade II', 'definitive');
    if (pos === 0) return done('normal', ddGrade('Grade I'), 'definitive');
    needed.push(...missing.map((m) => m.name), ...(has(r.LARS) ? [] : ['LA reservoir strain (tie-breaker)']));
    const lean = supportive.length > against.length ? 'elevated' : against.length > supportive.length ? 'normal' : undefined;
    return done('indeterminate', 'Indeterminate', 'leaning', lean,
      `One criterion positive and one negative. ${supportive.length ? `Supporting elevated: ${supportive.join(', ')}.` : ''} ${against.length ? `Supporting normal: ${against.join(', ')}.` : ''}`.trim());
  }
  needed.push(...missing.map((m) => m.name));
  const lean = pos + supportive.length > (avail.length - pos) + against.length ? 'elevated' : pos + supportive.length < (avail.length - pos) + against.length ? 'normal' : undefined;
  return done('insufficient', 'Insufficient', avail.length ? 'leaning' : 'insufficient', avail.length ? lean : undefined,
    avail.length ? `Only ${avail.length} of 3 criteria available.` : undefined);

  function done(lap: Assessment['lap'], grade: string, confidence: Assessment['confidence'], lean?: Assessment['lean'], leanReason?: string): Assessment {
    const headline =
      lap === 'elevated' ? `${grade}, elevated LAP` :
      lap === 'normal' ? `${grade}, normal LAP` :
      lap === 'insufficient' ? (lean ? `Incomplete, leans ${lean} LAP` : 'Not enough data yet') :
      lean ? `Indeterminate, leans ${lean} LAP` : 'Indeterminate';
    const g = grade.replace(/ \(.*\)$/, '');
    const sentence =
      lap === 'elevated' ? `Grade ${g.replace('Grade ', '')} diastolic dysfunction with elevated LV filling pressure by EACVI (ASE/EACVI 2016) criteria${kvTail(r, d)}` :
      lap === 'normal' ? (g === 'Grade I' ? `Grade I diastolic dysfunction with normal LV filling pressure by EACVI (ASE/EACVI 2016) criteria${kvTail(r, d)}` : `Normal LV filling pressure by EACVI criteria${kvTail(r, d)}`) :
      lap === 'indeterminate' ? `LV filling pressure indeterminate by EACVI criteria${lean ? `, favoring ${lean}` : ''}${kvTail(r, d)}` : '';
    return { id: 'eacvi', title, headline, lap, grade, confidence, lean, leanReason, findings, steps, needed: [...new Set(needed)], caveats, reportSentence: sentence };
  }
}

function kvTail(r: RestInputs, d: ReturnType<typeof derive>) {
  const kv = keyValues(r, d);
  return kv ? ` (${kv}).` : '.';
}
