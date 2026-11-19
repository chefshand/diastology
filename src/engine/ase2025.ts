/**
 * ASE 2025 algorithm (Nagueh SF et al. J Am Soc Echocardiogr 2025;38:537-569), sinus rhythm,
 * applied irrespective of LVEF (Figure 3).
 *
 * Primary variables
 *   1. Reduced e': septal ≤6, lateral ≤7 or average ≤6.5 cm/s
 *   2. Increased E/e': average ≥14 (septal ≥15 or lateral ≥13 when only one site)
 *   3. TR peak velocity ≥2.8 m/s or PASP ≥35 mmHg
 *
 * Logic
 *   all 3 abnormal                          -> elevated LAP
 *   all 3 normal                            -> normal diastolic function
 *   only e' reduced: E/A ≤0.8               -> grade 1, normal LAP
 *                    E/A >0.8               -> supplemental
 *   any other combination                   -> supplemental
 *   Supplemental (first tier): PV S/D ≤0.67, LARS ≤18%, LAVi >34 mL/m², IVRT ≤70 ms
 *     any one abnormal -> elevated LAP; all available normal -> normal LAP
 *   Second tier (if first tier unavailable): Ar–A >30 ms, L-wave ≥50 cm/s
 *   Elevated LAP is graded by E/A: <2 grade 2, ≥2 grade 3.
 */
import { derive, fmt, has } from './derive';
import type { Assessment, Finding, RestInputs, Status } from './types';
import { specialConditionNotes, excludesStandardAlgorithm } from './special';
import { assessAF } from './af';

type Bin = 'abnormal' | 'normal';
type Lap = 'normal' | 'elevated' | 'indeterminate';

const st = (cond: boolean | undefined): Status => (cond === undefined ? 'missing' : cond ? 'abnormal' : 'normal');

export function primaryStatuses(r: RestInputs) {
  const d = derive(r);
  // e'
  const eParts: string[] = [];
  let eStatus: Status = 'missing';
  if (has(r.septalE) || has(r.lateralE) || has(d.avgE)) {
    const reduced =
      (has(r.septalE) && r.septalE <= 6) ||
      (has(r.lateralE) && r.lateralE <= 7) ||
      (has(d.avgE) && d.avgE <= 6.5);
    eStatus = reduced ? 'abnormal' : 'normal';
    if (has(r.septalE)) eParts.push(`septal ${fmt(r.septalE)}`);
    if (has(r.lateralE)) eParts.push(`lateral ${fmt(r.lateralE)}`);
    if (has(d.avgE)) eParts.push(`avg ${fmt(d.avgE)}`);
  }
  // E/e'
  let eeStatus: Status = 'missing';
  let eeValue: string | undefined;
  let eeRule = 'average ≥14 (septal ≥15 or lateral ≥13 if only one site)';
  if (has(d.EeAvg)) {
    eeStatus = st(d.EeAvg >= 14);
    eeValue = `average ${fmt(d.EeAvg)}`;
  } else if (has(d.EeSeptal) || has(d.EeLateral)) {
    const abn = (has(d.EeSeptal) && d.EeSeptal >= 15) || (has(d.EeLateral) && d.EeLateral >= 13);
    eeStatus = abn ? 'abnormal' : 'normal';
    eeValue = [has(d.EeSeptal) ? `septal ${fmt(d.EeSeptal)}` : '', has(d.EeLateral) ? `lateral ${fmt(d.EeLateral)}` : '']
      .filter(Boolean)
      .join(', ');
    eeRule = 'septal ≥15 or lateral ≥13 (average not available)';
  }
  // TR / PASP
  let trStatus: Status = 'missing';
  const trParts: string[] = [];
  if (has(r.TR) || has(r.PASP)) {
    const abn = (has(r.TR) && r.TR >= 2.8) || (has(r.PASP) && r.PASP >= 35);
    trStatus = abn ? 'abnormal' : 'normal';
    if (has(r.TR)) trParts.push(`TR ${fmt(r.TR, 'm/s')}`);
    if (has(r.PASP)) trParts.push(`PASP ${fmt(r.PASP, 'mmHg')}`);
  }
  return {
    d,
    findings: [
      { label: "Mitral annular e'", value: eParts.length ? eParts.join(', ') + ' cm/s' : undefined, status: eStatus, rule: 'reduced if septal ≤6, lateral ≤7 or average ≤6.5 cm/s' },
      { label: "E/e'", value: eeValue, status: eeStatus, rule: eeRule },
      { label: 'TR velocity / PASP', value: trParts.join(', ') || undefined, status: trStatus, rule: 'TR ≥2.8 m/s or PASP ≥35 mmHg' },
    ] as Finding[],
  };
}

interface SuppResult {
  result: 'elevated' | 'normal' | 'unknown';
  findings: Finding[];
  notes: string[];
  used: string[];
}

export function supplementalASE(r: RestInputs): SuppResult {
  const notes: string[] = [];
  const findings: Finding[] = [];
  const normalEF = !has(r.lvef) || r.lvef >= 50;

  // First tier
  let pvCounted: Status = 'missing';
  if (has(r.PVSD)) {
    const abn = r.PVSD <= 0.67;
    if (abn && normalEF && !(has(r.IVRT) && r.IVRT <= 70)) {
      pvCounted = 'missing';
      notes.push('PV S/D ≤0.67 with normal (or unknown) LVEF is less reliable. ASE suggests confirming with a short IVRT (≤70 ms) before counting it.');
    } else pvCounted = abn ? 'abnormal' : 'normal';
    findings.push({ label: 'Pulmonary vein S/D', value: fmt(r.PVSD), status: abn ? 'abnormal' : 'normal', rule: '≤0.67 suggests elevated LAP' });
  }
  const tier1: { label: string; status: Status }[] = [
    { label: 'PV S/D', status: pvCounted },
    { label: 'LARS', status: has(r.LARS) ? st(r.LARS <= 18) : 'missing' },
    { label: 'LAVi', status: has(r.LAVi) ? st(r.LAVi > 34) : 'missing' },
    { label: 'IVRT', status: has(r.IVRT) ? st(r.IVRT <= 70) : 'missing' },
  ];
  if (has(r.LARS)) {
    findings.push({ label: 'LA reservoir strain', value: fmt(r.LARS, '%'), status: st(r.LARS <= 18), rule: '≤18% suggests elevated LAP (19–24% is low-normal)' });
    if (r.LARS > 18 && r.LARS < 25) notes.push('LARS 19–24% is low-normal and less reassuring than ≥25%.');
  }
  if (has(r.LAVi)) findings.push({ label: 'LA volume index', value: fmt(r.LAVi, 'mL/m²'), status: st(r.LAVi > 34), rule: '>34 mL/m² suggests elevated LAP (exclude AF history, athletes, MR, anemia)' });
  if (has(r.IVRT)) findings.push({ label: 'IVRT', value: fmt(r.IVRT, 'ms'), status: st(r.IVRT <= 70), rule: '≤70 ms suggests elevated LAP' });

  const t1avail = tier1.filter((t) => t.status !== 'missing');
  if (t1avail.some((t) => t.status === 'abnormal')) {
    return { result: 'elevated', findings, notes, used: t1avail.filter((t) => t.status === 'abnormal').map((t) => t.label) };
  }
  // Second tier
  const tier2: { label: string; status: Status }[] = [];
  if (has(r.ArA)) {
    tier2.push({ label: 'Ar–A', status: st(r.ArA > 30) });
    findings.push({ label: 'Ar–A duration', value: fmt(r.ArA, 'ms'), status: st(r.ArA > 30), rule: '>30 ms suggests elevated LVEDP' });
  }
  if (has(r.Lwave)) {
    tier2.push({ label: 'L-wave', status: st(r.Lwave >= 50) });
    findings.push({ label: 'Mitral L-wave', value: fmt(r.Lwave, 'cm/s'), status: st(r.Lwave >= 50), rule: '≥50 cm/s suggests elevated LAP' });
  }
  if (t1avail.length) {
    // Tier-1 all normal. A positive tier-2 sign is reported but tier 1 governs.
    if (tier2.some((t) => t.status === 'abnormal')) notes.push('A second-tier sign (Ar–A or L-wave) is abnormal although first-tier supplemental values are normal. Interpret with care.');
    if (t1avail.length === 1) notes.push(`The supplemental step rests on ${t1avail[0].label} alone. Another supplemental value (LARS, LAVi, PV S/D or IVRT) would make it firmer.`);
    return { result: 'normal', findings, notes, used: t1avail.map((t) => t.label) };
  }
  if (tier2.some((t) => t.status === 'abnormal')) return { result: 'elevated', findings, notes, used: tier2.filter((t) => t.status === 'abnormal').map((t) => t.label) };
  if (tier2.length) return { result: 'normal', findings, notes, used: tier2.map((t) => t.label) };
  return { result: 'unknown', findings, notes, used: [] };
}

function core(a: Bin, b: Bin, c: Bin, eaLow: boolean, supp: SuppResult['result']): { lap: Lap; viaSupp: boolean } {
  const n = [a, b, c].filter((x) => x === 'abnormal').length;
  if (n === 3) return { lap: 'elevated', viaSupp: false };
  if (n === 0) return { lap: 'normal', viaSupp: false };
  if (n === 1 && a === 'abnormal' && eaLow) return { lap: 'normal', viaSupp: false };
  return { lap: supp === 'unknown' ? 'indeterminate' : supp, viaSupp: true };
}

export function gradeFor(lap: Lap | 'normal' | 'elevated', eStatus: Status, EA?: number): string {
  if (lap === 'elevated') {
    if (!has(EA)) return 'Grade 2 or 3 (E/A needed to grade)';
    return EA >= 2 ? 'Grade 3' : 'Grade 2';
  }
  if (lap === 'normal') {
    if (eStatus === 'abnormal') return 'Grade 1';
    if (eStatus === 'normal') return 'Normal diastolic function';
    return "Normal LAP (normal vs grade 1 depends on e')";
  }
  return 'Indeterminate';
}

export function assessASE(r: RestInputs): Assessment {
  const title = 'ASE 2025';
  if (r.rhythm === 'af') return assessAF(r, 'ase');

  const special = specialConditionNotes(r);
  const { d, findings } = primaryStatuses(r);
  const [fe, fee, ftr] = findings;
  const steps: string[] = [];
  const caveats: string[] = [...special];
  const needed: string[] = [];
  const supp = supplementalASE(r);
  caveats.push(...supp.notes);

  if (excludesStandardAlgorithm(r)) {
    return {
      id: 'ase', title, lap: 'not_applicable', confidence: 'insufficient',
      headline: 'Standard algorithm not applicable',
      findings: [...findings, ...supp.findings], steps: ['A selected condition excludes the standard ASE 2025 algorithm. See the condition-specific notes.'],
      needed: [], caveats, reportSentence: 'Diastolic function: standard ASE 2025 algorithm not applicable given the clinical condition; see condition-specific criteria.',
    };
  }

  const primaries = [fe.status, fee.status, ftr.status];
  const known = primaries.filter((s) => s !== 'missing').length;
  if (known === 0) {
    return {
      id: 'ase', title, lap: 'insufficient', confidence: 'insufficient', headline: 'Not enough data yet',
      findings: [...findings, ...supp.findings], steps: [],
      needed: ["Septal and lateral e'", "E velocity (for E/e')", 'TR peak velocity or PASP', 'E/A ratio'],
      caveats, reportSentence: '',
    };
  }

  // Enumerate unknown primaries (and E/A ≤0.8 when unknown) to see whether the answer is already settled.
  const opts = (s: Status): Bin[] => (s === 'missing' ? ['abnormal', 'normal'] : [s]);
  const eaOpts: boolean[] = has(d.EA) ? [d.EA <= 0.8] : [true, false];
  const outcomes: { lap: Lap; viaSupp: boolean; a: Bin; b: Bin; c: Bin; eaLow: boolean }[] = [];
  for (const a of opts(fe.status)) for (const b of opts(fee.status)) for (const c of opts(ftr.status)) for (const eaLow of eaOpts) {
    outcomes.push({ ...core(a, b, c, eaLow, supp.result), a, b, c, eaLow });
  }
  const laps = new Set(outcomes.map((o) => o.lap));

  const nAbn = primaries.filter((s) => s === 'abnormal').length;
  steps.push(`Primary variables: ${nAbn} of ${known} available abnormal (e' ${fe.status}, E/e' ${fee.status}, TR/PASP ${ftr.status}).`);
  if (outcomes.some((o) => o.viaSupp)) {
    if (supp.result === 'unknown') steps.push('This pattern needs a supplemental parameter (LARS, LAVi, PV S/D or IVRT), and none was entered.');
    else steps.push(`Supplemental step: ${supp.result === 'elevated' ? 'abnormal' : 'normal'} (${supp.used.join(', ')}).`);
  }

  let lap: Lap;
  let confidence: Assessment['confidence'] = 'definitive';
  if (laps.size === 1) {
    lap = [...laps][0];
    if (lap === 'indeterminate') confidence = 'leaning';
    if (known < 3 && lap !== 'indeterminate') steps.push('The missing primary value(s) would not change this result.');
  } else {
    lap = 'indeterminate';
    confidence = 'leaning';
  }

  // What would settle it
  const missingPrim: [Status, string][] = [
    [fe.status, "Septal and lateral e'"],
    [fee.status, "E/e' (needs E and e')"],
    [ftr.status, 'TR peak velocity (or PASP)'],
  ];
  if (laps.size > 1) for (const [s, label] of missingPrim) if (s === 'missing') needed.push(label);
  if (!has(d.EA) && laps.size > 1 && outcomes.some((o) => o.a === 'abnormal' && o.b === 'normal' && o.c === 'normal')) needed.push('E/A ratio');
  if (supp.result === 'unknown' && outcomes.some((o) => o.viaSupp)) {
    needed.push('LA volume index', 'LA reservoir strain (if available)', 'Pulmonary vein S/D (if clear)', 'IVRT');
  }

  // Grade
  let grade: string;
  if (lap === 'indeterminate') grade = 'Indeterminate';
  else if (lap === 'normal' && fe.status === 'missing') {
    grade = "Normal LAP (normal vs grade 1 depends on e')";
  } else grade = gradeFor(lap, fe.status, d.EA);
  if (lap === 'elevated' && !has(d.EA)) needed.push('E/A ratio (grade 2 vs 3)');

  // Lean
  let lean: Assessment['lean'];
  let leanReason: string | undefined;
  if (lap === 'indeterminate') {
    const ev = evidence(r, d.EA, fee.status, ftr.status);
    const elevFrac = outcomes.filter((o) => o.lap === 'elevated').length / outcomes.length;
    const normFrac = outcomes.filter((o) => o.lap === 'normal').length / outcomes.length;
    const score = ev.score + (elevFrac - normFrac);
    if (score > 0.25) lean = 'elevated';
    else if (score < -0.25) lean = 'normal';
    leanReason = lean
      ? `Leans ${lean === 'elevated' ? 'toward elevated' : 'toward normal'} LAP: ${(lean === 'elevated' ? ev.forElevated : ev.forNormal).join(', ') || 'based on the possible outcomes'}${(lean === 'elevated' ? ev.forNormal : ev.forElevated).length ? `. Against: ${(lean === 'elevated' ? ev.forNormal : ev.forElevated).join(', ')}` : ''}.`
      : `Evidence is balanced. For elevated: ${ev.forElevated.join(', ') || 'none'}. For normal: ${ev.forNormal.join(', ') || 'none'}.`;
  }

  if (has(d.EA) && d.EA >= 2 && has(r.age) && r.age < 40 && fe.status === 'normal') {
    caveats.push('E/A ≥2 with normal e\' in a person under 40 can be a normal, vigorous-relaxation pattern.');
  }
  if (has(r.E) && has(r.A) && r.A > 0 && has(d.EA)) {
    /* no-op: E/A computed */
  }
  if (d.computed.has('EeAvg')) steps.push(`Average E/e' computed as ${fmt(d.EeAvg)} from E and average e'.`);

  const headline =
    lap === 'elevated' ? `${grade}, elevated LAP` :
    lap === 'normal' ? (grade.startsWith('Grade 1') ? 'Grade 1, normal LAP' : grade.startsWith('Normal diastolic') ? 'Normal diastolic function, normal LAP' : grade) :
    lean ? `Indeterminate, leans ${lean === 'elevated' ? 'elevated' : 'normal'} LAP` : 'Indeterminate';

  return {
    id: 'ase', title, headline, lap, grade, confidence, lean, leanReason,
    findings: [...findings, ...supp.findings], steps, needed: dedupe(needed), caveats,
    reportSentence: reportASE(lap, grade, lean, r, d),
  };
}

export function evidence(r: RestInputs, EA: number | undefined, ee: Status, tr: Status) {
  const forElevated: string[] = [];
  const forNormal: string[] = [];
  const d = derive(r);
  const add = (cond: Status, abnText: string, nlText: string) => {
    if (cond === 'abnormal') forElevated.push(abnText);
    else if (cond === 'normal') forNormal.push(nlText);
  };
  add(ee, `E/e' ${fmt(d.EeAvg ?? d.EeSeptal ?? d.EeLateral)}`, `E/e' ${fmt(d.EeAvg ?? d.EeSeptal ?? d.EeLateral)}`);
  add(tr, `TR/PASP high`, `TR/PASP normal`);
  if (has(r.LAVi)) add(st(r.LAVi > 34), `LAVi ${r.LAVi}`, `LAVi ${r.LAVi}`);
  if (has(r.LARS)) add(st(r.LARS <= 18), `LARS ${r.LARS}%`, `LARS ${r.LARS}%`);
  if (has(r.PVSD)) add(st(r.PVSD <= 0.67), `PV S/D ${r.PVSD}`, `PV S/D ${r.PVSD}`);
  if (has(r.ArA)) add(st(r.ArA > 30), `Ar–A ${r.ArA} ms`, `Ar–A ${r.ArA} ms`);
  if (has(r.IVRT)) add(st(r.IVRT <= 70), `IVRT ${r.IVRT} ms`, `IVRT ${r.IVRT} ms`);
  if (has(r.Lwave)) add(st(r.Lwave >= 50), `L-wave ${r.Lwave}`, `no L-wave`);
  if (has(EA)) {
    if (EA >= 2) forElevated.push(`E/A ${EA}`);
    else if (EA <= 0.8) forNormal.push(`E/A ${EA}`);
  }
  if (has(d.EeAvg) && d.EeAvg > 8 && d.EeAvg < 14) {
    // Gray zone: weakly informative
  } else if (has(d.EeAvg) && d.EeAvg <= 8) {
    // strongly normal; already counted as normal
  }
  return { forElevated, forNormal, score: forElevated.length - forNormal.length > 0 ? 1 : forElevated.length - forNormal.length < 0 ? -1 : 0 };
}

const dedupe = (a: string[]) => [...new Set(a)];

function keyValues(r: RestInputs, d: ReturnType<typeof derive>): string {
  const parts: string[] = [];
  if (has(r.E)) parts.push(`E ${Math.round(r.E)} cm/s`);
  if (has(d.EA)) parts.push(`E/A ${d.EA}`);
  if (has(r.septalE)) parts.push(`septal e' ${r.septalE} cm/s`);
  if (has(r.lateralE)) parts.push(`lateral e' ${r.lateralE} cm/s`);
  if (has(d.EeAvg)) parts.push(`average E/e' ${d.EeAvg}`);
  else if (has(d.EeSeptal)) parts.push(`septal E/e' ${d.EeSeptal}`);
  if (has(r.TR)) parts.push(`TR ${r.TR} m/s`);
  if (has(r.PASP)) parts.push(`PASP ${r.PASP} mmHg`);
  if (has(r.LAVi)) parts.push(`LAVi ${r.LAVi} mL/m²`);
  if (has(r.LARS)) parts.push(`LARS ${r.LARS}%`);
  if (has(r.PVSD)) parts.push(`PV S/D ${r.PVSD}`);
  return parts.join(', ');
}
export { keyValues };

function reportASE(lap: Lap, grade: string, lean: Assessment['lean'], r: RestInputs, d: ReturnType<typeof derive>): string {
  const kv = keyValues(r, d);
  const tail = kv ? ` (${kv}).` : '.';
  if (lap === 'elevated') {
    const g = grade.startsWith('Grade 3') ? 'Grade 3 diastolic dysfunction' : grade.startsWith('Grade 2 or 3') ? 'Diastolic dysfunction (grade 2 or 3)' : 'Grade 2 diastolic dysfunction';
    return `${g} with elevated left atrial pressure by ASE 2025 criteria${tail}`;
  }
  if (lap === 'normal') {
    if (grade.startsWith('Grade 1')) return `Grade 1 diastolic dysfunction (impaired relaxation) with normal left atrial pressure by ASE 2025 criteria${tail}`;
    if (grade.startsWith('Normal diastolic')) return `Normal diastolic function with normal left atrial pressure by ASE 2025 criteria${tail}`;
    return `Normal left atrial pressure by ASE 2025 criteria${tail}`;
  }
  const l = lean === 'elevated' ? ', favoring elevated left atrial pressure' : lean === 'normal' ? ', favoring normal left atrial pressure' : '';
  return `Diastolic function indeterminate by ASE 2025 criteria${l}${tail}`;
}
