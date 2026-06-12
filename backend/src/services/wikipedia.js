async function fetchSummaryByTitle(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.extract) return null;
  return { title: data.title, extract: data.extract, url: data.content_urls?.desktop?.page };
}

async function fetchWikipedia(name, tags = {}) {
  if (!name) return null;
  try {
    // 1. OSM wikipedia tag (e.g. "en:Three Crosses" or "lt:Trys kryžiai")
    const wikiTag = tags.wikipedia || tags['wikipedia:en'];
    if (wikiTag) {
      const title = wikiTag.includes(':') ? wikiTag.split(':').slice(1).join(':') : wikiTag;
      const result = await fetchSummaryByTitle(title);
      if (result) return result;
    }

    // 2. Wikidata tag → resolve English Wikipedia title via Wikidata API
    if (tags.wikidata) {
      const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${tags.wikidata}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`;
      const wdRes = await fetch(wdUrl, { signal: AbortSignal.timeout(5000) });
      const wdData = await wdRes.json();
      const enTitle = wdData.entities?.[tags.wikidata]?.sitelinks?.enwiki?.title;
      if (enTitle) {
        const result = await fetchSummaryByTitle(enTitle);
        if (result) return result;
      }
    }

    // 3. Search English Wikipedia by name (works for names that are same in English)
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=1&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    const searchData = await searchRes.json();
    const hit = searchData.query?.search?.[0];
    if (hit) {
      const result = await fetchSummaryByTitle(hit.title);
      if (result) return result;
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = { fetchWikipedia };
