// Shared POI scoring + enrichment. The driving pipeline (routes/pois.js) and the
// trip-planner browse pipeline both classify POIs identically by going through
// here — only their *selection* differs (speed-ellipse vs map-bbox).
const { fetchWikipedia } = require('./wikipedia');
const { fetchWikidataMeta } = require('./wikidata');
const cache = require('./cache');

const ENRICH_TTL_MS = 15 * 60 * 1000; // matches POI_TTL — OSM data barely changes

// Objective interest from Wikidata sitelinks: capped bonus to the score.
const sitelinkBonus = (n) => Math.min(6, Math.floor((n || 0) / 3));

function tagScore(tags = {}) {
  let s = 1;
  if (tags.wikidata || tags.wikipedia) s += 2;
  if (tags.heritage) s += String(tags['heritage:operator'] || '').includes('whc') ? 6 : 3;
  if (tags.historic) s += 3;
  if (tags.tourism && tags.tourism !== 'information') s += 2;
  if (tags.man_made === 'lighthouse') s += 3;
  if (['windmill', 'watermill', 'tower', 'obelisk'].includes(tags.man_made)) s += 2;
  if (tags.geological) s += 2;
  if (tags.place === 'city') s += 5;
  if (tags.place === 'town') s += 3;
  if (tags.place === 'village' || tags.place === 'hamlet') s += 1;
  if (tags.place === 'suburb') s += 1;
  if (tags.natural) s += 1;
  if (tags.memorial || tags.monument) s += 2;
  return s;
}

// Best available thumbnail: a direct image URL, else a Commons file rendered at
// a sane width via Special:FilePath.
function posterImage(tags = {}) {
  if (tags.image && /^https?:\/\//.test(tags.image)) return tags.image;
  const c = tags.wikimedia_commons;
  if (c && c.startsWith('File:')) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(c.slice(5))}?width=480`;
  }
  return null;
}

function notability(poi) {
  return tagScore(poi.tags) + (poi.wiki ? 6 : 0);
}

// Coarse category from OSM tags — the trip planner's primary grouping/filter
// axis. Order matters (first match wins): a museum inside a castle reads as a
// castle; a peak with a viewpoint reads as nature. Keep keys in sync with the
// frontend categories.js.
// Minimal one-line POI description. Cascade of free sources (no LLM): an OSM
// description tag → the Wikidata one-liner → the first sentence of the Wikipedia
// summary. Returns null if nothing's available (an LLM/web-search fallback for
// those is a planned follow-up). Trimmed to a tooltip-friendly length.
function firstSentence(text) {
  if (!text) return null;
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}
function buildBlurb(tags = {}, wiki, wikidataDescription) {
  const raw = tags['description:en'] || tags.description
    || wikidataDescription || wiki?.description || firstSentence(wiki?.extract);
  if (!raw) return null;
  const s = String(raw).trim();
  return s.length > 180 ? `${s.slice(0, 177)}…` : s;
}

function categoryOf(t = {}) {
  if (/^(city|town|village|hamlet|suburb)$/.test(t.place || '')) return 'settlement';
  if (/^(castle|fort|city_gate|fortification)$/.test(t.historic || '') || t.defensive) return 'castle';
  if (/^(museum|gallery|artwork|attraction|theme_park|zoo)$/.test(t.tourism || '')) return 'culture';
  if (t.natural || t.geological) return 'nature';
  if (/^(lighthouse|windmill|watermill|tower|obelisk)$/.test(t.man_made || '') || t.tourism === 'viewpoint') return 'landmark';
  if (t.historic || t.heritage) return 'heritage';
  return 'other';
}

// Rough value tier on two axes (the 2×2), so all tiers populate instead of a
// blended score collapsing into a bimodal has-wiki/no-wiki split:
//   A interesting + documented   B interesting + thin (value-add zone)
//   C ordinary  + documented     D ordinary + thin
function interestHigh(t = {}) {
  if (t.historic || t.heritage || t.geological) return true;
  if (['lighthouse', 'windmill', 'watermill', 'tower', 'obelisk'].includes(t.man_made)) return true;
  if (t.tourism && t.tourism !== 'information') return true;
  if (['waterfall', 'peak', 'cave_entrance', 'volcano', 'geyser', 'cliff', 'arch', 'hot_spring'].includes(t.natural)) return true;
  if (t.place === 'city' || t.place === 'town') return true;
  return false; // village / hamlet / suburb / generic
}
function dataHigh(poi) {
  const t = poi.tags || {};
  return !!poi.wiki || !!t.wikipedia || !!t.wikidata;
}
// Tier from whatever we know. Browse passes a poi with no `wiki`/`sitelinks` yet,
// so it gets a *provisional* tier from tags alone; full enrich firms it up.
function valueTier(poi) {
  const i = interestHigh(poi.tags) || (poi.sitelinks || 0) >= 5;
  const d = dataHigh(poi);
  if (i && d) return 'A';
  if (i && !d) return 'B';
  if (!i && d) return 'C';
  return 'D';
}

// Full enrichment for a SINGLE raw POI ({id,name,lat,lon,tags}): Wikipedia
// summary + Wikidata sitelink count → real tier, score, image. Cached per id so
// repeated clicks / re-adds are instant. This is the expensive part the trip
// planner defers until a POI is actually clicked or added.
async function enrichOne(poi) {
  if (!poi || !poi.id) throw new Error('enrichOne: poi.id required');
  return cache.remember(`poi:enrich:${poi.id}`, ENRICH_TTL_MS, async () => {
    const wiki = await fetchWikipedia(poi.name, poi.tags);
    const { sitelinks, description: wdDesc } = await fetchWikidataMeta(poi.tags?.wikidata);
    const withWiki = { ...poi, wiki, sitelinks };
    return {
      ...withWiki,
      image: posterImage(poi.tags),
      relevanceScore: notability(withWiki) + sitelinkBonus(sitelinks),
      tier: valueTier(withWiki),
      category: categoryOf(poi.tags),
      blurb: buildBlurb(poi.tags, wiki, wdDesc),
    };
  });
}

module.exports = {
  sitelinkBonus, tagScore, posterImage, notability,
  interestHigh, dataHigh, valueTier, categoryOf, buildBlurb, enrichOne,
};
