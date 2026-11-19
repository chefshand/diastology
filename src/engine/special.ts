import { has } from './derive';
import type { RestInputs, SpecialCondition } from './types';

export const SPECIAL_LABELS: Record<SpecialCondition, string> = {
  mac: 'Moderate or severe MAC',
  ms_or_mv_intervention: 'Mitral stenosis, MV repair/replacement or TEER',
  primary_mr: 'Moderate or severe primary MR',
  hcm: 'Hypertrophic cardiomyopathy',
  transplant: 'Heart transplant',
  lbbb_paced: 'LBBB or RV pacing',
  ph_noncardiac: 'Pulmonary arterial / non-cardiac pulmonary hypertension',
  constriction: 'Pericardial constriction',
  lvad: 'LVAD',
};

/** Conditions that ASE 2025 lists as exclusions from the standard algorithm. */
const EXCLUDING: SpecialCondition[] = ['mac', 'ms_or_mv_intervention', 'primary_mr', 'transplant', 'ph_noncardiac', 'constriction', 'lvad'];

export const excludesStandardAlgorithm = (r: RestInputs) => r.special.some((s) => EXCLUDING.includes(s));

/** Condition-specific guidance (ASE 2025 Table 7 and special-population figures). Verify against the printed guideline. */
export function specialConditionNotes(r: RestInputs): string[] {
  const out: string[] = [];
  const EA = has(r.EA) ? r.EA : has(r.E) && has(r.A) && r.A > 0 ? r.E / r.A : undefined;
  for (const s of r.special) {
    switch (s) {
      case 'mac': {
        let call = '';
        if (has(EA)) {
          if (EA < 0.8) call = ` Here E/A ${EA.toFixed(2)} <0.8 suggests normal LAP.`;
          else if (EA > 1.8) call = ` Here E/A ${EA.toFixed(2)} >1.8 suggests elevated LAP.`;
          else if (has(r.IVRT)) call = ` Here E/A ${EA.toFixed(2)} is 0.8–1.8 and IVRT ${r.IVRT} ms ${r.IVRT >= 80 ? '≥80 suggests normal' : '<80 suggests elevated'} LAP.`;
          else call = ` Here E/A ${EA.toFixed(2)} is 0.8–1.8, so IVRT is needed.`;
        }
        out.push(`MAC: e' and E/e' are unreliable. ASE uses E/A <0.8 normal LAP, >1.8 elevated, and for 0.8–1.8 IVRT ≥80 ms normal vs <80 ms elevated.${call}`);
        break;
      }
      case 'ms_or_mv_intervention':
        out.push('Mitral stenosis or MV intervention: standard indices do not apply. ASE suggests IVRT <60 ms, IVRT/TE–e\' <4.2 and mitral A >1.5 m/s as signs of elevated LAP (MS).');
        break;
      case 'primary_mr':
        out.push("Primary MR: E/e' is not useful with normal EF. ASE suggests Ar–A ≥30 ms, IVRT <60 ms and IVRT/TE–e' <5.6 as signs of elevated LAP.");
        break;
      case 'hcm':
        out.push("HCM: use average E/e' >14, Ar–A ≥30 ms, TR >2.8 m/s and LAVi >34 mL/m² together. LARS may help.");
        break;
      case 'transplant':
        out.push("Heart transplant: average E/e' <7 suggests normal and >14 elevated filling pressure. For 7–14, use E/SRivr or TR (≤2.8 m/s normal).");
        break;
      case 'lbbb_paced':
        out.push("LBBB or RV pacing: septal (and average) e' are less reliable. Prefer lateral e' and lateral E/e'.");
        break;
      case 'ph_noncardiac':
        out.push("Non-cardiac PH: TR velocity does not reflect LAP. Lateral E/e' is preferred: <8 favors normal and >13 favors elevated LAP. E/A ≤0.8 with E ≤50 cm/s favors pre-capillary PH.");
        break;
      case 'constriction':
        out.push("Constriction: annulus reversus (septal e' > lateral e') and preserved medial e' (>7 cm/s) are typical. E/e' does not track LAP.");
        break;
      case 'lvad':
        out.push("LVAD: E/A >2, average E/e' >14, RAP >10 mmHg, PASP >40 mmHg and LAVi >33 mL/m² favor elevated LAP.");
        break;
    }
  }
  return out;
}
