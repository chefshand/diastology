import type { RestInputs, StressInputs } from './engine';

export type NumKey<T> = { [K in keyof T]-?: NonNullable<T[K]> extends number ? K : never }[keyof T];

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  unit?: string;
  hint?: string;
  /** derived fields show the computed value as a placeholder */
  derived?: boolean;
  step?: string;
}

export type RestKey = NumKey<RestInputs>;
export type StressKey = NumKey<StressInputs>;

export interface Group<K extends string> {
  title: string;
  note?: string;
  optional?: boolean;
  fields: FieldDef<K>[];
}

export const REST_GROUPS: Group<RestKey>[] = [
  {
    title: 'Patient',
    fields: [
      { key: 'age', label: 'Age', unit: 'yr' },
      { key: 'lvef', label: 'LVEF', unit: '%' },
    ],
  },
  {
    title: 'Mitral inflow',
    fields: [
      { key: 'E', label: 'E velocity', unit: 'cm/s' },
      { key: 'A', label: 'A velocity', unit: 'cm/s' },
      { key: 'EA', label: 'E/A', derived: true, step: '0.01' },
      { key: 'DT', label: 'Decel. time', unit: 'ms' },
    ],
  },
  {
    title: "Tissue Doppler e'",
    fields: [
      { key: 'septalE', label: "Septal (medial) e'", unit: 'cm/s', step: '0.1' },
      { key: 'lateralE', label: "Lateral e'", unit: 'cm/s', step: '0.1' },
      { key: 'averageE', label: "Average e'", unit: 'cm/s', derived: true, step: '0.1' },
      { key: 'EeAvg', label: "Average E/e'", derived: true, step: '0.1' },
      { key: 'EeSeptal', label: "Septal E/e'", derived: true, step: '0.1' },
      { key: 'EeLateral', label: "Lateral E/e'", derived: true, step: '0.1' },
    ],
  },
  {
    title: 'TR and left atrium',
    fields: [
      { key: 'TR', label: 'TR peak velocity', unit: 'm/s', step: '0.01' },
      { key: 'PASP', label: 'PASP / RVSP', unit: 'mmHg' },
      { key: 'LAVi', label: 'LA volume index', unit: 'mL/m²', step: '0.1' },
      { key: 'LARS', label: 'LA reservoir strain', unit: '%', hint: 'optional', step: '0.1' },
    ],
  },
  {
    title: 'Pulmonary vein and more',
    note: 'Optional. Enter only if the signal is clear.',
    optional: true,
    fields: [
      { key: 'PVSD', label: 'Pulm. vein S/D', step: '0.01' },
      { key: 'ArA', label: 'Ar – A duration', unit: 'ms' },
      { key: 'IVRT', label: 'IVRT', unit: 'ms' },
      { key: 'Lwave', label: 'L-wave velocity', unit: 'cm/s' },
    ],
  },
];

export const STRESS_GROUPS: Group<StressKey>[] = [
  {
    title: 'Exercise',
    fields: [
      { key: 'HR', label: 'Heart rate', unit: 'bpm' },
    ],
  },
  {
    title: 'Post-exercise Doppler',
    fields: [
      { key: 'E', label: 'E velocity', unit: 'cm/s' },
      { key: 'A', label: 'A velocity', unit: 'cm/s', hint: 'optional' },
      { key: 'septalE', label: "Septal e'", unit: 'cm/s', step: '0.1' },
      { key: 'lateralE', label: "Lateral e'", unit: 'cm/s', step: '0.1' },
      { key: 'averageE', label: "Average e'", unit: 'cm/s', derived: true, step: '0.1' },
      { key: 'EeAvg', label: "Average E/e'", derived: true, step: '0.1' },
      { key: 'EeSeptal', label: "Septal E/e'", derived: true, step: '0.1' },
      { key: 'TR', label: 'TR peak velocity', unit: 'm/s', step: '0.01' },
    ],
  },
];

/** Velocity fields where a value under 3 almost certainly means m/s. */
export const CMS_FIELDS = new Set<string>(['E', 'A', 'Lwave']);
