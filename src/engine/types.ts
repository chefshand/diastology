// Input values. All velocities of mitral inflow and tissue Doppler are in cm/s,
// TR velocity in m/s, pressures in mmHg, times in ms, volumes in mL/m², strain in %.

export type Sex = 'male' | 'female';
export type Rhythm = 'sinus' | 'af';

export type SpecialCondition =
  | 'mac' // moderate or severe mitral annular calcification
  | 'ms_or_mv_intervention' // mitral stenosis, MV repair/replacement, TEER
  | 'primary_mr' // moderate or severe primary MR
  | 'hcm'
  | 'transplant'
  | 'lbbb_paced'
  | 'ph_noncardiac' // pulmonary arterial hypertension / non-cardiac PH
  | 'constriction'
  | 'lvad';

export interface RestInputs {
  age?: number;
  sex?: Sex;
  rhythm: Rhythm;
  lvef?: number;
  /** Known myocardial disease (LVH, CAD with WMA, cardiomyopathy, reduced GLS). Used by the EACVI/2016 path when LVEF is normal. */
  myocardialDisease?: boolean;

  E?: number; // cm/s
  A?: number; // cm/s
  EA?: number; // entered directly (overrides E/A computed)
  DT?: number; // ms

  septalE?: number; // e' cm/s
  lateralE?: number;
  averageE?: number; // entered directly
  EeAvg?: number; // entered directly
  EeSeptal?: number;
  EeLateral?: number;

  TR?: number; // m/s
  PASP?: number; // mmHg

  LAVi?: number; // mL/m²
  LARS?: number; // % (LA reservoir strain), optional

  PVSD?: number; // pulmonary vein S/D ratio, optional
  ArA?: number; // ms (Ar duration minus A duration), optional
  IVRT?: number; // ms, optional
  Lwave?: number; // cm/s, optional
  LVMI?: number; // g/m², optional

  special: SpecialCondition[];
}

export interface StressInputs {
  modality?: 'treadmill' | 'bike';
  timing?: 'peak' | 'recovery';
  workload?: string; // e.g. "10 METs" or "75 W"
  HR?: number;
  E?: number;
  A?: number;
  septalE?: number;
  lateralE?: number;
  averageE?: number;
  EeAvg?: number;
  EeSeptal?: number;
  TR?: number;
}

export type Status = 'abnormal' | 'normal' | 'missing';

export interface Finding {
  label: string;
  value?: string;
  status: Status;
  rule: string; // the cutoff that was applied
}

export type LapState = 'normal' | 'elevated' | 'indeterminate' | 'insufficient' | 'not_applicable';

export interface Assessment {
  id: 'ase' | 'eacvi' | 'ase_stress' | 'eacvi_stress';
  title: string;
  headline: string;
  lap: LapState;
  grade?: string;
  /** definitive = guideline gives a clear answer; leaning = indeterminate/incomplete with a direction; insufficient = not enough data */
  confidence: 'definitive' | 'leaning' | 'insufficient';
  lean?: 'normal' | 'elevated';
  leanReason?: string;
  findings: Finding[];
  steps: string[];
  needed: string[];
  caveats: string[];
  reportSentence: string;
}
