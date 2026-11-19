import { useState } from 'react';

export default function ReportBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <section className="card report">
      <div className="result-head">
        <h3>Report sentence</h3>
        <button type="button" className="primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <p className="report-text">{text}</p>
    </section>
  );
}
