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

function compareDevelopers(g, a) {
  const shared = intersect(g.developers, a.developers);
  return { status: shared.length ? 'green' : 'gray', display: g.developers.join(', ') || '—' };
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

function buildShareText({ mode, dateStr, results, won }) {
  const score = won ? results.length : 'X';
  const title = mode === 'daily'
    ? `${GAME_TITLE} #${dayNumber(dateStr)} ${score}/${MAX_GUESSES}`
    : `${GAME_TITLE} (Free Play) ${score}/${MAX_GUESSES}`;
  const rows = results.map(r => COLUMNS.map(c => SHARE_EMOJI[r[c].status]).join(''));
  return [title, '', ...rows].join('\n');
}

function serializeState(guesses, answer) {
  return JSON.stringify({ answerId: answer && answer.id, guessIds: guesses.map(g => g.id) });
}

// When `answer` is given, a save made against a different answer (regenerated data) is discarded.
function parseSavedState(raw, games, answer) {
  try {
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.guessIds) || saved.guessIds.length > MAX_GUESSES) return null;
    if (answer && saved.answerId !== answer.id) return null;
    const byId = new Map(games.map(g => [g.id, g]));
    const guesses = saved.guessIds.map(id => byId.get(id));
    return guesses.every(Boolean) ? { guesses } : null;
  } catch {
    return null;
  }
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
  };
}
