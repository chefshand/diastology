export interface Extracted {
  rest: Record<string, number | string | null>;
  stress: Record<string, number | string | null>;
  notes: string[];
}

const CODE_KEY = 'diastology.accessCode';

export function getAccessCode(): string {
  try { return localStorage.getItem(CODE_KEY) ?? ''; } catch { return ''; }
}
export function setAccessCode(code: string) {
  try { code ? localStorage.setItem(CODE_KEY, code) : localStorage.removeItem(CODE_KEY); } catch { /* ignore */ }
}

export async function extract(payload: { text?: string; image?: { data: string; mediaType: string } }): Promise<Extracted> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
    body: JSON.stringify(payload),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = undefined; }
  if (!res.ok) {
    const msg = (body as { error?: string } | undefined)?.error;
    const err = new Error(msg || `Request failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const b = body as Partial<Extracted>;
  return { rest: b.rest ?? {}, stress: b.stress ?? {}, notes: Array.isArray(b.notes) ? b.notes : [] };
}
