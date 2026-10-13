'use strict';
// Network + disk cache for the build. Every fetch takes an injectable fetchFn for tests.
const fs = require('node:fs');
const path = require('node:path');
const { steamSpyTags, steamMetacritic } = require('./transform.js');

const sleep = ms => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());

function createCache(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = key => path.join(dir, `${key}.json`);
  return {
    get(key) { return fs.existsSync(file(key)) ? JSON.parse(fs.readFileSync(file(key), 'utf8')) : undefined; },
    set(key, value) { fs.writeFileSync(file(key), JSON.stringify(value)); },
  };
}

async function getTwitchToken(clientId, clientSecret, fetchFn = fetch) {
  const url = 'https://id.twitch.tv/oauth2/token'
    + `?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
  const res = await fetchFn(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch auth failed: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const IGDB_PAGE = 500;
const IGDB_FIELDS = [
  'name', 'first_release_date', 'total_rating_count', 'aggregated_rating',
  'genres.name', 'themes.name', 'keywords.name', 'platforms.name',
  'involved_companies.developer', 'involved_companies.company.name',
  'franchises.name', 'collections.name',
  'external_games.uid', 'external_games.external_game_source',
].join(',');

// game_type: 0 main, 4 standalone expansion, 8 remake, 9 remaster, 10 expanded game.
// If IGDB rejects `game_type`, swap to the legacy `category = (0,4,8,9,10)` — same ids.
function igdbQuery(offset) {
  return `fields ${IGDB_FIELDS}; `
    + 'where game_type = (0,4,8,9,10) & first_release_date != null & total_rating_count != null & version_parent = null; '
    + `sort total_rating_count desc; limit ${IGDB_PAGE}; offset ${offset};`;
}

async function fetchIgdbCandidates({ clientId, token, cache, total = 5000, fetchFn = fetch, delayMs = 300, log = console.log }) {
  const all = [];
  for (let offset = 0; offset < total; offset += IGDB_PAGE) {
    const key = `igdb-${offset}`;
    let page = cache.get(key);
    if (page === undefined) {
      const res = await fetchFn('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: igdbQuery(offset),
      });
      if (!res.ok) throw new Error(`IGDB request failed at offset ${offset}: HTTP ${res.status} ${await res.text()}`);
      page = await res.json();
      cache.set(key, page);
      await sleep(delayMs);
    }
    all.push(...page);
    log(`IGDB: ${all.length} candidates`);
    if (page.length < IGDB_PAGE) break;
  }
  return all;
}

async function fetchJsonWithRetry(url, fetchFn, retryDelayMs) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchFn(url);
      if (res.ok) return await res.json();
    } catch { /* network error — retry */ }
    if (attempt === 0) await sleep(retryDelayMs);
  }
  return null;
}

async function cachedJson(cache, key, url, fetchFn, delayMs, retryDelayMs) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const json = await fetchJsonWithRetry(url, fetchFn, retryDelayMs);
  if (json) cache.set(key, json); // failures are not cached so a rerun retries them
  await sleep(delayMs);
  return json;
}

async function fetchSteamData(appId, { cache, fetchFn = fetch, spyDelayMs = 1000, storeDelayMs = 1500, retryDelayMs = 5000 }) {
  const spy = await cachedJson(cache, `steamspy-${appId}`,
    `https://steamspy.com/api.php?request=appdetails&appid=${appId}`, fetchFn, spyDelayMs, retryDelayMs);
  const store = await cachedJson(cache, `steamstore-${appId}`,
    `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=metacritic`, fetchFn, storeDelayMs, retryDelayMs);
  return {
    tags: spy ? steamSpyTags(spy) : null,
    metacritic: store ? steamMetacritic(store, appId) : null,
    failed: !spy || !store,
  };
}

module.exports = { createCache, getTwitchToken, fetchIgdbCandidates, fetchSteamData };
