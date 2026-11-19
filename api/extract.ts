/**
 * POST /api/extract
 * Body: { text?: string, image?: { data: base64 string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } }
 * Returns: { rest: {...}, stress: {...}, notes: string[] } with numbers in the app's units.
 *
 * Nothing is stored. The image or text is sent to the Claude API only to read the numbers.
 * Set ACCESS_CODE in Vercel to require the code (sent as the x-access-code header).
 */
import Anthropic from '@anthropic-ai/sdk';

const num = { type: ['number', 'null'] } as const;
const restProps = {
  age: num, sex: { type: ['string', 'null'], description: 'male or female' },
  rhythm: { type: ['string', 'null'], description: 'sinus or af' },
  lvef: num, E: num, A: num, EA: num, DT: num,
  septalE: num, lateralE: num, averageE: num, EeAvg: num, EeSeptal: num, EeLateral: num,
  TR: num, PASP: num, LAVi: num, LARS: num, PVSD: num, ArA: num, IVRT: num, Lwave: num, LVMI: num,
};
const stressProps = {
  workload: { type: ['string', 'null'] }, HR: num, E: num, A: num,
  septalE: num, lateralE: num, averageE: num, EeAvg: num, EeSeptal: num, TR: num,
  modality: { type: ['string', 'null'], description: 'treadmill or bike' },
};
const obj = (props: Record<string, unknown>) => ({
  type: 'object', additionalProperties: false, properties: props, required: Object.keys(props),
});
const SCHEMA = obj({
  rest: obj(restProps),
  stress: obj(stressProps),
  notes: { type: 'array', items: { type: 'string' } },
});

const SYSTEM = `You read echocardiography diastolic-function measurements from a clinician's dictated text or from a photo of an echo machine measurement screen or report, and return them as structured numbers.

Rules:
- Return only values that are explicitly present. Use null for anything absent. Never invent or estimate values.
- Do not compute ratios yourself unless the source states them. (The app computes E/A, average e' and E/e'.)
- Convert to these units:
  E, A, e' (septal/medial, lateral, average), L-wave: cm/s. Values written in m/s (for example "E 0.8 m/s" or an E under 3 with no unit) are multiplied by 100.
  TR peak velocity: m/s. A TR written in cm/s (for example 280) is divided by 100. If only a TR peak gradient in mmHg is given, put it in notes, not in TR.
  PASP and RVSP: mmHg (RVSP counts as PASP). DT, IVRT, Ar–A: ms. LAVi: mL/m². LARS (LA reservoir strain): %. LVEF: %. LVMI: g/m².
- "Medial" means septal. "Average e'" or "mean e'" goes in averageE. "E/e'" with no site is average E/e' (EeAvg) unless the source says septal or lateral.
- Pulmonary vein S/D ratio goes in PVSD. If only S and D velocities are given, compute S divided by D for PVSD and say so in notes.
- Ar–A means pulmonary vein atrial reversal duration minus mitral A duration. If both durations are given, compute the difference and say so in notes.
- Anything described as post-exercise, peak exercise, stress, recovery, or after the treadmill or bike belongs in "stress". Everything else, including baseline or rest values, belongs in "rest".
- Atrial fibrillation or flutter means rhythm "af". Sinus rhythm means "sinus".
- Age and sex are allowed. Never return names, record numbers, dates of birth, exam dates, institution names or any other identifier. If the image shows such identifiers, ignore them and add the note "Image appears to contain patient identifiers; crop them out next time."
- If a value is unclear, ambiguous, or the unit is uncertain, leave it null and explain in notes. Keep notes short.`;

export async function POST(request: Request): Promise<Response> {
  const required = process.env.ACCESS_CODE;
  if (required && request.headers.get('x-access-code') !== required) {
    return json({ error: 'Access code required or incorrect.' }, 401);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, 500);
  }

  let body: { text?: string; image?: { data?: string; mediaType?: string } };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const text = typeof body.text === 'string' ? body.text.slice(0, 8000) : '';
  const img = body.image;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (img && (!img.data || !img.mediaType || !allowed.includes(img.mediaType))) {
    return json({ error: 'Unsupported image.' }, 400);
  }
  if (img?.data && img.data.length > 6_000_000) return json({ error: 'Image too large.' }, 413);
  if (!text.trim() && !img) return json({ error: 'Send text or an image.' }, 400);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (img?.data) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType as 'image/jpeg', data: img.data } });
  }
  content.push({
    type: 'text',
    text: img
      ? `Read the diastolic function measurements in this image.${text.trim() ? ` Additional context from the clinician: ${text}` : ''}`
      : `Extract the measurements from this dictation:\n\n${text}`,
  });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: img ? 'medium' : 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal') {
      return json({ error: 'The model declined to read this input.' }, 422);
    }
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return json({ error: 'No result returned.' }, 502);
    const parsed = JSON.parse(textBlock.text);
    return json(parsed, 200);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Rate limited by the AI service. Try again in a moment.' }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The server API key was rejected.' }, 500);
    if (err instanceof Anthropic.APIError) return json({ error: `AI service error (${err.status ?? 'unknown'}).` }, 502);
    if (err instanceof SyntaxError) return json({ error: 'Could not parse the AI response.' }, 502);
    return json({ error: 'Unexpected server error.' }, 500);
  }
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
