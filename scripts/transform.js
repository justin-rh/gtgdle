'use strict';
// Pure transforms from raw IGDB/Steam responses to GAMES entries. No I/O.
const { normalize, summarySnippet } = require('../logic.js');

const STORED_SUMMARY_MAX = 600;

function startsWithWords(text, prefix) {
  const t = normalize(text), p = normalize(prefix);
  return p.length > 0 && (t === p || t.startsWith(`${p} `));
}

function containsWords(text, phrase) {
  const p = normalize(phrase);
  return p.length > 0 && ` ${normalize(text)} `.includes(` ${p} `);
}

function releaseYear(raw) {
  return new Date(raw.first_release_date * 1000).getUTCFullYear();
}

function franchiseNames(raw) {
  return [...(raw.franchises || []), ...(raw.collections || []), ...(raw.collection ? [raw.collection] : [])]
    .map(f => f && f.name)
    .filter(Boolean);
}

// ── Exclusion ────────────────────────────────────────────────────────────────
function classify(raw, cfg) {
  if (cfg.forceInclude.includes(raw.id)) return null;
  if (cfg.forceExclude.includes(raw.id)) return 'manual forceExclude';
  const names = [raw.name, ...franchiseNames(raw)];
  const blocked = cfg.blockedFranchises.find(b => names.some(n => startsWithWords(n, b)));
  if (blocked) return `blocked franchise: ${blocked}`;
  if ((cfg.racingSims || []).some(s => startsWithWords(raw.name, s))) return 'racing sim';
  const genres = (raw.genres || []).map(g => g.name);
  if (genres.includes('Sport') && !cfg.sportAllowlist.some(a => containsWords(raw.name, a))) return 'sport genre';
  return null;
}

function selectGames(raws, cfg, limit = 3000) {
  const kept = [], excluded = [];
  const seen = new Map(); // "normalized name|year" → kept id
  for (const r of raws) {
    if (kept.length >= limit) break;
    const reason = classify(r, cfg);
    if (reason) { excluded.push({ id: r.id, name: r.name, reason }); continue; }
    const key = `${normalize(r.name)}|${releaseYear(r)}`;
    if (seen.has(key)) { excluded.push({ id: r.id, name: r.name, reason: `duplicate of ${seen.get(key)}` }); continue; }
    seen.set(key, r.id);
    kept.push(r);
  }
  return { kept, excluded };
}

// ── Tags ─────────────────────────────────────────────────────────────────────
function titleCase(s) {
  return s.replace(/\b[a-z]/g, c => c.toUpperCase());
}

function cleanTag(tag, cfg) {
  const trimmed = String(tag ?? '').trim();
  if (!trimmed) return null;
  const alias = cfg.tagAliases[trimmed.toLowerCase()];
  const name = alias ?? (trimmed === trimmed.toLowerCase() ? titleCase(trimmed) : trimmed);
  return cfg.tagBlocklist.some(b => normalize(b) === normalize(name)) ? null : name;
}

function cleanTagList(tags, cfg) {
  const out = [], seen = new Set();
  for (const t of tags) {
    const name = cleanTag(t, cfg);
    if (!name || seen.has(normalize(name))) continue;
    seen.add(normalize(name));
    out.push(name);
  }
  return out;
}

function deriveTags(raw, steamTags, cfg) {
  if (steamTags && steamTags.length) {
    const tags = cleanTagList(steamTags, cfg);
    return { primaryTags: tags.slice(0, 5), secondaryTags: tags.slice(5, 20) };
  }
  const names = list => (list || []).map(x => x.name);
  const base = cleanTagList([...names(raw.genres), ...names(raw.themes)], cfg);
  const primaryTags = base.slice(0, 5);
  const all = cleanTagList([...primaryTags, ...base.slice(5), ...names(raw.keywords)], cfg);
  return { primaryTags, secondaryTags: all.slice(primaryTags.length, primaryTags.length + 15) };
}

// Tags appearing in the primary list of more than `threshold` of games are too broad to be a green
// clue; move them to the front of secondary (capped at 15) so a shared broad tag gives yellow.
function demoteBroadTags(games, threshold) {
  const counts = new Map();
  for (const g of games) for (const t of g.primaryTags) counts.set(normalize(t), (counts.get(normalize(t)) || 0) + 1);
  const broad = new Set([...counts].filter(([, n]) => n / games.length > threshold).map(([t]) => t));
  const demoted = [];
  const out = games.map(g => {
    const moved = g.primaryTags.filter(t => broad.has(normalize(t)));
    for (const t of moved) if (!demoted.includes(t)) demoted.push(t);
    const movedSet = new Set(moved.map(normalize));
    return {
      ...g,
      primaryTags: g.primaryTags.filter(t => !movedSet.has(normalize(t))),
      secondaryTags: [...moved, ...g.secondaryTags.filter(t => !movedSet.has(normalize(t)))].slice(0, 15),
    };
  });
  return { games: out, demoted };
}

// ── Other fields ─────────────────────────────────────────────────────────────
function normalizePlatforms(raw, cfg, onUnmapped = () => {}) {
  const out = [];
  for (const p of raw.platforms || []) {
    const mapped = cfg.platformMap[p.name];
    if (mapped === undefined) { onUnmapped(p.name); continue; }
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

function developers(raw) {
  const out = [];
  for (const c of raw.involved_companies || []) {
    const name = c.developer && c.company && c.company.name;
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

function developerCompanyIds(raw) {
  const ids = [];
  for (const c of raw.involved_companies || []) {
    const id = c.developer && c.company && c.company.id;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// Umbrellas for the Developer column's yellow: each developer's top-level owner (walking IGDB
// parents; a company with no parent is its own umbrella), plus hand-kept partner umbrellas
// (second-party / historical ties) from cfg.partnerGroups, with cfg.groupAliases merging names.
function developerGroups(raw, companies, cfg) {
  const aliases = cfg.groupAliases || {};
  const partners = Object.entries(cfg.partnerGroups || {});
  const groups = new Set();
  for (const c of raw.involved_companies || []) {
    if (!c.developer || !c.company || !c.company.name) continue;
    let name = c.company.name;
    const seen = new Set();
    for (let id = c.company.id; companies.has(id) && !seen.has(id); id = companies.get(id).parent) {
      seen.add(id);
      if (companies.get(id).name) name = companies.get(id).name;
    }
    groups.add(aliases[name] || name);
    for (const [group, members] of partners) {
      if (members.some(m => normalize(m) === normalize(c.company.name))) groups.add(group);
    }
  }
  return [...groups].sort();
}

function buildEntry(raw, steam, cfg, onUnmapped, companies = new Map()) {
  const { primaryTags, secondaryTags } = deriveTags(raw, steam.tags, cfg);
  const igdbScore = raw.aggregated_rating != null ? Math.round(raw.aggregated_rating) : null;
  return {
    id: raw.id,
    name: raw.name,
    year: releaseYear(raw),
    primaryTags,
    secondaryTags,
    platforms: normalizePlatforms(raw, cfg, onUnmapped),
    developers: developers(raw),
    developerGroups: developerGroups(raw, companies, cfg),
    franchise: franchiseNames(raw)[0] ?? null,
    metacritic: steam.metacritic ?? igdbScore,
    summary: summarySnippet(raw.summary || raw.storyline, STORED_SUMMARY_MAX),
    coverId: (raw.cover && raw.cover.image_id) || null,
  };
}

// ── Steam response parsing ───────────────────────────────────────────────────
const STEAM_SOURCE = 1; // IGDB external source id for Steam (both `category` and `external_game_source`)

function steamAppId(raw) {
  const ext = (raw.external_games || []).find(e =>
    (e.external_game_source === STEAM_SOURCE || e.category === STEAM_SOURCE) && /^\d+$/.test(String(e.uid)));
  return ext ? Number(ext.uid) : null;
}

function steamSpyTags(json) {
  return Object.entries((json && json.tags) || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

function steamMetacritic(json, appId) {
  const entry = json && json[appId];
  return entry && entry.success && entry.data?.metacritic?.score != null ? entry.data.metacritic.score : null;
}

module.exports = {
  startsWithWords, containsWords, releaseYear, classify, selectGames,
  cleanTagList, deriveTags, demoteBroadTags, normalizePlatforms, buildEntry, developerCompanyIds, developerGroups,
  steamAppId, steamSpyTags, steamMetacritic, STORED_SUMMARY_MAX,
};
