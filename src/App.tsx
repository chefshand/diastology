import { useMemo, useRef, useState } from 'react';
import { assessAll, derive, SPECIAL_LABELS } from './engine';
import type { RestInputs, SpecialCondition, StressInputs } from './engine';
import { REST_GROUPS, STRESS_GROUPS, CMS_FIELDS } from './fields';
import type { Group } from './fields';
import QuickEntry from './components/QuickEntry';
import ResultCard from './components/ResultCard';
import ReportBox from './components/ReportBox';
import type { Extracted } from './lib/extract';

type Raw = Record<string, string>;

interface Parsed { value?: number; note?: string }

function parseField(key: string, raw: string | undefined): Parsed {
  if (raw === undefined || raw.trim() === '') return {};
  const v = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(v)) return {};
  if (CMS_FIELDS.has(key) && v > 0 && v < 3) return { value: Math.round(v * 1000) / 10, note: `read as ${Math.round(v * 1000) / 10} cm/s` };
  if (key === 'TR' && v > 10) return { value: Math.round(v) / 100, note: `read as ${Math.round(v) / 100} m/s` };
  return { value: v };
}

function toNums(raw: Raw): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  for (const k of Object.keys(raw)) out[k] = parseField(k, raw[k]).value;
  return out;
}

export default function App() {
  const [tab, setTab] = useState<'rest' | 'stress'>('rest');
  const [rest, setRest] = useState<Raw>({});
  const [stress, setStress] = useState<Raw>({});
  const [rhythm, setRhythm] = useState<'sinus' | 'af'>('sinus');
  const [sex, setSex] = useState<'' | 'male' | 'female'>('');
  const [myo, setMyo] = useState(false);
  const [special, setSpecial] = useState<SpecialCondition[]>([]);
  const [modality, setModality] = useState<'' | 'treadmill' | 'bike'>('');
  const [timing, setTiming] = useState<'' | 'peak' | 'recovery'>('');
  const [workload, setWorkload] = useState('');
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [showOptional, setShowOptional] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const restInputs: RestInputs = useMemo(
    () => ({ ...toNums(rest), rhythm, sex: sex || undefined, myocardialDisease: myo, special }),
    [rest, rhythm, sex, myo, special],
  );
  const stressInputs: StressInputs = useMemo(
    () => ({ ...toNums(stress), modality: modality || undefined, timing: timing || undefined, workload: workload || undefined }),
    [stress, modality, timing, workload],
  );
  const result = useMemo(() => assessAll(restInputs, stressInputs), [restInputs, stressInputs]);
  const restDerived = derive(restInputs);
  const stressDerived = derive(stressInputs);
  const stressCount = Object.values(stress).filter((v) => v.trim() !== '').length;

  const applyExtracted = (x: Extracted): string[] => {
    const filled: string[] = [];
    const nextAi = new Set(aiFilled);
    const restKeys = new Set(REST_GROUPS.flatMap((g) => g.fields.map((f) => f.key as string)));
    const stressKeys = new Set(STRESS_GROUPS.flatMap((g) => g.fields.map((f) => f.key as string)));
    const r: Raw = { ...rest };
    for (const [k, v] of Object.entries(x.rest)) {
      if (v === null || v === undefined) continue;
      if (k === 'sex' && (v === 'male' || v === 'female')) { setSex(v); filled.push('sex'); continue; }
      if (k === 'rhythm' && (v === 'sinus' || v === 'af')) { setRhythm(v); filled.push('rhythm'); continue; }
      if (restKeys.has(k) && typeof v === 'number') { r[k] = String(v); nextAi.add(`rest.${k}`); filled.push(k); }
    }
    const s: Raw = { ...stress };
    let stressFilled = 0;
    for (const [k, v] of Object.entries(x.stress)) {
      if (v === null || v === undefined) continue;
      if (k === 'workload' && typeof v === 'string') { setWorkload(v); stressFilled++; continue; }
      if (k === 'modality' && (v === 'treadmill' || v === 'bike')) { setModality(v); continue; }
      if (stressKeys.has(k) && typeof v === 'number') { s[k] = String(v); nextAi.add(`stress.${k}`); stressFilled++; filled.push(`post-exercise ${k}`); }
    }
    if (['PVSD', 'ArA', 'IVRT', 'Lwave'].some((k) => x.rest[k] !== null && x.rest[k] !== undefined)) setShowOptional(true);
    setRest(r);
    setStress(s);
    setAiFilled(nextAi);
    if (stressFilled && !filled.some((f) => !f.startsWith('post-exercise'))) setTab('stress');
    return filled;
  };

  const clearAll = () => {
    setRest({}); setStress({}); setRhythm('sinus'); setSex(''); setMyo(false); setSpecial([]);
    setModality(''); setTiming(''); setWorkload(''); setAiFilled(new Set()); setTab('rest');
  };

  const derivedPlaceholder = (scope: 'rest' | 'stress', key: string): string | undefined => {
    const d = scope === 'rest' ? restDerived : stressDerived;
    const map: Record<string, number | undefined> = { EA: d.EA, averageE: d.avgE, EeAvg: d.EeAvg, EeSeptal: d.EeSeptal, EeLateral: d.EeLateral };
    const v = map[key];
    return v === undefined ? undefined : String(v);
  };

  function renderGroup<K extends string>(scope: 'rest' | 'stress', g: Group<K>, raw: Raw, set: (r: Raw) => void) {
    if (g.optional && !showOptional) {
      return (
        <button key={g.title} type="button" className="optional-toggle" onClick={() => setShowOptional(true)}>
          + {g.title} <span className="muted">(optional: PV S/D, Ar–A, IVRT, L-wave)</span>
        </button>
      );
    }
    return (
      <section className="card group" key={g.title}>
        <h3>{g.title}</h3>
        {g.note && <p className="muted small">{g.note}</p>}
        <div className="grid">
          {g.fields.map((f) => {
            const id = `${scope}-${f.key}`;
            const parsed = parseField(f.key, raw[f.key]);
            const ph = f.derived ? derivedPlaceholder(scope, f.key) : undefined;
            const ai = aiFilled.has(`${scope}.${f.key}`);
            return (
              <label key={f.key} className={`field${ai ? ' ai' : ''}`} htmlFor={id}>
                <span className="label">
                  {f.label}
                  {f.unit && <span className="unit"> {f.unit}</span>}
                  {f.hint && <span className="hint"> {f.hint}</span>}
                </span>
                <input
                  id={id}
                  inputMode="decimal"
                  type="text"
                  autoComplete="off"
                  value={raw[f.key] ?? ''}
                  placeholder={ph ? `${ph} (calc)` : ''}
                  onChange={(e) => {
                    set({ ...raw, [f.key]: e.target.value });
                    if (ai) { const n = new Set(aiFilled); n.delete(`${scope}.${f.key}`); setAiFilled(n); }
                  }}
                />
                {parsed.note && <span className="conv">{parsed.note}</span>}
              </label>
            );
          })}
        </div>
      </section>
    );
  }

  const ase = result.rest.ase;
  const summary = tab === 'stress' && result.stress ? result.stress.ase : ase;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Diastology</h1>
          <p className="muted small">ASE 2025 and EACVI diastolic function check, rest and exercise</p>
        </div>
        <button type="button" className="ghost" onClick={clearAll}>Clear</button>
      </header>

      <QuickEntry onExtracted={applyExtracted} />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'rest'} className={tab === 'rest' ? 'on' : ''} onClick={() => setTab('rest')}>Rest</button>
        <button role="tab" aria-selected={tab === 'stress'} className={tab === 'stress' ? 'on' : ''} onClick={() => setTab('stress')}>
          Exercise stress {stressCount > 0 && <span className="badge">{stressCount}</span>}
        </button>
      </div>

      {tab === 'rest' && (
        <>
          <section className="card group">
            <h3>Context</h3>
            <div className="row">
              <Seg label="Rhythm" value={rhythm} options={[['sinus', 'Sinus'], ['af', 'AF']]} onChange={(v) => setRhythm(v as 'sinus' | 'af')} />
              <Seg label="Sex" value={sex} options={[['male', 'M'], ['female', 'F']]} onChange={(v) => setSex(v as '' | 'male' | 'female')} allowNone />
            </div>
            <label className="check">
              <input type="checkbox" checked={myo} onChange={(e) => setMyo(e.target.checked)} />
              Known myocardial disease (LVH, regional WMA, cardiomyopathy, reduced GLS)
              <span className="muted small"> used by the EACVI path when LVEF is normal</span>
            </label>
            <details className="special">
              <summary>Special conditions {special.length > 0 && <span className="badge">{special.length}</span>}</summary>
              <div className="chips">
                {(Object.keys(SPECIAL_LABELS) as SpecialCondition[]).map((k) => (
                  <button key={k} type="button" className={`chip${special.includes(k) ? ' on' : ''}`}
                    onClick={() => setSpecial(special.includes(k) ? special.filter((s) => s !== k) : [...special, k])}>
                    {SPECIAL_LABELS[k]}
                  </button>
                ))}
              </div>
            </details>
          </section>
          {REST_GROUPS.map((g) => renderGroup('rest', g, rest, setRest))}
        </>
      )}

      {tab === 'stress' && (
        <>
          <section className="card group">
            <h3>Protocol</h3>
            <div className="row">
              <Seg label="Modality" value={modality} options={[['treadmill', 'Treadmill'], ['bike', 'Supine bike']]} onChange={(v) => setModality(v as '' | 'treadmill' | 'bike')} allowNone />
              <Seg label="Timing" value={timing} options={[['peak', 'Peak'], ['recovery', 'Recovery']]} onChange={(v) => setTiming(v as '' | 'peak' | 'recovery')} allowNone />
            </div>
            <label className="field" htmlFor="workload">
              <span className="label">Workload <span className="unit">METs, watts or stage</span></span>
              <input id="workload" type="text" value={workload} onChange={(e) => setWorkload(e.target.value)} placeholder="e.g. 10 METs" />
            </label>
            <p className="muted small">Resting values come from the Rest tab (resting septal e' is part of the EACVI criteria).</p>
          </section>
          {STRESS_GROUPS.map((g) => renderGroup('stress', g, stress, setStress))}
        </>
      )}

      <div ref={resultsRef} className="results" id="results">
        <h2>Assessment</h2>
        {tab === 'stress' && !result.stress && <p className="muted">Enter post-exercise values to see the stress assessment. Rest results are below.</p>}
        {tab === 'stress' && result.stress && (
          <div className="pair">
            <ResultCard a={result.stress.ase} />
            <ResultCard a={result.stress.eacvi} />
          </div>
        )}
        <div className="pair">
          <ResultCard a={result.rest.ase} />
          <ResultCard a={result.rest.eacvi} />
        </div>
        {result.stress && tab === 'rest' && (
          <div className="pair">
            <ResultCard a={result.stress.ase} />
            <ResultCard a={result.stress.eacvi} />
          </div>
        )}
        {result.ageNotes.length > 0 && (
          <section className="card">
            <h3>Age context</h3>
            {result.ageNotes.map((n, i) => <p key={i} className="small">{n}</p>)}
          </section>
        )}
        <ReportBox text={result.report} />
        <Disclaimer />
      </div>

      <button type="button" className="summary-bar" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
        <span className={`dot ${summary.lap}`} />
        <span className="summary-text">
          <strong>{summary.title.split(' (')[0]}:</strong> {summary.headline}
        </span>
        <span className="go">View ↓</span>
      </button>
    </div>
  );
}

function Seg({ label, value, options, onChange, allowNone }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; allowNone?: boolean }) {
  return (
    <div className="seg-wrap">
      <span className="label">{label}</span>
      <div className="seg">
        {options.map(([v, t]) => (
          <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(allowNone && value === v ? '' : v)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <footer className="disclaimer small">
      <p>
        <strong>Clinical decision support only.</strong> This tool applies published guideline cutoffs to the numbers you enter. It does not
        replace physician judgment, image-quality review or the full clinical picture, and it is not a medical device. Verify every
        value before signing a report. Do not enter names, record numbers, dates of birth or other identifiers.
      </p>
      <p className="muted">
        Sources: Nagueh SF et al. Recommendations for the Evaluation of LV Diastolic Function by Echocardiography and for HFpEF Diagnosis: an
        update from the ASE. J Am Soc Echocardiogr 2025;38:537–569. Nagueh SF et al. ASE/EACVI recommendations, Eur Heart J Cardiovasc Imaging
        2016;17:1321–1360. Smiseth OA et al. Multimodality imaging in HFpEF: EACVI expert consensus. Eur Heart J Cardiovasc Imaging
        2022;23:e34–e61. Pieske B et al. HFA-PEFF algorithm, Eur Heart J 2019;40:3297–3317.
      </p>
    </footer>
  );
}
