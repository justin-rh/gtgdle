'use strict';

// ═══════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const GAME_TITLE = 'GTGdle';
const MAX_GUESSES = 10;
const DAY_EPOCH = '2026-10-13';
const YEAR_YELLOW_DELTA = 3;
const SCORE_YELLOW_DELTA = 5;
const TAG_DISPLAY_LIMIT = 3;
const COLUMNS = ['year', 'tags', 'platforms', 'developers', 'franchise', 'metacritic'];
const SUMMARY_HINT_AFTER = 5;
const COVER_HINT_AFTER = 8;
const HINT_IDS = ['summary', 'cover'];
const HINT_UNLOCK_AT = { summary: SUMMARY_HINT_AFTER, cover: COVER_HINT_AFTER };
const COVER_URL_BASE = 'https://images.igdb.com/igdb/image/upload/t_cover_big/';
const SUMMARY_SNIPPET_MAX = 220;
const SUMMARY_MIN_FRAGMENT = 60; // shorter sentence-snippets are word-cut instead (abbreviations)
const PROPER_NOUN_REVEAL_AFTER = 7; // names in the summary hint are censored until this many guesses
const KEEP_TAG_MIN_GAMES = 5;       // primary tags this common stay visible in the hint (RPG, JRPG, …)
const REDACTED = '▇▇▇';
const REDACT_STOPWORDS = new Set(['the', 'and', 'of', 'for', 'with', 'from', 'into', 'your', 'their', 'game',
  'games', 'world', 'edition', 'remastered', 'definitive', 'complete', 'ultimate', 'deluxe', 'collection',
  'part', 'chapter', 'episode']);

// ═══════════════════════════════════════════════════════════════════════════
//  TEXT
// ═══════════════════════════════════════════════════════════════════════════
function normalize(str) {
  return String(str ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════
//  DATES + SEEDING
// ═══════════════════════════════════════════════════════════════════════════
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateToSeed(s) { return parseInt(s.replace(/-/g, ''), 10); }
function dayNumber(s) {
  return Math.round((Date.parse(`${s}T00:00:00Z`) - Date.parse(`${DAY_EPOCH}T00:00:00Z`)) / 86400000) + 1;
}

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDaily(games, dateStr) {
  return games[Math.floor(mulberry32(dateToSeed(dateStr))() * games.length)];
}
function pickRandom(games, rand = Math.random) {
  return games[Math.floor(rand() * games.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMPARISONS — each returns { status, display, ... }
// ═══════════════════════════════════════════════════════════════════════════
// Items of `guessList` whose normalized form appears in `answerList`, in guess order.
function intersect(guessList, answerList) {
  const answerSet = new Set(answerList.map(normalize));
  return guessList.filter(x => answerSet.has(normalize(x)));
}

function sameSet(x, y) {
  const a = new Set(x.map(normalize)), b = new Set(y.map(normalize));
  return a.size === b.size && [...a].every(v => b.has(v));
}

function summarize(list) {
  if (list.length <= TAG_DISPLAY_LIMIT) return list.join(', ');
  return `${list.slice(0, TAG_DISPLAY_LIMIT).join(', ')} +${list.length - TAG_DISPLAY_LIMIT}`;
}

function compareNumber(guessVal, answerVal, delta) {
  if (guessVal == null || answerVal == null) return { status: 'gray', display: 'N/A', arrow: null };
  if (guessVal === answerVal) return { status: 'green', display: String(guessVal), arrow: null };
  return {
    status: Math.abs(guessVal - answerVal) <= delta ? 'yellow' : 'gray',
    display: String(guessVal),
    arrow: answerVal > guessVal ? 'up' : 'down',
  };
}

function compareYear(g, a) { return compareNumber(g.year, a.year, YEAR_YELLOW_DELTA); }
function compareMetacritic(g, a) { return compareNumber(g.metacritic, a.metacritic, SCORE_YELLOW_DELTA); }

function compareTags(g, a) {
  const primary = intersect(g.primaryTags, a.primaryTags);
  if (primary.length) return { status: 'green', display: summarize(primary), matched: primary };
  const any = intersect([...g.primaryTags, ...g.secondaryTags], [...a.primaryTags, ...a.secondaryTags]);
  if (any.length) return { status: 'yellow', display: summarize(any), matched: any };
  return { status: 'gray', display: 'No match', matched: [] };
}

function comparePlatforms(g, a) {
  const shared = intersect(g.platforms, a.platforms);
  if (shared.length && sameSet(g.platforms, a.platforms)) return { status: 'green', display: g.platforms.join(', ') };
  if (shared.length) return { status: 'yellow', display: shared.join(', ') };
  return { status: 'gray', display: g.platforms.join(', ') || '—' };
}

// Yellow = no shared developer, but a shared parent company or partner umbrella (developerGroups).
function compareDevelopers(g, a) {
  const devs = g.developers.join(', ') || '—';
  if (intersect(g.developers, a.developers).length) return { status: 'green', display: devs };
  const groups = intersect(g.developerGroups || [], a.developerGroups || []);
  if (groups.length) return { status: 'yellow', display: `${devs} · ${groups.join(', ')}` };
  return { status: 'gray', display: devs };
}

function compareFranchise(g, a) {
  const match = g.franchise && a.franchise && normalize(g.franchise) === normalize(a.franchise);
  return { status: match ? 'green' : 'gray', display: g.franchise || '—' };
}

function compareGuess(g, a) {
  return {
    year: compareYear(g, a),
    tags: compareTags(g, a),
    platforms: comparePlatforms(g, a),
    developers: compareDevelopers(g, a),
    franchise: compareFranchise(g, a),
    metacritic: compareMetacritic(g, a),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  PLAY — search, status, share, persistence
// ═══════════════════════════════════════════════════════════════════════════
function searchGames(games, query, excludeIds = new Set(), limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const qc = q.replace(/ /g, ''); // also match names typed without spaces ("spiderman", "halflife")
  const prefix = [], substring = [];
  for (const g of games) {
    if (excludeIds.has(g.id)) continue;
    const n = normalize(g.name);
    const nc = n.replace(/ /g, '');
    if (n.startsWith(q) || nc.startsWith(qc)) prefix.push(g);
    else if (n.includes(q) || nc.includes(qc)) substring.push(g);
  }
  return [...prefix, ...substring].slice(0, limit);
}

function gameStatus(guesses, answer) {
  if (guesses.some(g => g.id === answer.id)) return 'won';
  return guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
}

const SHARE_EMOJI = { green: '🟩', yellow: '🟨', gray: '⬛' };

function buildShareText({ mode, dateStr, results, won, hintsUsed = 0 }) {
  const score = won ? results.length : 'X';
  const hints = hintsUsed > 0 ? ` 💡${hintsUsed}` : '';
  const title = mode === 'daily'
    ? `${GAME_TITLE} #${dayNumber(dateStr)} ${score}/${MAX_GUESSES}${hints}`
    : `${GAME_TITLE} (Free Play) ${score}/${MAX_GUESSES}${hints}`;
  const rows = results.map(r => COLUMNS.map(c => SHARE_EMOJI[r[c].status]).join(''));
  return [title, '', ...rows].join('\n');
}

function serializeState(guesses, answer, hints = []) {
  return JSON.stringify({ answerId: answer && answer.id, guessIds: guesses.map(g => g.id), hints });
}

// When `answer` is given, a save made against a different answer (regenerated data) is discarded.
function parseSavedState(raw, games, answer) {
  try {
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.guessIds) || saved.guessIds.length > MAX_GUESSES) return null;
    if (answer && saved.answerId !== answer.id) return null;
    const byId = new Map(games.map(g => [g.id, g]));
    const guesses = saved.guessIds.map(id => byId.get(id));
    if (!guesses.every(Boolean)) return null;
    const hints = Array.isArray(saved.hints) ? HINT_IDS.filter(id => saved.hints.includes(id)) : [];
    return { guesses, hints };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  HINTS
// ═══════════════════════════════════════════════════════════════════════════
function hintUnlocked(hintId, guessCount, status) {
  return status === 'playing' && Object.hasOwn(HINT_UNLOCK_AT, hintId) && guessCount >= HINT_UNLOCK_AT[hintId];
}

// Width in pixels the cover is drawn at before being scaled up (smaller = blockier).
function coverPixelWidth(guessCount, status) {
  if (status !== 'playing' || guessCount < COVER_HINT_AFTER) return null;
  return guessCount >= COVER_HINT_AFTER + 1 ? 24 : 10;
}

function coverUrl(coverId) {
  return coverId ? `${COVER_URL_BASE}${coverId}.jpg` : null;
}

// Whole sentences while the total stays within `max`; a single over-long sentence is cut at a word.
// If the sentences that fit are only a short fragment (e.g. "L.A." split off "L.A. Noire is…"),
// the text is word-cut instead so the hint is never a few stray characters.
function summarySnippet(text, max = SUMMARY_SNIPPET_MAX) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  // Split after sentence punctuation without regex lookbehind (unsupported before Safari 16.4).
  const parts = clean.split(/([.!?]["')\]]*)\s+/);
  let out = '';
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i] + (parts[i + 1] || '');
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  const minFragment = Math.min(SUMMARY_MIN_FRAGMENT, Math.floor(max / 3));
  if (out && (out.length >= minFragment || out.length === clean.length)) return out;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Lowercase, accent- and curly-apostrophe-folded copy of `text`, plus a map from each folded index
// back to its index in the original so matches can be replaced in the original string.
function foldWithMap(text) {
  let folded = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const f = text[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'").toLowerCase();
    for (const ch of f) { folded += ch; map.push(i); }
  }
  map.push(text.length);
  return { folded, map };
}

function redactionTerms(game) {
  const terms = new Set([game.name, game.name.split(/:| - /)[0], game.franchise].filter(Boolean));
  for (const word of game.name.split(/[^\p{L}\p{N}]+/u)) {
    if (word.length >= 4 && !REDACT_STOPWORDS.has(foldWithMap(word).folded)) terms.add(word);
  }
  return [...terms].map(t => foldWithMap(t.trim()).folded).filter(Boolean).sort((a, b) => b.length - a.length);
}

function redactSummary(text, game) {
  const { folded, map } = foldWithMap(text);
  const pattern = redactionTerms(game).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return text;
  // Whole words (plus a plural "s"/"es"). The leading boundary is captured as group 1 rather than
  // using lookbehind, which older Safari/iOS cannot parse.
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${pattern})(?:es|s)?(?![\\p{L}\\p{N}])`, 'gu');
  let out = '', last = 0;
  for (const m of folded.matchAll(re)) {
    const start = m.index + m[1].length;
    out += text.slice(last, map[start]) + REDACTED;
    last = map[m.index + m[0].length];
  }
  return out + text.slice(last);
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

// Vocabulary for spotting proper nouns. `common` = words used lowercase more often than capitalized
// mid-sentence across all summaries, so a capitalized sentence-start "Explore" is ordinary but "Link"
// (mostly written as a name) is not. `keep` = primary tags on KEEP_TAG_MIN_GAMES+ games, which stay
// visible as genre clues ("JRPG").
function buildWordContext(games) {
  const lower = new Map(), capMid = new Map(), tagCounts = new Map();
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  for (const g of games) {
    const text = String(g.summary || '');
    for (const m of text.matchAll(WORD_RE)) {
      const w = m[0].replace(/['’]s$/i, '');
      if (w === w.toLowerCase()) bump(lower, w);
      else if (/^\p{Lu}/u.test(w) && !isSentenceStart(text, m.index)) bump(capMid, w.toLowerCase());
    }
    for (const t of new Set((g.primaryTags || []).map(t => t.toLowerCase()))) bump(tagCounts, t);
  }
  const common = new Set([...lower].filter(([w, n]) => n > (capMid.get(w) || 0)).map(([w]) => w));
  const keep = new Set([...tagCounts].filter(([, n]) => n >= KEEP_TAG_MIN_GAMES).map(([t]) => t));
  return { common, keep };
}

function isSentenceStart(text, index) {
  let i = index - 1;
  while (i >= 0 && /[\s"'“‘([]/.test(text[i])) i--;
  return i < 0 || /[.!?:]/.test(text[i]);
}

function isProperNoun(word, atStart, ctx) {
  if (word.length < 2 || /^\p{N}/u.test(word) || !/\p{Lu}/u.test(word)) return false;
  const lower = word.toLowerCase();
  if (ctx.keep.has(lower)) return false;
  return atStart ? !ctx.common.has(lower) : true;
}

// Replaces proper nouns with REDACTED; a run of name words separated only by spaces becomes one
// block so the hint doesn't reveal how many words a name has. Initials ("K. Rool", "George R. R.
// Martin") join the adjacent name; lone initials ("A.I.") stay. Possessive "'s" stays visible.
function censorProperNouns(text, ctx) {
  const spans = [];
  let pending = null; // initials not yet attached to a name: { start, end }
  for (const m of text.matchAll(WORD_RE)) {
    const word = m[0].replace(/['’]s$/i, '');
    const start = m.index, end = start + word.length;
    const prev = spans[spans.length - 1];
    const gap = prev ? text.slice(prev.end, start) : '';
    if (/^\p{Lu}$/u.test(word) && text[end] === '.') {
      if (prev && /^[\s.]*$/.test(gap)) { prev.end = end; prev.initial = true; }
      else if (pending && /^[\s.]*$/.test(text.slice(pending.end, start))) pending.end = end;
      else pending = { start, end };
      continue;
    }
    if (!isProperNoun(word, isSentenceStart(text, start), ctx)) { pending = null; continue; }
    if (prev && (/^\s+$/.test(gap) || (prev.initial && /^[\s.]+$/.test(gap)))) {
      prev.end = end;
      prev.initial = false;
    } else {
      const from = pending && /^[\s.]+$/.test(text.slice(pending.end, start)) ? pending.start : start;
      spans.push({ start: from, end, initial: false });
    }
    pending = null;
  }
  let out = '', last = 0;
  for (const { start, end } of spans) {
    out += text.slice(last, start) + REDACTED;
    last = end;
  }
  return out + text.slice(last);
}

// The summary hint as shown after `guessCount` guesses: title always redacted; proper nouns
// censored until PROPER_NOUN_REVEAL_AFTER guesses.
function summaryHintText(game, guessCount, ctx) {
  const snippet = summarySnippet(game.summary);
  if (!snippet) return null;
  const redacted = redactSummary(snippet, game);
  return guessCount >= PROPER_NOUN_REVEAL_AFTER ? redacted : censorProperNouns(redacted, ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORTS (Node only — in the browser these are plain globals)
// ═══════════════════════════════════════════════════════════════════════════
if (typeof module !== 'undefined') {
  module.exports = {
    GAME_TITLE, MAX_GUESSES, DAY_EPOCH,
    YEAR_YELLOW_DELTA, SCORE_YELLOW_DELTA, TAG_DISPLAY_LIMIT, COLUMNS,
    normalize, todayStr, dateToSeed, dayNumber, mulberry32, pickDaily, pickRandom,
    compareYear, compareTags, comparePlatforms, compareDevelopers, compareFranchise, compareMetacritic, compareGuess,
    searchGames, gameStatus, buildShareText, serializeState, parseSavedState,
    SUMMARY_HINT_AFTER, COVER_HINT_AFTER, HINT_IDS, hintUnlocked, coverPixelWidth, coverUrl,
    SUMMARY_SNIPPET_MAX, REDACTED, summarySnippet, redactSummary,
    PROPER_NOUN_REVEAL_AFTER, buildWordContext, censorProperNouns, summaryHintText,
  };
}
