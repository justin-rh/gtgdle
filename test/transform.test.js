'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../scripts/transform.js');

const CFG = {
  blockedFranchises: ['Call of Duty', 'Battlefield', 'FIFA', "Tom Clancy's Rainbow Six"],
  sportAllowlist: ['Rocket League', 'Mario & Sonic', 'Punch-Out'],
  forceInclude: [900],
  forceExclude: [901],
  platformMap: { 'PC (Microsoft Windows)': 'PC', 'Mac': 'PC', 'PlayStation 4': 'PS4', 'Oculus VR': null },
  tagAliases: { 'role-playing (rpg)': 'RPG', 'science fiction': 'Sci-fi' },
  tagBlocklist: ['Nudity', 'Steam Achievements'],
};

const Y2016 = Date.UTC(2016, 4, 13) / 1000;
function raw(overrides = {}) {
  return { id: 1, name: 'Some Game', first_release_date: Y2016, total_rating_count: 100, ...overrides };
}

test('startsWithWords / containsWords respect word boundaries and punctuation', () => {
  assert.equal(T.startsWithWords('Call of Duty: Black Ops', 'Call of Duty'), true);
  assert.equal(T.startsWithWords('Battlefield 1', 'Battlefield'), true);
  assert.equal(T.startsWithWords('Battlefields of Old', 'Battlefield'), false);
  assert.equal(T.containsWords('Super Punch-Out!!', 'Punch-Out'), true);
  assert.equal(T.containsWords('Mario & Sonic at the Olympic Games', 'Mario & Sonic'), true);
});

test('releaseYear uses UTC year', () => {
  assert.equal(T.releaseYear(raw()), 2016);
});

test('classify: blocked by name, by franchise, by collection', () => {
  assert.match(T.classify(raw({ name: 'Call of Duty 4: Modern Warfare' }), CFG), /blocked franchise: Call of Duty/);
  assert.match(T.classify(raw({ name: 'Warzone', franchises: [{ name: 'Call of Duty' }] }), CFG), /Call of Duty/);
  assert.match(T.classify(raw({ name: 'Siege', collections: [{ name: "Tom Clancy's Rainbow Six" }] }), CFG), /Rainbow Six/);
  assert.match(T.classify(raw({ name: 'FIFA 23' }), CFG), /FIFA/);
});

test('classify: sport genre excluded unless allowlisted', () => {
  const sport = [{ name: 'Sport' }];
  assert.equal(T.classify(raw({ name: 'Generic Tennis 2009', genres: sport }), CFG), 'sport genre');
  assert.equal(T.classify(raw({ name: 'Rocket League', genres: sport }), CFG), null);
  assert.equal(T.classify(raw({ name: 'Mario & Sonic at the Olympic Games', genres: sport }), CFG), null);
  assert.equal(T.classify(raw({ name: 'Super Punch-Out!!', genres: sport }), CFG), null);
});

test('classify: non-generic shooters kept; overrides win', () => {
  assert.equal(T.classify(raw({ name: 'Halo: Combat Evolved', genres: [{ name: 'Shooter' }] }), CFG), null);
  assert.equal(T.classify(raw({ id: 900, name: 'Battlefield 1942' }), CFG), null);
  assert.equal(T.classify(raw({ id: 901, name: 'Portal' }), CFG), 'manual forceExclude');
});

test('selectGames: excludes, dedupes on name+year (keeps first), applies limit', () => {
  const raws = [
    raw({ id: 1, name: 'Doom', first_release_date: Date.UTC(2016, 0, 1) / 1000 }),
    raw({ id: 2, name: 'Battlefield 3' }),
    raw({ id: 3, name: 'Doom', first_release_date: Date.UTC(1993, 11, 10) / 1000 }),
    raw({ id: 4, name: 'DOOM', first_release_date: Date.UTC(2016, 5, 1) / 1000 }),
    raw({ id: 5, name: 'Portal' }),
    raw({ id: 6, name: 'Portal 2' }),
  ];
  const { kept, excluded } = T.selectGames(raws, CFG, 3);
  assert.deepEqual(kept.map(r => r.id), [1, 3, 5]);
  assert.deepEqual(excluded, [
    { id: 2, name: 'Battlefield 3', reason: 'blocked franchise: Battlefield' },
    { id: 4, name: 'DOOM', reason: 'duplicate of 1' },
  ]);
});

test('cleanTagList: aliases, title-cases lowercase keywords, drops blocklisted, dedupes', () => {
  assert.deepEqual(
    T.cleanTagList(['Role-playing (RPG)', 'female protagonist', 'Nudity', 'RPG', 'Science fiction', ' '], CFG),
    ['RPG', 'Female Protagonist', 'Sci-fi'],
  );
});

test('deriveTags: Steam tags → top 5 primary, next 15 secondary', () => {
  const steam = ['Open World', 'RPG', 'Nudity', 'Story Rich', 'Atmospheric', 'Fantasy',
    ...Array.from({ length: 20 }, (_, i) => `Tag${i}`)];
  const { primaryTags, secondaryTags } = T.deriveTags(raw({ genres: [{ name: 'Adventure' }] }), steam, CFG);
  assert.deepEqual(primaryTags, ['Open World', 'RPG', 'Story Rich', 'Atmospheric', 'Fantasy']);
  assert.equal(secondaryTags.length, 15);
  assert.equal(secondaryTags[0], 'Tag0');
});

test('deriveTags: IGDB fallback uses genres+themes as primary, keywords as secondary, no overlap', () => {
  const r = raw({
    genres: [{ name: 'Role-playing (RPG)' }, { name: 'Adventure' }],
    themes: [{ name: 'Science fiction' }],
    keywords: [{ name: 'rpg' }, { name: 'space' }, { name: 'steam achievements' }],
  });
  assert.deepEqual(T.deriveTags(r, null, CFG), { primaryTags: ['RPG', 'Adventure', 'Sci-fi'], secondaryTags: ['Space'] });
  assert.deepEqual(T.deriveTags(raw(), [], CFG), { primaryTags: [], secondaryTags: [] });
});

test('normalizePlatforms: maps, merges, drops null silently, reports unmapped', () => {
  const unmapped = [];
  const r = raw({ platforms: [{ name: 'PC (Microsoft Windows)' }, { name: 'Mac' }, { name: 'PlayStation 4' }, { name: 'Oculus VR' }, { name: 'Ouya' }] });
  assert.deepEqual(T.normalizePlatforms(r, CFG, n => unmapped.push(n)), ['PC', 'PS4']);
  assert.deepEqual(unmapped, ['Ouya']);
});

test('steam helpers', () => {
  assert.equal(T.steamAppId(raw({ external_games: [{ uid: 'abc', external_game_source: 5 }, { uid: '620', external_game_source: 1 }] })), 620);
  assert.equal(T.steamAppId(raw({ external_games: [{ uid: '400', category: 1 }] })), 400);
  assert.equal(T.steamAppId(raw()), null);
  assert.deepEqual(T.steamSpyTags({ tags: { Puzzle: 50, 'First-Person': 90, Comedy: 70 } }), ['First-Person', 'Comedy', 'Puzzle']);
  assert.deepEqual(T.steamSpyTags({ tags: [] }), []);
  assert.equal(T.steamMetacritic({ 620: { success: true, data: { metacritic: { score: 95 } } } }, 620), 95);
  assert.equal(T.steamMetacritic({ 620: { success: true, data: {} } }, 620), null);
  assert.equal(T.steamMetacritic({ 620: { success: false } }, 620), null);
});

test('buildEntry: full shape, Steam score preferred over IGDB rating', () => {
  const r = raw({
    id: 72, name: 'Portal 2', aggregated_rating: 94.6,
    genres: [{ name: 'Puzzle' }], platforms: [{ name: 'Mac' }, { name: 'PlayStation 4' }],
    involved_companies: [
      { developer: true, company: { name: 'Valve' } },
      { developer: false, company: { name: 'Electronic Arts' } },
      { developer: true, company: { name: 'Valve' } },
    ],
    franchises: [], collections: [{ name: 'Portal' }],
  });
  assert.deepEqual(T.buildEntry(r, { tags: null, metacritic: null }, CFG), {
    id: 72, name: 'Portal 2', year: 2016,
    primaryTags: ['Puzzle'], secondaryTags: [],
    platforms: ['PC', 'PS4'], developers: ['Valve'],
    franchise: 'Portal', metacritic: 95,
  });
  assert.equal(T.buildEntry(r, { tags: null, metacritic: 88 }, CFG).metacritic, 88);
  assert.equal(T.buildEntry(raw(), { tags: null, metacritic: null }, CFG).metacritic, null);
  assert.equal(T.buildEntry(raw(), { tags: null, metacritic: null }, CFG).franchise, null);
});

test('real config: Tony Hawk games survive the sport filter', () => {
  const config = require('../scripts/config.js');
  const sport = [{ name: 'Sport' }];
  assert.equal(T.classify(raw({ name: "Tony Hawk's Pro Skater 1 + 2", genres: sport }), config), null);
  assert.equal(T.classify(raw({ name: "Tony Hawk's Underground", genres: sport }), config), null);
});

test('real config: generic Steam tags are dropped so Tags clues stay informative', () => {
  const config = require('../scripts/config.js');
  assert.deepEqual(
    T.cleanTagList(['Singleplayer', 'Multiplayer', 'Great Soundtrack', 'Masterpiece', 'Classic', 'Beautiful', 'Puzzle'], config),
    ['Puzzle'],
  );
});

test('real config: racing sims excluded, arcade racers and non-sport misfires kept', () => {
  const config = require('../scripts/config.js');
  const sport = [{ name: 'Sport' }, { name: 'Racing' }];
  for (const name of ['Gran Turismo 7', 'Forza Motorsport 4', 'Project CARS', 'Assetto Corsa', 'Dirt Rally 2.0', 'Colin McRae Rally 2.0']) {
    assert.equal(T.classify(raw({ name, genres: sport }), config), 'racing sim', name);
    assert.equal(T.classify(raw({ name, genres: [{ name: 'Racing' }] }), config), 'racing sim', `${name} without Sport genre`);
  }
  for (const name of ['Forza Horizon 4', 'Need for Speed: Heat', 'Dirt 3', 'Colin McRae: Dirt 2', 'Grid 2', 'Trackmania', 'Blur',
    'Yakuza 4', 'Jet Set Radio', 'Beat Saber', 'Nidhogg', "Alto's Adventure", 'Nintendo Switch Sports', '1080° Snowboarding', 'SSX 3']) {
    assert.equal(T.classify(raw({ name, genres: sport }), config), null, name);
  }
  for (const name of ['Football Manager 2024', "WWE '13", 'Fight Night Champion']) {
    assert.equal(T.classify(raw({ name, genres: sport }), config), 'sport genre', name);
  }
});

test('demoteBroadTags moves tags above the threshold from primary to front of secondary', () => {
  const g = (id, primaryTags, secondaryTags = []) => ({ id, primaryTags, secondaryTags });
  const games = [
    g(1, ['Action', 'Metroidvania'], ['Indie']),
    g(2, ['Action', 'RPG']),
    g(3, ['Puzzle', 'Action'], ['Action Extra']),
    g(4, ['RPG', 'Strategy']),
  ];
  const { games: out, demoted } = T.demoteBroadTags(games, 0.5);
  assert.deepEqual(demoted, ['Action']); // 3/4 > 0.5; RPG is 2/4, not above
  assert.deepEqual(out.map(x => [x.primaryTags, x.secondaryTags]), [
    [['Metroidvania'], ['Action', 'Indie']],
    [['RPG'], ['Action']],
    [['Puzzle'], ['Action', 'Action Extra']],
    [['RPG', 'Strategy'], []],
  ]);
});

test('demoteBroadTags keeps secondary at 15 or fewer', () => {
  const sec = Array.from({ length: 15 }, (_, i) => `S${i}`);
  const { games } = T.demoteBroadTags([{ id: 1, primaryTags: ['Action'], secondaryTags: sec }], 0.25);
  assert.equal(games[0].secondaryTags.length, 15);
  assert.equal(games[0].secondaryTags[0], 'Action');
});
