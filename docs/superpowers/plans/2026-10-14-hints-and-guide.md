# GTGdle Hints + Color Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "How to play" color guide and two click-to-reveal hints (redacted summary after 5 guesses, pixelated cover after 8) to GTGdle.

**Architecture:** All hint rules (unlocking, snippet length, title redaction, pixelation level, share suffix, saved hints) are pure functions in `logic.js`, unit-tested under Node. The build adds `summary` and `coverId` to each game. The UI in `game.js`/`index.html`/`style.css` only wires those functions to the DOM.

**Tech Stack:** Vanilla JS, Node 24 `node:test`, zero dependencies (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-14-hints-and-guide-design.md` (builds on `docs/superpowers/specs/2026-10-13-gtgdle-design.md`)

All paths are relative to `C:\Users\justin.rhoda\gtgdle\`, which is now its own git repo (origin = github.com/justin-rh/gtgdle).

## Global Constraints

- **Do NOT commit.** Justin commits only when he says so. Tasks end with a checkpoint, not a commit.
- Zero npm dependencies. `npm test` runs every suite.
- `SUMMARY_HINT_AFTER = 5`, `COVER_HINT_AFTER = 8`. Hints only unlock while the game is playing.
- Summary snippet ≤ 220 chars at play time; stored summary ≤ 600 chars at build time.
- Redaction token is `▇▇▇`. Stopwords: `the, and, of, for, with, from, into, your, their, game, games, world, edition, remastered, definitive, complete, ultimate, deluxe, collection, part, chapter, episode`.
- Cover URL: `https://images.igdb.com/igdb/image/upload/t_cover_big/<coverId>.jpg`. Pixel width 10 at 8 guesses, 24 at 9+, full image only in the result popup.
- Share header gets ` 💡N` only when N > 0.
- Daily save format: `{ answerId, guessIds, hints }`; saves without `hints` load with none.
- All data strings rendered with `textContent` (never `innerHTML`). Canvas is never read back.
- The guide auto-opens once (`localStorage` key `gtgdle_seen_guide`); thresholds shown in it come from the logic constants.

## Review Focus

1. **Title words leaking through redaction** in odd forms — curly apostrophes ("Assassin’s"), accents typed without them ("Pokemon" vs "Pokémon"), possessives ("Zelda's"), numbers in titles ("2077"). Pinned in Task 2 redaction tests.
2. **Over-redaction of ordinary words** that happen to share a prefix with a title ("Doomed" when the title is "Doom") or are stopwords ("world"). Pinned in Task 2.
3. **Old daily saves** (no `hints` field) or saves with junk hint ids must load cleanly with no hints. Pinned in Task 1.
4. **Cover image fails to load or game has no cover/summary** must show the fallback message, never a blank or broken panel. Pinned in Task 6 manual steps (image load is DOM-only) and Task 2 (`summarySnippet(null)`).
5. **Switching games while a cover is still loading** (Free Play → New game) must not paint the old game's cover onto the new one. Pinned in Task 6 (`renderCoverHint` answer-id guard) with a manual step.

---

## File Map

| File | Change | Task |
|---|---|---|
| `logic.js` | hint constants, `hintUnlocked`, `coverPixelWidth`, `coverUrl`, share 💡 suffix, hints in save/restore; `summarySnippet`, `redactSummary` | 1–2 |
| `test/logic.test.js` | new tests; two existing save tests updated for the `hints` field | 1–2 |
| `scripts/transform.js`, `scripts/sources.js` | `summary`, `coverId` in entries; IGDB fields | 3 |
| `test/transform.test.js`, `test/sources.test.js` | new tests; existing `buildEntry` shape test updated | 3 |
| `data.js`, `excluded.txt`, `test/data.test.js` | regenerated data; new invariants | 4 |
| `index.html`, `style.css`, `game.js` | guide modal; hint panel; result cover | 5–6 |

---

### Task 1: Hint rules, share suffix, saved hints

**Files:**
- Modify: `logic.js`, `test/logic.test.js`

**Interfaces:**
- Consumes: `MAX_GUESSES`, `GAME_TITLE`, `dayNumber`, `COLUMNS` (existing)
- Produces:
  - `SUMMARY_HINT_AFTER = 5`, `COVER_HINT_AFTER = 8`, `HINT_IDS = ['summary', 'cover']`
  - `hintUnlocked(hintId: 'summary'|'cover', guessCount: number, status: 'playing'|'won'|'lost') → boolean`
  - `coverPixelWidth(guessCount: number, status) → number|null` (10, 24, or null)
  - `coverUrl(coverId: string|null) → string|null`
  - `buildShareText({ mode, dateStr, results, won, hintsUsed = 0 }) → string`
  - `serializeState(guesses, answer, hints = []) → string`
  - `parseSavedState(raw, games, answer?) → { guesses: Game[], hints: string[] } | null`

- [ ] **Step 1: Update the two existing save tests** in `test/logic.test.js` for the new `hints` field

Change line `assert.deepEqual(L.parseSavedState(raw, SAMPLE), { guesses: [SAMPLE[1], SAMPLE[4]] });` to:
```js
  assert.deepEqual(L.parseSavedState(raw, SAMPLE), { guesses: [SAMPLE[1], SAMPLE[4]], hints: [] });
```
Change line `assert.deepEqual(L.parseSavedState(raw, SAMPLE, SAMPLE[0]), { guesses: [SAMPLE[1]] });` to:
```js
  assert.deepEqual(L.parseSavedState(raw, SAMPLE, SAMPLE[0]), { guesses: [SAMPLE[1]], hints: [] });
```

- [ ] **Step 2: Append the new failing tests** to `test/logic.test.js`

```js
test('hintUnlocked: summary at 5 guesses, cover at 8, only while playing', () => {
  assert.equal(L.SUMMARY_HINT_AFTER, 5);
  assert.equal(L.COVER_HINT_AFTER, 8);
  assert.equal(L.hintUnlocked('summary', 4, 'playing'), false);
  assert.equal(L.hintUnlocked('summary', 5, 'playing'), true);
  assert.equal(L.hintUnlocked('cover', 7, 'playing'), false);
  assert.equal(L.hintUnlocked('cover', 8, 'playing'), true);
  assert.equal(L.hintUnlocked('summary', 9, 'won'), false);
  assert.equal(L.hintUnlocked('cover', 10, 'lost'), false);
  assert.equal(L.hintUnlocked('bogus', 10, 'playing'), false);
  assert.equal(L.hintUnlocked('toString', 10, 'playing'), false);
});

test('coverPixelWidth: blocky at 8, clearer at 9+, null otherwise', () => {
  assert.equal(L.coverPixelWidth(7, 'playing'), null);
  assert.equal(L.coverPixelWidth(8, 'playing'), 10);
  assert.equal(L.coverPixelWidth(9, 'playing'), 24);
  assert.equal(L.coverPixelWidth(9, 'won'), null);
});

test('coverUrl builds the IGDB image URL or null', () => {
  assert.equal(L.coverUrl('co1r7f'), 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg');
  assert.equal(L.coverUrl(null), null);
});

test('buildShareText appends 💡N only when hints were used', () => {
  const base = { mode: 'daily', dateStr: '2026-10-14', results: [], won: false };
  assert.equal(L.buildShareText(base).split('\n')[0], `${L.GAME_TITLE} #2 X/10`);
  assert.equal(L.buildShareText({ ...base, hintsUsed: 0 }).split('\n')[0], `${L.GAME_TITLE} #2 X/10`);
  assert.equal(L.buildShareText({ ...base, hintsUsed: 2 }).split('\n')[0], `${L.GAME_TITLE} #2 X/10 💡2`);
  assert.equal(L.buildShareText({ ...base, mode: 'free', hintsUsed: 1 }).split('\n')[0], `${L.GAME_TITLE} (Free Play) X/10 💡1`);
});

test('saved state round-trips revealed hints; old saves and junk ids load with valid hints only', () => {
  const answer = SAMPLE[0];
  const raw = L.serializeState([SAMPLE[1]], answer, ['summary']);
  assert.deepEqual(L.parseSavedState(raw, SAMPLE, answer), { guesses: [SAMPLE[1]], hints: ['summary'] });
  const old = JSON.stringify({ answerId: answer.id, guessIds: [2] });
  assert.deepEqual(L.parseSavedState(old, SAMPLE, answer), { guesses: [SAMPLE[1]], hints: [] });
  const junk = JSON.stringify({ answerId: answer.id, guessIds: [2], hints: ['cover', 'nope', 'cover', 7] });
  assert.deepEqual(L.parseSavedState(junk, SAMPLE, answer), { guesses: [SAMPLE[1]], hints: ['cover'] });
  const notArray = JSON.stringify({ answerId: answer.id, guessIds: [2], hints: 'summary' });
  assert.deepEqual(L.parseSavedState(notArray, SAMPLE, answer), { guesses: [SAMPLE[1]], hints: [] });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the two updated save tests (missing `hints`), plus `L.hintUnlocked is not a function` etc.

- [ ] **Step 4: Implement in `logic.js`**

Add to CONSTANTS:
```js
const SUMMARY_HINT_AFTER = 5;
const COVER_HINT_AFTER = 8;
const HINT_IDS = ['summary', 'cover'];
const HINT_UNLOCK_AT = { summary: SUMMARY_HINT_AFTER, cover: COVER_HINT_AFTER };
const COVER_URL_BASE = 'https://images.igdb.com/igdb/image/upload/t_cover_big/';
```

Add a HINTS section above EXPORTS:
```js
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
```

Replace `buildShareText` with:
```js
function buildShareText({ mode, dateStr, results, won, hintsUsed = 0 }) {
  const score = won ? results.length : 'X';
  const hints = hintsUsed > 0 ? ` 💡${hintsUsed}` : '';
  const title = mode === 'daily'
    ? `${GAME_TITLE} #${dayNumber(dateStr)} ${score}/${MAX_GUESSES}${hints}`
    : `${GAME_TITLE} (Free Play) ${score}/${MAX_GUESSES}${hints}`;
  const rows = results.map(r => COLUMNS.map(c => SHARE_EMOJI[r[c].status]).join(''));
  return [title, '', ...rows].join('\n');
}
```

Replace `serializeState` and `parseSavedState` with:
```js
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
```

Extend `module.exports` with:
```js
    SUMMARY_HINT_AFTER, COVER_HINT_AFTER, HINT_IDS, hintUnlocked, coverPixelWidth, coverUrl,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites; logic gains 5 tests).

- [ ] **Step 6: Checkpoint (no commit)** — `git status --short` shows only `logic.js`, `test/logic.test.js` modified (plus the new spec/plan docs).

---

### Task 2: Summary snippet + title redaction

**Files:**
- Modify: `logic.js`, `test/logic.test.js`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `SUMMARY_SNIPPET_MAX = 220`, `REDACTED = '▇▇▇'`
  - `summarySnippet(text: string|null, max = 220) → string|null` — whole sentences while ≤ max; one over-long sentence is cut at a word with "…"; whitespace collapsed; null/blank → null
  - `redactSummary(text: string, game: { name, franchise }) → string`

- [ ] **Step 1: Append failing tests** to `test/logic.test.js`

```js
test('summarySnippet: whole sentences up to max, collapses whitespace', () => {
  assert.equal(L.summarySnippet('One. Two two. Three.', 13), 'One. Two two.');
  assert.equal(L.summarySnippet('A  b.\n\nC d.'), 'A b. C d.');
  assert.equal(L.summarySnippet('Runs at 3.5 GHz. Fast!', 220), 'Runs at 3.5 GHz. Fast!');
});

test('summarySnippet: a single over-long sentence is cut at a word with an ellipsis', () => {
  assert.equal(L.summarySnippet('alpha beta gamma delta.', 12), 'alpha beta…');
  assert.ok(L.summarySnippet('x'.repeat(300)).length <= 220);
});

test('summarySnippet: null or blank gives null', () => {
  assert.equal(L.summarySnippet(null), null);
  assert.equal(L.summarySnippet('   '), null);
});

test('redactSummary: full name, main title, and franchise', () => {
  const g = { name: 'Hollow Knight: Silksong', franchise: 'Hollow Knight' };
  assert.equal(
    L.redactSummary('Silksong is the sequel to Hollow Knight. Hollow Knight: Silksong follows Hornet.', g),
    '▇▇▇ is the sequel to ▇▇▇. ▇▇▇ follows Hornet.',
  );
});

test('redactSummary: possessives keep their suffix; stopwords stay', () => {
  const g = { name: 'The Legend of Zelda: Breath of the Wild', franchise: 'The Legend of Zelda' };
  assert.equal(
    L.redactSummary("Zelda's kingdom of Hyrule awaits in this open world.", g),
    "▇▇▇'s kingdom of Hyrule awaits in this open world.",
  );
  assert.equal(L.redactSummary('Mario explores a new world.', { name: 'Super Mario World', franchise: null }),
    '▇▇▇ explores a new world.');
});

test('redactSummary: accent and apostrophe insensitive, numbers redacted', () => {
  assert.equal(L.redactSummary('Pokemon Red lets you catch Pokémon.', { name: 'Pokémon Red', franchise: 'Pokémon' }),
    '▇▇▇ lets you catch ▇▇▇.');
  assert.equal(L.redactSummary('Assassin’s Creed follows Altaïr.', { name: "Assassin's Creed", franchise: null }),
    '▇▇▇ follows Altaïr.');
  assert.equal(L.redactSummary('Night City, 2077.', { name: 'Cyberpunk 2077', franchise: null }), 'Night City, ▇▇▇.');
});

test('redactSummary: whole words only', () => {
  assert.equal(L.redactSummary('Doomed marines face doom.', { name: 'Doom', franchise: 'Doom' }), 'Doomed marines face ▇▇▇.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `L.summarySnippet is not a function`, `L.redactSummary is not a function`.

- [ ] **Step 3: Implement** — add to CONSTANTS in `logic.js`:
```js
const SUMMARY_SNIPPET_MAX = 220;
const REDACTED = '▇▇▇';
const REDACT_STOPWORDS = new Set(['the', 'and', 'of', 'for', 'with', 'from', 'into', 'your', 'their', 'game',
  'games', 'world', 'edition', 'remastered', 'definitive', 'complete', 'ultimate', 'deluxe', 'collection',
  'part', 'chapter', 'episode']);
```

Add to the HINTS section:
```js
// Whole sentences while the total stays within `max`; a single over-long sentence is cut at a word.
function summarySnippet(text, max = SUMMARY_SNIPPET_MAX) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  let out = '';
  for (const sentence of clean.split(/(?<=[.!?]["')\]]*)\s+/)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
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
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'gu');
  let out = '', last = 0;
  for (const m of folded.matchAll(re)) {
    out += text.slice(last, map[m.index]) + REDACTED;
    last = map[m.index + m[0].length];
  }
  return out + text.slice(last);
}
```

Extend `module.exports` with:
```js
    SUMMARY_SNIPPET_MAX, REDACTED, summarySnippet, redactSummary,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (logic gains 7 tests).

- [ ] **Step 5: Checkpoint (no commit)**

---

### Task 3: Build adds `summary` and `coverId`

**Files:**
- Modify: `scripts/transform.js`, `scripts/sources.js`, `test/transform.test.js`, `test/sources.test.js`

**Interfaces:**
- Consumes: `summarySnippet` from `../logic.js` (Task 2)
- Produces: `buildEntry(...)` returns the existing fields plus `summary: string|null` (≤ 600 chars) and `coverId: string|null`; `STORED_SUMMARY_MAX = 600` exported from `transform.js`.

- [ ] **Step 1: Update the existing `buildEntry` shape test** in `test/transform.test.js` — the expected object gains two fields:
```js
  assert.deepEqual(T.buildEntry(r, { tags: null, metacritic: null }, CFG), {
    id: 72, name: 'Portal 2', year: 2016,
    primaryTags: ['Puzzle'], secondaryTags: [],
    platforms: ['PC', 'PS4'], developers: ['Valve'],
    franchise: 'Portal', metacritic: 95,
    summary: null, coverId: null,
  });
```

- [ ] **Step 2: Append failing tests**

To `test/transform.test.js`:
```js
test('buildEntry: summary from summary, else storyline, truncated to 600; coverId from cover', () => {
  const none = { tags: null, metacritic: null };
  assert.equal(T.buildEntry(raw({ summary: 'A  short   summary.' }), none, CFG).summary, 'A short summary.');
  assert.equal(T.buildEntry(raw({ storyline: 'Only a storyline.' }), none, CFG).summary, 'Only a storyline.');
  assert.equal(T.buildEntry(raw({ summary: 'Sum.', storyline: 'Story.' }), none, CFG).summary, 'Sum.');
  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
  const stored = T.buildEntry(raw({ summary: long }), none, CFG).summary;
  assert.ok(stored.length <= T.STORED_SUMMARY_MAX && stored.endsWith('.'), stored.length);
  assert.equal(T.buildEntry(raw({ cover: { image_id: 'co1r7f' } }), none, CFG).coverId, 'co1r7f');
  assert.equal(T.buildEntry(raw(), none, CFG).coverId, null);
});
```

To `test/sources.test.js`:
```js
test('IGDB query requests summary, storyline, and cover image id', async () => {
  const fetchFn = fakeFetch(() => jsonRes([]));
  await S.fetchIgdbCandidates({ clientId: 'c', token: 't', cache: memCache(), fetchFn, delayMs: 0, log: () => {} });
  for (const f of ['summary', 'storyline', 'cover.image_id']) assert.match(fetchFn.calls[0].opts.body, new RegExp(`[ ,]${f.replace('.', '\\.')}[,;]`));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — shape test (missing `summary`/`coverId`), new transform test, new sources test.

- [ ] **Step 4: Implement**

In `scripts/transform.js`, change the logic import to:
```js
const { normalize, summarySnippet } = require('../logic.js');
```
Add near the top (after the import):
```js
const STORED_SUMMARY_MAX = 600;
```
In `buildEntry`, after `metacritic: steam.metacritic ?? igdbScore,` add:
```js
    summary: summarySnippet(raw.summary || raw.storyline, STORED_SUMMARY_MAX),
    coverId: (raw.cover && raw.cover.image_id) || null,
```
Add `STORED_SUMMARY_MAX` to `module.exports`.

In `scripts/sources.js`, change the first line of `IGDB_FIELDS` to:
```js
  'name', 'first_release_date', 'total_rating_count', 'aggregated_rating', 'summary', 'storyline', 'cover.image_id',
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Checkpoint (no commit)**

---

### Task 4: Regenerate data + data invariants

**Requires Justin's Twitch credentials.** If they were rotated since the last build (recommended), STOP and ask him for the build to be run with the new ones, e.g. in his own PowerShell: `$env:TWITCH_CLIENT_ID='…'; $env:TWITCH_CLIENT_SECRET='…'; npm run build-data`, or via the `!` prefix with bash syntax: `! TWITCH_CLIENT_ID='…' TWITCH_CLIENT_SECRET='…' npm run build-data`.

**Files:**
- Modify: `test/data.test.js`
- Generated: `data.js`, `excluded.txt`
- Delete (cache only): `scripts/.cache/igdb-*.json`

- [ ] **Step 1: Add the new invariants** to `test/data.test.js`

Inside the `for (const g of GAMES)` loop, after the metacritic assertion, add:
```js
    assert.ok(g.summary === null || (typeof g.summary === 'string' && g.summary.length <= 600), `${where} summary`);
    assert.ok(g.coverId === null || (typeof g.coverId === 'string' && g.coverId.length > 0), `${where} coverId`);
```
After the loop (before the closing `});` of the test), add:
```js
  const share = key => GAMES.filter(g => g[key]).length / GAMES.length;
  assert.ok(share('coverId') >= 0.9, `only ${Math.round(share('coverId') * 100)}% have covers`);
  assert.ok(share('summary') >= 0.8, `only ${Math.round(share('summary') * 100)}% have summaries`);
```

- [ ] **Step 2: Run tests against the old data**

Run: `npm test`
Expected: FAIL in `generated data invariants` — `only 0% have covers` (old data has no `coverId`).

- [ ] **Step 3: Refresh the IGDB cache and rebuild**

Run: `rm scripts/.cache/igdb-*.json` then the build with credentials (see box above).
Expected: Summary prints `Kept: 3000`; Steam work is mostly cached (only newly selected games fetch).

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS (all suites, including data invariants).

- [ ] **Step 5: Spot-check**

Run:
```bash
node -e "const G=require('./data.js');for(const n of ['Hollow Knight','Portal 2'])console.log(JSON.stringify((({name,summary,coverId})=>({name,summary,coverId}))(G.find(g=>g.name===n))));"
```
Expected: both have a non-null `summary` and `coverId`.

- [ ] **Step 6: Checkpoint (no commit)**

---

### Task 5: "How to play" color guide

**Files:**
- Modify: `index.html`, `style.css`, `game.js`

**Interfaces:**
- Consumes (browser globals): `YEAR_YELLOW_DELTA`, `SCORE_YELLOW_DELTA`, `SUMMARY_HINT_AFTER`, `COVER_HINT_AFTER`, `MAX_GUESSES`
- Produces: `openGuide()`, `closeGuide()`, `fillGuideConstants()`; `GUIDE_SEEN_KEY = 'gtgdle_seen_guide'`

- [ ] **Step 1: `index.html` — add the help button** inside `<header>`, directly after `<h1 class="logo">GTGdle</h1>`:
```html
      <button class="help-btn" id="btn-help" type="button" aria-label="How to play" title="How to play">?</button>
```

- [ ] **Step 2: `index.html` — add the guide modal** directly before the existing `<div class="modal" id="result-modal" hidden>`:
```html
    <div class="modal" id="guide-modal" hidden>
      <div class="modal-card guide-card" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <button class="modal-close" id="btn-guide-close" type="button" aria-label="Close">×</button>
        <h2 id="guide-title">How to play</h2>
        <p>Guess the video game in <span data-const="MAX_GUESSES"></span> tries. Each guess shows how it compares to the answer.</p>
        <table class="guide-table">
          <thead><tr><th>Column</th><th><span class="swatch green"></span>Green</th><th><span class="swatch yellow"></span>Yellow</th></tr></thead>
          <tbody>
            <tr><td>Year</td><td>Exact year</td><td>Within <span data-const="YEAR_YELLOW_DELTA"></span> years. ↑/↓ points toward the answer.</td></tr>
            <tr><td>Tags</td><td>Shares a primary tag (shown)</td><td>Shares any tag (shown)</td></tr>
            <tr><td>Platform</td><td>Same platforms</td><td>Some overlap (shared platforms shown)</td></tr>
            <tr><td>Developer</td><td>Shares a developer</td><td>—</td></tr>
            <tr><td>Franchise</td><td>Same series</td><td>—</td></tr>
            <tr><td>Metacritic</td><td>Exact score</td><td>Within <span data-const="SCORE_YELLOW_DELTA"></span>. ↑/↓ points toward the answer. N/A = no score.</td></tr>
          </tbody>
        </table>
        <p class="guide-note">Gray means no match.</p>
        <h3>Hints</h3>
        <p>After <span data-const="SUMMARY_HINT_AFTER"></span> guesses you can reveal a summary of the game (title blanked out). After <span data-const="COVER_HINT_AFTER"></span> guesses you can reveal a pixelated cover that sharpens on your next guess. Hints you use are noted in your share (💡).</p>
      </div>
    </div>
```

- [ ] **Step 3: `style.css` — append**
```css
header { position: relative; }
.help-btn {
  position: absolute; top: 0; right: 0; width: 2.2rem; height: 2.2rem; border-radius: 50%;
  border: 2px solid var(--panel-2); background: var(--panel); color: var(--text);
  font: inherit; font-weight: 700; cursor: pointer;
}
.help-btn:hover { border-color: var(--accent); }
.guide-card { width: min(620px, 100%); text-align: left; max-height: 90vh; overflow-y: auto; }
.guide-card h2 { margin-top: 0; text-align: center; }
.guide-card h3 { margin-bottom: .25rem; }
.guide-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.guide-table th, .guide-table td { padding: .45rem .5rem; border-bottom: 1px solid var(--panel-2); vertical-align: top; }
.guide-table th { text-align: left; color: var(--muted); font-weight: 600; }
.guide-table td:first-child { font-weight: 600; white-space: nowrap; }
.swatch { display: inline-block; width: .8em; height: .8em; border-radius: 2px; margin-right: .35em; vertical-align: -.05em; }
.swatch.green { background: var(--green); }
.swatch.yellow { background: var(--yellow); }
.guide-note { color: var(--muted); font-size: .85rem; }
```

- [ ] **Step 4: `game.js` — add a GUIDE section** directly above the `RESULT` section header:
```js
// ═══════════════════════════════════════════════════════════════════════════
//  GUIDE
// ═══════════════════════════════════════════════════════════════════════════
const GUIDE_SEEN_KEY = 'gtgdle_seen_guide';

function fillGuideConstants() {
  const values = { MAX_GUESSES, YEAR_YELLOW_DELTA, SCORE_YELLOW_DELTA, SUMMARY_HINT_AFTER, COVER_HINT_AFTER };
  document.querySelectorAll('[data-const]').forEach(node => { node.textContent = String(values[node.dataset.const]); });
}

function openGuide() { $('guide-modal').hidden = false; }
function closeGuide() { $('guide-modal').hidden = true; }

function openGuideOnFirstVisit() {
  try {
    if (localStorage.getItem(GUIDE_SEEN_KEY)) return;
    localStorage.setItem(GUIDE_SEEN_KEY, '1');
    openGuide();
  } catch { /* storage unavailable — skip auto-open */ }
}
```

- [ ] **Step 5: `game.js` — wire it in `boot()`.** Directly before the final `startDaily();` line in `boot()`, add:
```js
  fillGuideConstants();
  $('btn-help').addEventListener('click', openGuide);
  $('btn-guide-close').addEventListener('click', closeGuide);
  $('guide-modal').addEventListener('click', e => { if (e.target === $('guide-modal')) closeGuide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('guide-modal').hidden) closeGuide(); });
```
Directly after that `startDaily();` line, add:
```js
  openGuideOnFirstVisit();
```

- [ ] **Step 6: Tests still pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Manual check** (browser, served via `python -m http.server 8765 --bind 127.0.0.1` from `gtgdle/`, since the Chrome extension can't open `file://`)
1. Clear site storage → load → guide opens automatically; numbers show 10 / 3 / 5 / 5 / 8 (none blank).
2. Close with × → reload → guide does NOT open.
3. `?` opens it; Escape closes; clicking the dark backdrop closes; clicking inside the card does not.
4. At ~375px wide (iframe trick or devtools), the table is readable and the card scrolls.

- [ ] **Step 8: Checkpoint (no commit)**

---

### Task 6: Hint panel, pixelated cover, result cover

**Files:**
- Modify: `index.html`, `style.css`, `game.js`

**Interfaces:**
- Consumes (browser globals): `HINT_IDS`, `hintUnlocked`, `summarySnippet`, `redactSummary`, `coverUrl`, `coverPixelWidth`, `serializeState(guesses, answer, hints)`, `parseSavedState(...) → { guesses, hints }`, `buildShareText({ ..., hintsUsed })`
- Produces: `state.hints: string[]`, `saveProgress()`, `revealHint(id)`, `renderHints()`, `loadCover(url) → Promise<HTMLImageElement|null>`

- [ ] **Step 1: `index.html` — hint panel.** Directly after the closing `</section>` of `<section class="search" id="search">`, add:
```html
    <section class="hints" id="hints" hidden>
      <div class="hint" id="hint-summary" hidden>
        <button class="hint-btn" id="btn-hint-summary" type="button">💡 Show summary hint</button>
        <p class="hint-text" id="hint-summary-text" hidden></p>
      </div>
      <div class="hint" id="hint-cover" hidden>
        <button class="hint-btn" id="btn-hint-cover" type="button">💡 Show cover hint</button>
        <canvas class="hint-cover" id="hint-cover-canvas" hidden></canvas>
        <p class="hint-text" id="hint-cover-msg" hidden></p>
      </div>
    </section>
```

- [ ] **Step 2: `index.html` — result cover.** Inside the result modal card, directly after its `<button class="modal-close" id="btn-close" …>×</button>`, add:
```html
        <img class="result-cover" id="result-cover" alt="Cover art" hidden>
```

- [ ] **Step 3: `style.css` — append**
```css
.hints { max-width: 560px; margin: -0.5rem auto 1.25rem; display: grid; gap: .6rem; }
.hint { background: var(--panel); border: 1px solid var(--panel-2); border-radius: var(--radius); padding: .6rem .8rem; text-align: center; }
.hint-btn { border: 0; background: transparent; color: var(--yellow); font: inherit; font-weight: 600; cursor: pointer; }
.hint-btn:hover { text-decoration: underline; }
.hint-text { margin: 0; text-align: left; line-height: 1.45; }
.hint-cover { width: 160px; height: auto; image-rendering: pixelated; border-radius: 6px; display: block; margin: 0 auto; }
.hint-cover[hidden] { display: none; }
.result-cover { display: block; width: 140px; margin: 0 auto 1rem; border-radius: 8px; box-shadow: 0 6px 20px #0008; }
.result-cover[hidden] { display: none; }
```

- [ ] **Step 4: `game.js` — state + persistence.**

In the `state` object, after `lastAddedId: null,` add:
```js
  hints: [],
```

In `startDaily()`, replace `state.guesses = saved ? saved.guesses : [];` with:
```js
  state.guesses = saved ? saved.guesses : [];
  state.hints = saved ? saved.hints : [];
```

In `startFree()`, after `state.guesses = [];` add:
```js
  state.hints = [];
```

In `submitGuess()`, replace the whole `if (state.mode === 'daily') { … }` block with:
```js
  saveProgress();
```

Add directly after `submitGuess()`:
```js
function saveProgress() {
  if (state.mode !== 'daily') return;
  try { localStorage.setItem(storageKey(state.dateStr), serializeState(state.guesses, state.answer, state.hints)); } catch { /* storage full/blocked — play on */ }
}
```

- [ ] **Step 5: `game.js` — HINTS section.** Add directly above the `GUIDE` section header:
```js
// ═══════════════════════════════════════════════════════════════════════════
//  HINTS
// ═══════════════════════════════════════════════════════════════════════════
const coverCache = new Map(); // url → Promise<HTMLImageElement|null>

function loadCover(url) {
  if (!coverCache.has(url)) {
    coverCache.set(url, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return coverCache.get(url);
}

function revealHint(id) {
  if (!hintUnlocked(id, state.guesses.length, currentStatus()) || state.hints.includes(id)) return;
  state.hints.push(id);
  saveProgress();
  render();
}

function renderHints() {
  const status = currentStatus();
  let anyShown = false;
  for (const id of HINT_IDS) {
    const shown = hintUnlocked(id, state.guesses.length, status);
    $(`hint-${id}`).hidden = !shown;
    if (!shown) continue;
    anyShown = true;
    const revealed = state.hints.includes(id);
    $(`btn-hint-${id}`).hidden = revealed;
    if (id === 'summary') renderSummaryHint(revealed);
    else renderCoverHint(revealed);
  }
  $('hints').hidden = !anyShown;
}

function renderSummaryHint(revealed) {
  const text = $('hint-summary-text');
  text.hidden = !revealed;
  if (!revealed) return;
  const snippet = summarySnippet(state.answer.summary);
  text.textContent = snippet ? redactSummary(snippet, state.answer) : 'No description available for this game.';
}

function renderCoverHint(revealed) {
  const canvas = $('hint-cover-canvas');
  const msg = $('hint-cover-msg');
  canvas.hidden = true;
  msg.hidden = true;
  if (!revealed) return;
  const showUnavailable = () => { msg.textContent = 'Cover art unavailable for this game.'; msg.hidden = false; };
  const url = coverUrl(state.answer.coverId);
  const width = coverPixelWidth(state.guesses.length, currentStatus());
  if (!url || !width) { showUnavailable(); return; }
  const answerId = state.answer.id;
  loadCover(url).then(img => {
    if (state.answer.id !== answerId) return; // a new game started while loading
    if (!img) { showUnavailable(); return; }
    canvas.width = width;
    canvas.height = Math.max(1, Math.round(width * img.naturalHeight / img.naturalWidth));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.hidden = false;
  });
}
```

- [ ] **Step 6: `game.js` — render, result cover, share.**

In `render()`, directly before `renderResult();` add:
```js
  renderHints();
```

In `renderResult()`, directly before `modal.hidden = false;` add:
```js
  const cover = $('result-cover');
  cover.hidden = true;
  const url = coverUrl(state.answer.coverId);
  const answerId = state.answer.id;
  if (url) loadCover(url).then(img => { if (img && state.answer.id === answerId) { cover.src = url; cover.hidden = false; } });
```

In `shareResult()`, inside the `buildShareText({ … })` argument object, after `won: currentStatus() === 'won',` add:
```js
    hintsUsed: state.hints.length,
```

In `boot()`, directly after `$('btn-new').addEventListener('click', startFree);` add:
```js
  $('btn-hint-summary').addEventListener('click', () => revealHint('summary'));
  $('btn-hint-cover').addEventListener('click', () => revealHint('cover'));
```

- [ ] **Step 7: Tests still pass; syntax check**

Run: `node --check game.js && npm test`
Expected: PASS.

- [ ] **Step 8: Manual check** (browser via local server; drive guesses with `submitGuess(...)` in the console to save time)
1. Free Play: after 4 wrong guesses no hint panel; after the 5th, "💡 Show summary hint" appears. Click → summary shows with the title blanked out (compare against `state.answer.name`).
2. After the 8th wrong guess, "💡 Show cover hint" appears. Click → a very blocky cover. Make the 9th guess → noticeably clearer.
3. Finish (win or lose) → hint panel hides; result popup shows the clear cover; Share text header ends with ` 💡2`.
4. Daily: reveal the summary hint at 5 guesses → reload → hint still revealed, button gone.
5. Game with no summary: in console `state.answer = {...state.answer, summary: null, coverId: null}; state.hints = ['summary','cover']; state.guesses = GAMES.filter(g => g.id !== state.answer.id).slice(0, 8); render();` → both fallback messages show, nothing broken.
6. Image failure: devtools → block request URL pattern `images.igdb.com` (or temporarily set `state.answer.coverId = 'nonexistent'` and re-render) → "Cover art unavailable for this game."
7. Race: Free Play at 8 guesses, reveal cover, immediately click Free Play again → new board shows no stale cover.
8. Console has no errors throughout.

- [ ] **Step 9: Final verification**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 10: Checkpoint (no commit)** — report to Justin for review and commit.
