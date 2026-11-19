# Diastology

A phone-first web app (installable PWA) that checks a diastolic function read against the
**ASE 2025** update and the **EACVI** pathway (2016 ASE/EACVI algorithm with the 2022 EACVI HFpEF
consensus refinements), side by side, for resting and exercise stress echocardiograms.

- Type, dictate, or photograph the measurements. The text or photo is read by Claude
  (server-side, `api/extract.ts`) and fills the form. Every field stays editable.
- Results show the grade and LAP estimate, whether the answer is definitive or indeterminate,
  which way an indeterminate case leans, and which extra parameters would settle it.
- Age-adjusted e' comment (ASE 2025 Table 6), special-condition notes (MAC, MR, HCM, AF, etc.).
- One-tap copyable report sentence.
- No database and no storage. Nothing is saved on the server. Photos are downscaled and
  re-encoded in the browser (which strips EXIF) before upload.

The guideline logic is plain TypeScript in `src/engine/` with tests in `src/engine/engine.test.ts`.

## Deploy on Vercel

1. In Vercel: **Add New… → Project → Import** `chefshand/diastology`. Framework preset: **Vite** (auto-detected). Click **Deploy**.
2. **Settings → Environment Variables**: add `ANTHROPIC_API_KEY` (Production, Preview). Optional: add `ACCESS_CODE`
   to require a code before the AI reading works (the app asks for it once per device). Redeploy after adding variables.
3. **Settings → Domains**: add `diastology.kiaafshar.org`. If `kiaafshar.org` already uses Vercel nameservers it works immediately;
   otherwise add the CNAME record Vercel shows (`diastology` → `cname.vercel-dns.com`) at your DNS provider.

## Install on the phone

Open the site in Safari (iPhone) → Share → **Add to Home Screen**. On Android/Chrome use **Install app**.

## Develop

```bash
npm install
ANTHROPIC_API_KEY=sk-... npm run dev   # /api/extract is served by Vite in dev
npm test
npm run build
```

## Sources

- Nagueh SF, et al. Recommendations for the Evaluation of LV Diastolic Function by Echocardiography and for HFpEF Diagnosis: An Update From the ASE. *J Am Soc Echocardiogr* 2025;38:537–569.
- Nagueh SF, et al. Recommendations for the Evaluation of LV Diastolic Function by Echocardiography: an update from the ASE and EACVI. *Eur Heart J Cardiovasc Imaging* 2016;17:1321–1360.
- Smiseth OA, et al. Multimodality imaging in patients with HFpEF: an expert consensus document of the EACVI. *Eur Heart J Cardiovasc Imaging* 2022;23:e34–e61.
- Popescu BA, et al. How to assess LV filling pressures by echocardiography in clinical practice. *Eur Heart J Cardiovasc Imaging* 2022;23:1127–1129.
- Grapsa J, Argulian E, Smiseth OA. Diastolic dysfunction: a comparison of 2025 ASE, 2024 BSE and 2022 EACVI guidelines. *Eur Heart J Cardiovasc Imaging* 2025;26:1725–1727.
- Pieske B, et al. HFA-PEFF diagnostic algorithm. *Eur Heart J* 2019;40:3297–3317.

**Clinical decision support only.** Not a medical device. Verify all values and interpretations.
