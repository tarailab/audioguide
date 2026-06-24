// Pull a few hard, structured facts from a Wikidata entity (from the OSM
// `wikidata=Q…` tag) to ground the story and cut hallucination. Literal-valued
// properties only (dates/quantities) so no extra label-resolution round-trips.

const TIME_PROPS = {
  P571: 'founded',
  P1619: 'opened',
  P729: 'in service since',
  P576: 'closed',
};
const QTY_PROPS = {
  P1082: ['population', ''],
  P2048: ['height', ' m'],
  P2044: ['elevation', ' m'],
  P2043: ['length', ' m'],
  P2046: ['area', ' km²'],
};

async function fetchWikidataFacts(qid) {
  if (!qid || !/^Q\d+$/.test(qid)) return [];
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const claims = data.entities?.[qid]?.claims || {};
    const firstVal = (pid) => claims[pid]?.[0]?.mainsnak?.datavalue?.value;
    const facts = [];

    for (const [pid, label] of Object.entries(TIME_PROPS)) {
      const v = firstVal(pid);
      const y = v?.time?.match(/^[+-](\d{4})/)?.[1];
      if (y && +y > 0) facts.push(`${label}: ${parseInt(y, 10)}`);
    }
    for (const [pid, [label, unit]] of Object.entries(QTY_PROPS)) {
      const v = firstVal(pid);
      const n = v?.amount != null ? Math.abs(parseFloat(v.amount)) : NaN;
      if (!isNaN(n)) facts.push(`${label}: ${n}${unit}`);
    }
    return facts;
  } catch {
    return [];
  }
}

module.exports = { fetchWikidataFacts };
