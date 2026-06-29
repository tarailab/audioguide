// Turn dossiers into SEO content pages (the distribution flywheel): each page is
// genuine, locally-sourced, long-tail content Google rewards — and a funnel into
// the paid app. Reads cached dossiers only (no API/Wikipedia calls). Run:
//   node backend/src/scripts/build-seo-pages.js
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '../../data');
const OUT = path.join(DATA, 'site');
const BRAND = 'Wayfarer'; // placeholder brand
const APP_URL = 'https://example.com/app';

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Gather every dossier we have, from both stores; dedupe by name.
function collect() {
  const out = new Map();
  const dDir = path.join(DATA, 'dossiers');
  if (fs.existsSync(dDir)) {
    for (const f of fs.readdirSync(dDir).filter((x) => x.endsWith('.json'))) {
      const j = JSON.parse(fs.readFileSync(path.join(dDir, f), 'utf8'));
      if (j.dossier?.summary) out.set(j.name, { name: j.name, d: j.dossier, sources: j.sources });
    }
  }
  const cDir = path.join(DATA, 'model-comparison');
  if (fs.existsSync(cDir)) {
    for (const f of fs.readdirSync(cDir).filter((x) => x.endsWith('.opus.json'))) {
      const j = JSON.parse(fs.readFileSync(path.join(cDir, f), 'utf8'));
      const name = j.row?.place;
      if (name && j.dossier?.summary && !out.has(name)) out.set(name, { name, d: j.dossier });
    }
  }
  return [...out.values()];
}

function page({ name, d, sources }) {
  const desc = (d.summary || '').slice(0, 155);
  const themes = [...new Set((d.angles || []).map((a) => a.theme))];
  const angleHtml = themes.map((t) => `
    <section class="theme">
      <h2>${esc(t[0].toUpperCase() + t.slice(1))}</h2>
      ${(d.angles || []).filter((a) => a.theme === t).map((a) => `
        <article><h3>${esc(a.title)}</h3><p>${esc(a.detail)}</p></article>`).join('')}
    </section>`).join('');
  const facts = (d.facts || []).filter((f) => f.confidence !== 'low').map((f) => `<li>${esc(f.text)}</li>`).join('');
  const conns = (d.connections || []).map((c) => `<li><strong>${esc(c.place)}</strong> — ${esc(c.relation)}</li>`).join('');
  const langs = (d.languagesUsed || []).join(', ');
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'TouristAttraction', name, description: d.summary,
  });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — hidden history, stories & legends | ${BRAND}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="https://example.com/places/${slug(name)}">
<script type="application/ld+json">${jsonld}</script>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1a1a1a}
h1{font-size:30px;margin:.2em 0}.lede{font-size:18px;color:#444}h2{font-size:20px;margin-top:1.6em;border-bottom:1px solid #eee;padding-bottom:4px}
h3{font-size:16px;margin:1em 0 .2em}article p{margin:.2em 0 1em;color:#333}.facts li{margin:.3em 0}
.cta{display:block;background:#1d9e75;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;margin:2em 0;font-weight:500}
.src{font-size:13px;color:#888;margin-top:2em;border-top:1px solid #eee;padding-top:12px}</style>
</head><body>
<h1>${esc(name)}</h1>
<p class="lede">${esc(d.summary)}</p>
<a class="cta" href="${APP_URL}">Hear these stories hands-free as you drive — get the ${esc(name)} audioguide →</a>
${angleHtml}
${facts ? `<h2>Quick facts</h2><ul class="facts">${facts}</ul>` : ''}
${conns ? `<h2>Connected places</h2><ul>${conns}</ul>` : ''}
<a class="cta" href="${APP_URL}">Plan a trip around ${esc(name)} →</a>
<p class="src">Researched from ${langs ? `local-language sources (${esc(langs)})` : 'open sources'} via ${BRAND}. Facts are sourced; surprising claims are flagged for review.</p>
</body></html>`;
}

const items = collect();
fs.mkdirSync(path.join(OUT, 'places'), { recursive: true });
for (const it of items) fs.writeFileSync(path.join(OUT, 'places', `${slug(it.name)}.html`), page(it));
const index = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Places — ${BRAND}</title>
<style>body{font:16px/1.7 system-ui;max-width:720px;margin:0 auto;padding:24px}a{display:block;padding:8px 0}</style></head><body>
<h1>Places</h1>${items.map((it) => `<a href="places/${slug(it.name)}.html">${esc(it.name)} — ${esc((it.d.summary || '').slice(0, 90))}…</a>`).join('')}</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), index);
console.log(`Built ${items.length} SEO pages → data/site/ : ${items.map((i) => i.name).join(', ')}`);
