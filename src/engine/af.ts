/**
 * Atrial fibrillation (ASE 2025 Table 7; average measurements over several beats).
 * The standard algorithm is not applicable and no grade is assigned. Signs of elevated LAP:
 *   septal E/e' ≥11, TR >2.8 m/s, IVRT ≤65 ms, DT <160 ms (with depressed LVEF).
 * The 2016 ASE/EACVI document (followed by EACVI) lists the same core variables.
 * Neither document gives a strict counting rule, so this reports how many signs are present
 * and leans with the majority.
 */
import { derive, fmt, has } from './derive';
import type { Assessment, Finding, RestInputs, Status } from './types';

const st = (c: boolean): Status => (c ? 'abnormal' : 'normal');

export function assessAF(r: RestInputs, id: 'ase' | 'eacvi'): Assessment {
  const d = derive(r);
  const title = id === 'ase' ? 'ASE 2025' : 'EACVI';
  const findings: Finding[] = [];
  const reducedEF = has(r.lvef) && r.lvef < 50;

  if (has(d.EeSeptal)) findings.push({ label: "Septal E/e'", value: fmt(d.EeSeptal), status: st(d.EeSeptal >= 11), rule: '≥11 suggests elevated LAP' });
  else findings.push({ label: "Septal E/e'", status: 'missing', rule: '≥11 suggests elevated LAP' });
  if (has(r.TR)) findings.push({ label: 'TR velocity', value: fmt(r.TR, 'm/s'), status: st(r.TR > 2.8), rule: '>2.8 m/s suggests elevated LAP' });
  else findings.push({ label: 'TR velocity', status: 'missing', rule: '>2.8 m/s suggests elevated LAP' });
  if (has(r.IVRT)) findings.push({ label: 'IVRT', value: fmt(r.IVRT, 'ms'), status: st(r.IVRT <= 65), rule: '≤65 ms suggests elevated LAP' });
  if (has(r.DT)) {
    if (reducedEF) findings.push({ label: 'Mitral DT', value: fmt(r.DT, 'ms'), status: st(r.DT < 160), rule: '<160 ms suggests elevated LAP (reduced LVEF)' });
    else findings.push({ label: 'Mitral DT', value: fmt(r.DT, 'ms'), status: 'missing', rule: 'Only applies with reduced LVEF' });
  }

  const avail = findings.filter((f) => f.status !== 'missing');
  const abn = avail.filter((f) => f.status === 'abnormal').length;
  const nl = avail.length - abn;
  const needed: string[] = [];
  if (!has(d.EeSeptal)) needed.push("Septal E/e' (average of several beats)");
  if (!has(r.TR)) needed.push('TR peak velocity');
  if (!has(r.IVRT)) needed.push('IVRT');
  if (!has(r.DT) && reducedEF) needed.push('Mitral deceleration time');

  let lap: Assessment['lap'] = 'indeterminate';
  let confidence: Assessment['confidence'] = 'leaning';
  let lean: Assessment['lean'];
  if (avail.length === 0) {
    lap = 'insufficient';
    confidence = 'insufficient';
  } else if (avail.length >= 2 && abn === avail.length) {
    lap = 'elevated';
    confidence = 'definitive';
  } else if (avail.length >= 2 && nl === avail.length) {
    lap = 'normal';
    confidence = 'definitive';
  } else if (abn > nl) lean = 'elevated';
  else if (nl > abn) lean = 'normal';

  const headline =
    lap === 'insufficient' ? 'Not enough data (AF)' :
    lap === 'elevated' ? 'AF: elevated LAP likely' :
    lap === 'normal' ? 'AF: normal LAP likely' :
    lean ? `AF: indeterminate, leans ${lean} LAP` : 'AF: indeterminate';

  return {
    id, title, headline, lap, confidence, lean,
    leanReason: `${abn} of ${avail.length} available AF signs suggest elevated LAP.`,
    findings,
    steps: ['Atrial fibrillation: the sinus-rhythm algorithm and grading do not apply. Signs from the AF criteria are counted together.'],
    needed,
    caveats: ['Average measurements over at least 5 beats (or use index beats with similar preceding and pre-preceding RR). LA strain and LAVi are not reliable for LAP in AF.'],
    reportSentence:
      lap === 'elevated' ? `In atrial fibrillation, findings suggest elevated left atrial pressure (${abn} of ${avail.length} ${title} AF criteria).` :
      lap === 'normal' ? `In atrial fibrillation, findings suggest normal left atrial pressure (${title} AF criteria).` :
      lap === 'insufficient' ? '' :
      `In atrial fibrillation, left atrial pressure is indeterminate${lean ? `, favoring ${lean === 'elevated' ? 'elevated' : 'normal'}` : ''} (${abn} of ${avail.length} ${title} AF criteria).`,
  };
}
