async function fetchWikipedia(name) {
  if (!name) return null;
  try {
    // Search for best matching article
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=1&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    const searchData = await searchRes.json();

    const hit = searchData.query?.search?.[0];
    if (!hit) return null;

    // Fetch article summary
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) });
    if (!summaryRes.ok) return null;

    const data = await summaryRes.json();
    if (!data.extract) return null;

    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
    };
  } catch {
    return null;
  }
}

module.exports = { fetchWikipedia };
