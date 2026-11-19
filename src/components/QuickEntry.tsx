import { useEffect, useRef, useState } from 'react';
import { extract, getAccessCode, setAccessCode } from '../lib/extract';
import type { Extracted } from '../lib/extract';
import { prepareImage } from '../lib/image';

const EXAMPLE =
  "75 year old man, sinus rhythm, EF 60%. E 80, A 40, lateral e' 8, medial e' 6, TR 2.9 m/s, LA volume index 38. Post exercise at 7 METs, heart rate 125: E 110, septal e' 7, TR 3.3.";

type SR = { start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };

export default function QuickEntry({ onExtracted }: { onExtracted: (x: Extracted) => string[] }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; notes?: string[] } | null>(null);
  const [photo, setPhoto] = useState<{ data: string; mediaType: string; previewUrl: string } | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState(getAccessCode());
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  const SpeechCtor: (new () => SR) | undefined =
    typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;

  useEffect(() => () => recRef.current?.stop(), []);

  const run = async (payload: Parameters<typeof extract>[0]) => {
    setBusy(true);
    setMsg(null);
    try {
      const x = await extract(payload);
      const filled = onExtracted(x);
      setMsg({
        kind: filled.length ? 'ok' : 'err',
        text: filled.length ? `Filled ${filled.length} field${filled.length === 1 ? '' : 's'}. Check the highlighted values below.` : 'No measurements found.',
        notes: x.notes,
      });
      if (filled.length) setPhoto(null);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) setNeedCode(true);
      setMsg({ kind: 'err', text: err.message || 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPhoto(await prepareImage(f));
      setMsg(null);
    } catch {
      setMsg({ kind: 'err', text: 'Could not open that image. Try a JPEG or PNG screenshot.' });
    }
  };

  const toggleMic = () => {
    if (!SpeechCtor) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SpeechCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    const startText = text;
    let acc = '';
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) acc += e.results[i][0].transcript + ' ';
      setText((startText ? startText.trimEnd() + ' ' : '') + acc.trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <section className="card quick">
      <h3>Quick entry</h3>
      <p className="muted small">Type or dictate the measurements, or take a photo of the measurement screen. Every value stays editable below.</p>
      <div className="ta-wrap">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. 68 F, EF 55, E 95, A 70, septal e' 5, lateral e' 7, TR 3.0, LAVi 36. Post exercise E 120, septal e' 6, TR 3.4"
        />
        {SpeechCtor && (
          <button type="button" className={`mic${listening ? ' live' : ''}`} onClick={toggleMic} aria-label={listening ? 'Stop dictation' : 'Start dictation'}>
            {listening ? '■' : '🎙'}
          </button>
        )}
      </div>
      <div className="actions">
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => run({ text })}>
          {busy && !photo ? 'Reading…' : 'Fill form from text'}
        </button>
        <button type="button" disabled={busy} onClick={() => camRef.current?.click()}>📷 Photo</button>
        <button type="button" disabled={busy} onClick={() => libRef.current?.click()}>Upload</button>
        {!text && <button type="button" className="ghost small-btn" onClick={() => setText(EXAMPLE)}>Example</button>}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {photo && (
        <div className="photo">
          <img src={photo.previewUrl} alt="Selected measurement screen" />
          <div>
            <p className="small"><strong>Check before sending:</strong> no name, MRN, date of birth or exam date visible. Crop first if needed. The image is read once and not stored.</p>
            <div className="actions">
              <button type="button" className="primary" disabled={busy} onClick={() => run({ image: { data: photo.data, mediaType: photo.mediaType }, text: text.trim() || undefined })}>
                {busy ? 'Reading…' : 'Read values'}
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={() => setPhoto(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`msg ${msg.kind}`}>
          <p>{msg.text}</p>
          {msg.notes && msg.notes.length > 0 && <ul>{msg.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        </div>
      )}

      {needCode && (
        <div className="code">
          <label className="field">
            <span className="label">Access code</span>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" />
          </label>
          <button type="button" onClick={() => { setAccessCode(code); setNeedCode(false); setMsg({ kind: 'ok', text: 'Saved on this device. Try again.' }); }}>Save</button>
        </div>
      )}
    </section>
  );
}
