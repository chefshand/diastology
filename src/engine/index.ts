import { assessASE } from './ase2025';
import { assessEACVI } from './eacvi';
import { assessStressASE, assessStressEACVI, hasStressData } from './stress';
import { ageComment } from './age';
import type { Assessment, RestInputs, StressInputs } from './types';

export * from './types';
export { derive, has, fmt } from './derive';
export { SPECIAL_LABELS } from './special';

export interface FullResult {
  rest: { ase: Assessment; eacvi: Assessment };
  stress?: { ase: Assessment; eacvi: Assessment };
  ageNotes: string[];
  report: string;
}

export function assessAll(rest: RestInputs, stress: StressInputs): FullResult {
  const ase = assessASE(rest);
  const eacvi = assessEACVI(rest);
  const s = hasStressData(stress) ? { ase: assessStressASE(stress, rest), eacvi: assessStressEACVI(stress, rest) } : undefined;
  const ageNotes = rest.rhythm === 'sinus' ? ageComment(rest) : [];
  return { rest: { ase, eacvi }, stress: s, ageNotes, report: buildReport(ase, eacvi, s, ageNotes) };
}

function buildReport(ase: Assessment, eacvi: Assessment, s: FullResult['stress'], ageNotes: string[]): string {
  const lines: string[] = [];
  if (ase.reportSentence) lines.push(ase.reportSentence);
  // Only add EACVI when it says something different.
  if (eacvi.reportSentence && eacvi.lap !== ase.lap) lines.push(`By EACVI criteria: ${lowerFirst(eacvi.reportSentence)}`);
  if (s?.ase.reportSentence) lines.push(s.ase.reportSentence);
  if (ageNotes.some((n) => n.includes('reduced for age') || n.includes('normal aging'))) {
    const n = ageNotes.find((x) => x.includes('reduced for age') || x.includes('normal aging'))!;
    lines.push(n.includes('reduced for age') ? "Mitral annular e' is reduced for age by age-specific reference values." : "Mitral annular e' reduction may partly reflect normal aging.");
  }
  return lines.join(' ');
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
