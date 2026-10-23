// Sends the Stem cells topic's stories to the owner's Google Sheet (news/stemcell-sheet.gs), which
// keeps every one for good; the app keeps only the last 30 days. Run by fetch-news.mjs after it
// writes news.json, on every publishing run of .github/workflows/news.yml (a merge, by hand or the
// half-hourly schedule; never a branch's check). The Sheet skips what it already has, so sending
// the whole topic each time is how a run that failed catches up.
//
// STEMCELL_SHEET (a repository secret): the script's web app URL with ?key=<its phrase>. Without
// it, nothing is sent. A failure is logged and never fails the run: the headlines still publish.

const TIMEOUT_MS = 30000;

export function articles(stories) {
  return stories.filter(s => s.topic === 'stemcells').map(s => ({
    title: s.title, source: s.source, url: s.url, published: s.published || null, summary: s.summary || '',
    ...(s.doi ? { doi: s.doi } : {}),
  }));
}

export async function logStemCells(stories, { url = process.env.STEMCELL_SHEET, publish = process.env.PUBLISH, fetch: get = fetch } = {}) {
  if (publish !== 'true') return console.log('Stem cell log: not a publishing run, nothing sent');
  if (!url) return console.log('Stem cell log: no STEMCELL_SHEET secret, nothing sent (news/README.md, "Stem cell log")');
  const list = articles(stories);
  try {
    // Apps Script answers a POST with a redirect to the result, which fetch follows
    const res = await get(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'log', articles: list }), signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    let r = null;
    try { r = await res.json(); } catch {}
    if (!r || !r.ok) return console.log(`::warning::Stem cell log: the Sheet said ${r ? r.error : `HTTP ${res.status}`}`);
    console.log(`Stem cell log: ${r.added} new of ${list.length} stories`);
  } catch (err) {
    console.log(`::warning::Stem cell log: ${err.message}`);
  }
}
