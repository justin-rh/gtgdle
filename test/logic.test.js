'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

test('normalize lowercases, strips diacritics and punctuation', () => {
  assert.equal(L.normalize('Pokémon Red'), 'pokemon red');
  assert.equal(L.normalize('Ōkami HD'), 'okami hd');
  assert.equal(L.normalize("Assassin's Creed II"), 'assassins creed ii');
  assert.equal(L.normalize('Ratchet & Clank'), 'ratchet and clank');
  assert.equal(L.normalize('  Punch-Out!!  '), 'punch out');
  assert.equal(L.normalize('Half-Life: 2'), 'half life 2');
  assert.equal(L.normalize(null), '');
});

test('todayStr formats local date', () => {
  assert.equal(L.todayStr(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('dateToSeed and dayNumber', () => {
  assert.equal(L.dateToSeed('2026-10-13'), 20261013);
  assert.equal(L.dayNumber('2026-10-13'), 1);
  assert.equal(L.dayNumber('2026-10-14'), 2);
  assert.equal(L.dayNumber('2027-10-13'), 366);
});

test('mulberry32 is deterministic and in range', () => {
  const a = L.mulberry32(42), b = L.mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('pickDaily is deterministic per date and varies across dates', () => {
  const games = Array.from({ length: 500 }, (_, i) => ({ id: i }));
  assert.equal(L.pickDaily(games, '2026-10-13'), L.pickDaily(games, '2026-10-13'));
  const ids = new Set();
  for (let d = 1; d <= 28; d++) ids.add(L.pickDaily(games, `2026-11-${String(d).padStart(2, '0')}`).id);
  assert.ok(ids.size > 20, `expected varied answers, got ${ids.size} distinct`);
});

test('pickRandom uses the provided rng', () => {
  const games = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(L.pickRandom(games, () => 0).id, 1);
  assert.equal(L.pickRandom(games, () => 0.99).id, 3);
});

function game(overrides = {}) {
  return {
    id: 1, name: 'Base', year: 2010,
    primaryTags: [], secondaryTags: [], platforms: [], developers: [],
    franchise: null, metacritic: null,
    ...overrides,
  };
}

test('compareYear: exact, ±3 yellow with arrow, beyond gray', () => {
  const a = game({ year: 2010 });
  assert.deepEqual(L.compareYear(game({ year: 2010 }), a), { status: 'green', display: '2010', arrow: null });
  assert.deepEqual(L.compareYear(game({ year: 2007 }), a), { status: 'yellow', display: '2007', arrow: 'up' });
  assert.deepEqual(L.compareYear(game({ year: 2013 }), a), { status: 'yellow', display: '2013', arrow: 'down' });
  assert.deepEqual(L.compareYear(game({ year: 2006 }), a), { status: 'gray', display: '2006', arrow: 'up' });
  assert.deepEqual(L.compareYear(game({ year: 2014 }), a), { status: 'gray', display: '2014', arrow: 'down' });
});

test('compareMetacritic: exact, ±5 yellow, beyond gray, null is gray N/A', () => {
  const a = game({ metacritic: 80 });
  assert.equal(L.compareMetacritic(game({ metacritic: 80 }), a).status, 'green');
  assert.deepEqual(L.compareMetacritic(game({ metacritic: 75 }), a), { status: 'yellow', display: '75', arrow: 'up' });
  assert.deepEqual(L.compareMetacritic(game({ metacritic: 86 }), a), { status: 'gray', display: '86', arrow: 'down' });
  assert.deepEqual(L.compareMetacritic(game({ metacritic: null }), a), { status: 'gray', display: 'N/A', arrow: null });
  assert.deepEqual(L.compareMetacritic(game({ metacritic: 80 }), game({ metacritic: null })), { status: 'gray', display: 'N/A', arrow: null });
});

test('compareTags: primary overlap is green and shows matched primary tags', () => {
  const g = game({ primaryTags: ['RPG', 'Open World', 'Fantasy'], secondaryTags: ['Story Rich'] });
  const a = game({ primaryTags: ['open world', 'RPG'], secondaryTags: ['Fantasy'] });
  assert.deepEqual(L.compareTags(g, a), { status: 'green', display: 'RPG, Open World', matched: ['RPG', 'Open World'] });
});

test('compareTags: no primary overlap but any overlap is yellow', () => {
  const g = game({ primaryTags: ['Shooter'], secondaryTags: ['Sci-fi', 'Co-op'] });
  const a = game({ primaryTags: ['Sci-fi'], secondaryTags: ['Co-op'] });
  assert.deepEqual(L.compareTags(g, a), { status: 'yellow', display: 'Sci-fi, Co-op', matched: ['Sci-fi', 'Co-op'] });
});

test('compareTags: truncates display past 3 with +N, gray when nothing matches or lists empty', () => {
  const tags = ['A', 'B', 'C', 'D', 'E'];
  assert.equal(L.compareTags(game({ primaryTags: tags }), game({ primaryTags: tags })).display, 'A, B, C +2');
  assert.deepEqual(L.compareTags(game({ primaryTags: ['X'] }), game({ primaryTags: ['Y'] })), { status: 'gray', display: 'No match', matched: [] });
  assert.deepEqual(L.compareTags(game(), game()), { status: 'gray', display: 'No match', matched: [] });
});

test('comparePlatforms: equal sets green, overlap yellow shows shared, disjoint gray, empty gray dash', () => {
  const a = game({ platforms: ['PC', 'PS4'] });
  assert.deepEqual(L.comparePlatforms(game({ platforms: ['PS4', 'PC'] }), a), { status: 'green', display: 'PS4, PC' });
  assert.deepEqual(L.comparePlatforms(game({ platforms: ['PS4', 'Switch'] }), a), { status: 'yellow', display: 'PS4' });
  assert.deepEqual(L.comparePlatforms(game({ platforms: ['Switch'] }), a), { status: 'gray', display: 'Switch' });
  assert.deepEqual(L.comparePlatforms(game(), game()), { status: 'gray', display: '—' });
});

test('compareDevelopers: any shared developer is green', () => {
  const a = game({ developers: ['Nintendo EPD', 'Monolith Soft'] });
  assert.deepEqual(L.compareDevelopers(game({ developers: ['monolith soft'] }), a), { status: 'green', display: 'monolith soft' });
  assert.deepEqual(L.compareDevelopers(game({ developers: ['FromSoftware'] }), a), { status: 'gray', display: 'FromSoftware' });
  assert.deepEqual(L.compareDevelopers(game(), a), { status: 'gray', display: '—' });
});

test('compareFranchise: equal non-null is green; null on either side is gray', () => {
  assert.deepEqual(L.compareFranchise(game({ franchise: 'Zelda' }), game({ franchise: 'zelda' })), { status: 'green', display: 'Zelda' });
  assert.deepEqual(L.compareFranchise(game({ franchise: 'Zelda' }), game({ franchise: 'Mario' })), { status: 'gray', display: 'Zelda' });
  assert.deepEqual(L.compareFranchise(game(), game()), { status: 'gray', display: '—' });
});

test('compareGuess returns a cell for every column', () => {
  const r = L.compareGuess(game(), game());
  assert.deepEqual(Object.keys(r), L.COLUMNS);
  for (const c of L.COLUMNS) assert.ok(['green', 'yellow', 'gray'].includes(r[c].status));
});

const SAMPLE = [
  game({ id: 1, name: 'Pokémon Red', year: 1996 }),
  game({ id: 2, name: 'Doom', year: 1993 }),
  game({ id: 3, name: 'Doom', year: 2016 }),
  game({ id: 4, name: 'Doom Eternal', year: 2020 }),
  game({ id: 5, name: 'Ōkami', year: 2006 }),
  game({ id: 6, name: "Assassin's Creed", year: 2007 }),
  game({ id: 7, name: 'Brutal Doom Mod', year: 2010 }),
];

test('searchGames: prefix matches before substring matches', () => {
  assert.deepEqual(L.searchGames(SAMPLE, 'doom').map(g => g.id), [2, 3, 4, 7]);
});

test('searchGames: accent and punctuation insensitive', () => {
  assert.deepEqual(L.searchGames(SAMPLE, 'pokemon').map(g => g.id), [1]);
  assert.deepEqual(L.searchGames(SAMPLE, 'okami').map(g => g.id), [5]);
  assert.deepEqual(L.searchGames(SAMPLE, 'assassins cr').map(g => g.id), [6]);
});

test('searchGames: excludes already-guessed ids, respects limit, empty query returns nothing', () => {
  assert.deepEqual(L.searchGames(SAMPLE, 'doom', new Set([2, 4])).map(g => g.id), [3, 7]);
  assert.equal(L.searchGames(SAMPLE, 'o', new Set(), 2).length, 2);
  assert.deepEqual(L.searchGames(SAMPLE, '   '), []);
});

test('gameStatus', () => {
  const answer = SAMPLE[0];
  assert.equal(L.gameStatus([], answer), 'playing');
  assert.equal(L.gameStatus([SAMPLE[1], answer], answer), 'won');
  const tenWrong = Array.from({ length: 10 }, (_, i) => game({ id: 100 + i }));
  assert.equal(L.gameStatus(tenWrong, answer), 'lost');
});

test('buildShareText: daily header and one emoji row per guess', () => {
  const answer = game({ id: 9, year: 2010, primaryTags: ['RPG'] });
  const results = [
    L.compareGuess(game({ id: 1, year: 2008 }), answer),
    L.compareGuess(answer, answer),
  ];
  const text = L.buildShareText({ mode: 'daily', dateStr: '2026-10-14', results, won: true });
  assert.equal(text, `${L.GAME_TITLE} #2 2/10\n\n🟨⬛⬛⬛⬛⬛\n🟩🟩⬛⬛⬛⬛`);
});

test('buildShareText: loss shows X and free play label', () => {
  const text = L.buildShareText({ mode: 'free', dateStr: '2026-10-14', results: [], won: false });
  assert.equal(text, `${L.GAME_TITLE} (Free Play) X/10\n`);
});

test('serializeState / parseSavedState round-trip', () => {
  const raw = L.serializeState([SAMPLE[1], SAMPLE[4]]);
  assert.deepEqual(L.parseSavedState(raw, SAMPLE), { guesses: [SAMPLE[1], SAMPLE[4]] });
});

test('parseSavedState rejects corrupt or stale data', () => {
  assert.equal(L.parseSavedState(null, SAMPLE), null);
  assert.equal(L.parseSavedState('{not json', SAMPLE), null);
  assert.equal(L.parseSavedState('{"guessIds":"nope"}', SAMPLE), null);
  assert.equal(L.parseSavedState('{"guessIds":[1,999]}', SAMPLE), null);
  assert.equal(L.parseSavedState(JSON.stringify({ guessIds: Array(11).fill(1) }), SAMPLE), null);
});

test('searchGames: matches names typed without spaces or hyphens', () => {
  const games = [game({ id: 1, name: "Marvel's Spider-Man" }), game({ id: 2, name: 'Half-Life 2' }), game({ id: 3, name: 'Pac-Man' })];
  assert.deepEqual(L.searchGames(games, 'spiderman').map(g => g.id), [1]);
  assert.deepEqual(L.searchGames(games, 'halflife').map(g => g.id), [2]);
  assert.deepEqual(L.searchGames(games, 'pacman').map(g => g.id), [3]);
});

test('saved state is discarded when the answer changed (data regenerated)', () => {
  const raw = L.serializeState([SAMPLE[1]], SAMPLE[0]);
  assert.deepEqual(L.parseSavedState(raw, SAMPLE, SAMPLE[0]), { guesses: [SAMPLE[1]] });
  assert.equal(L.parseSavedState(raw, SAMPLE, SAMPLE[2]), null);
  assert.equal(L.parseSavedState(JSON.stringify({ guessIds: [2] }), SAMPLE, SAMPLE[0]), null);
});
