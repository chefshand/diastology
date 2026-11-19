import { describe, expect, it } from 'vitest';
import { assessAll } from './index';
import type { RestInputs, StressInputs } from './types';

const base = (o: Partial<RestInputs>): RestInputs => ({ rhythm: 'sinus', special: [], ...o });
const noStress: StressInputs = {};

describe('ASE 2025 rest', () => {
  it('normal diastolic function when all primaries normal', () => {
    const r = assessAll(base({ age: 50, lvef: 60, E: 80, A: 60, septalE: 9, lateralE: 12, TR: 2.3, LAVi: 28 }), noStress);
    expect(r.rest.ase.lap).toBe('normal');
    expect(r.rest.ase.grade).toBe('Normal diastolic function');
    expect(r.rest.ase.confidence).toBe('definitive');
    expect(r.rest.eacvi.lap).toBe('normal');
  });

  it('grade 2 when all three primaries abnormal and E/A < 2', () => {
    const r = assessAll(base({ lvef: 55, E: 90, A: 80, septalE: 5, lateralE: 6, TR: 3.0 }), noStress);
    expect(r.rest.ase.lap).toBe('elevated');
    expect(r.rest.ase.grade).toBe('Grade 2');
  });

  it('grade 3 when elevated and E/A >= 2', () => {
    const r = assessAll(base({ lvef: 30, E: 110, A: 45, septalE: 4, lateralE: 5, TR: 3.1 }), noStress);
    expect(r.rest.ase.grade).toBe('Grade 3');
    expect(r.rest.eacvi.lap).toBe('elevated');
    expect(r.rest.eacvi.grade).toBe('Grade III');
  });

  it("grade 1 when only e' reduced and E/A <= 0.8", () => {
    const r = assessAll(base({ age: 70, lvef: 60, E: 50, A: 80, septalE: 5, lateralE: 6, TR: 2.3 }), noStress);
    expect(r.rest.ase.lap).toBe('normal');
    expect(r.rest.ase.grade).toBe('Grade 1');
  });

  it('indeterminate with a lean and asks for TR when TR missing and no supplemental', () => {
    const r = assessAll(base({ lvef: 60, E: 90, A: 80, septalE: 5, lateralE: 6 }), noStress);
    const a = r.rest.ase;
    expect(a.lap).toBe('indeterminate');
    expect(a.lean).toBe('elevated');
    expect(a.needed.join(' ')).toMatch(/TR/);
    expect(a.needed.join(' ')).toMatch(/LA volume/);
  });

  it('LAVi settles the missing-TR case', () => {
    const r = assessAll(base({ lvef: 60, E: 90, A: 80, septalE: 5, lateralE: 6, LAVi: 40 }), noStress);
    expect(r.rest.ase.lap).toBe('elevated');
    expect(r.rest.ase.confidence).toBe('definitive');
  });

  it('two abnormal primaries with normal supplemental -> normal LAP grade 1', () => {
    const r = assessAll(base({ lvef: 60, E: 75, A: 70, septalE: 5, lateralE: 6, TR: 2.4, LAVi: 28, LARS: 32 }), noStress);
    // e' reduced, E/e' 13.6 normal, TR normal, E/A 1.07 > 0.8 -> supplemental normal
    expect(r.rest.ase.lap).toBe('normal');
    expect(r.rest.ase.grade).toBe('Grade 1');
  });

  it('flags AF and avoids grading', () => {
    const r = assessAll(base({ rhythm: 'af', E: 100, septalE: 7, TR: 3.0 }), noStress);
    expect(r.rest.ase.lap).toBe('elevated');
    expect(r.rest.ase.grade).toBeUndefined();
  });
});

describe('EACVI rest', () => {
  it('uses LARS when one criterion is missing and the others disagree', () => {
    const r = assessAll(base({ lvef: 40, E: 80, A: 70, septalE: 5, lateralE: 7, TR: 3.0, LARS: 15 }), noStress);
    // E/e' 13.3 negative, TR positive, LAVi missing -> LARS 15 positive -> 2/3 elevated
    expect(r.rest.eacvi.lap).toBe('elevated');
  });
  it('indeterminate when split and no LARS', () => {
    const r = assessAll(base({ lvef: 40, E: 80, A: 70, septalE: 5, lateralE: 7, TR: 3.0 }), noStress);
    expect(r.rest.eacvi.lap).toBe('indeterminate');
    expect(r.rest.eacvi.needed.join(' ')).toMatch(/LAVi/);
  });
  it('E/A <= 0.8 and E <= 50 is normal LAP', () => {
    const r = assessAll(base({ lvef: 35, E: 45, A: 70, septalE: 4, lateralE: 5 }), noStress);
    expect(r.rest.eacvi.lap).toBe('normal');
    expect(r.rest.eacvi.grade).toBe('Grade I');
  });
});

describe('stress', () => {
  it('ASE positive with E/e >= 14 and TR > 3.2', () => {
    const r = assessAll(base({ septalE: 5, lateralE: 7 }), { E: 120, septalE: 7, lateralE: 9, TR: 3.4, HR: 110 });
    expect(r.stress?.ase.headline).toMatch(/Positive/);
    expect(r.stress?.eacvi.headline).toMatch(/Positive/);
  });
  it('ASE normal with E/e < 10 and TR < 2.8', () => {
    const r = assessAll(base({}), { E: 90, septalE: 11, lateralE: 14, TR: 2.5 });
    expect(r.stress?.ase.lap).toBe('normal');
  });
  it('E/e high but TR missing leans elevated', () => {
    const r = assessAll(base({}), { EeAvg: 16 });
    expect(r.stress?.ase.lean).toBe('elevated');
    expect(r.stress?.ase.needed.join(' ')).toMatch(/TR/);
  });
});

describe('age comment', () => {
  it("notes e' reduced for age in a young patient", () => {
    const r = assessAll(base({ age: 30, septalE: 6.5, lateralE: 9, E: 80, A: 60, TR: 2.2 }), noStress);
    expect(r.ageNotes.join(' ')).toMatch(/reduced for age/);
  });
});
