import type { Assessment } from '../engine';

const LAP_LABEL: Record<Assessment['lap'], string> = {
  normal: 'Normal', elevated: 'Elevated', indeterminate: 'Indeterminate', insufficient: 'Need data', not_applicable: 'N/A',
};

export default function ResultCard({ a }: { a: Assessment }) {
  const tone = a.lap === 'indeterminate' || (a.confidence === 'leaning' && a.lap !== 'insufficient') ? 'indeterminate' : a.lap;
  return (
    <section className={`card result ${tone}`}>
      <div className="result-head">
        <span className="guideline">{a.title}</span>
        <span className={`pill ${tone}`}>{a.confidence === 'leaning' && a.lap !== 'indeterminate' ? `${LAP_LABEL[a.lap]}?` : LAP_LABEL[a.lap]}</span>
      </div>
      <p className="headline">{a.headline}</p>
      {a.leanReason && <p className="lean small">{a.leanReason}</p>}

      {a.needed.length > 0 && (
        <div className="needed">
          <p className="small"><strong>{a.confidence === 'definitive' ? 'Would refine the grade:' : 'To make this definitive, add:'}</strong></p>
          <ul className="small">{a.needed.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}

      {a.findings.length > 0 && (
        <table className="findings small">
          <tbody>
            {a.findings.map((f) => (
              <tr key={f.label}>
                <td><span className={`dot ${f.status === 'abnormal' ? 'elevated' : f.status === 'normal' ? 'normal' : 'insufficient'}`} /></td>
                <td>
                  <div>{f.label}{f.value ? `: ${f.value}` : ''}</div>
                  <div className="muted">{f.status === 'missing' ? 'not entered · ' : ''}{f.rule}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {a.steps.length > 0 && (
        <details>
          <summary className="small">How this was reached</summary>
          <ol className="small">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </details>
      )}
      {a.caveats.length > 0 && (
        <ul className="caveats small">{a.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
      )}
    </section>
  );
}
