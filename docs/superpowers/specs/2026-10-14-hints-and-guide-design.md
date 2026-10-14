# GTGdle — Hints + Color Guide Design Spec

**Date:** 2026-10-14
**Status:** Draft — awaiting review
**Builds on:** `2026-10-13-gtgdle-design.md` (all of its rules still hold unless changed here)

## 1. Purpose

Two additions requested by Justin after playing the first build:

1. A place that explains what green and yellow mean for every column.
2. A hint system for players who are stuck late in a game.

**Success looks like:** a first-time player understands the colors without hovering headers, and a
player stuck at guess 6+ can get a nudge that helps without simply giving the answer away.

## 2. Scope

**In:** "How to play" modal (auto-opens on first visit), two click-to-reveal hints (redacted summary,
pixelated cover), hint count in share text, hints persisted in daily progress, data build adds
summary + cover id.

**Out (YAGNI):** hint penalties, more than two hints, choosing hint order, showing the full summary in
the result popup, caching cover images locally.

## 3. Color guide ("How to play")

- A `?` button in the header opens a modal. It closes via ×, backdrop click, or Escape.
- Content: one-line goal ("Guess the game in 10 tries"), then a table:

| Column | 🟩 Green | 🟨 Yellow | Notes |
|---|---|---|---|
| Year | exact | within 3 years | ↑/↓ points toward the answer |
| Tags | shares a primary tag | shares any tag | matched tags are shown |
| Platform | same platforms | some overlap | shared platforms are shown |
| Developer | shares a developer | — | |
| Franchise | same series | — | |
| Metacritic | exact | within 5 | ↑/↓ points toward the answer; N/A = no score |

- Plus a short "Hints" paragraph: summary unlocks after 5 guesses, cover after 8; using one is noted
  in your share.
- Auto-opens on the first visit only (`localStorage` key `gtgdle_seen_guide`). If localStorage is
  unavailable, it does not auto-open (no crash).
- Thresholds in the text come from the same constants the logic uses, so they cannot drift.
- Existing column-header tooltips stay.

## 4. Hints

### 4.1 Unlocking and revealing
- `summary` hint unlocks when `guesses.length >= 5` and the game is still playing.
- `cover` hint unlocks when `guesses.length >= 8` and the game is still playing.
- An unlocked, unrevealed hint shows a button ("💡 Show summary hint" / "💡 Show cover hint").
  Clicking reveals it; it stays revealed for the rest of that game.
- Hints cost nothing; the only consequence is the share text (§4.5).
- A hint that unlocked but was never revealed is simply not used.

### 4.2 Summary hint
- Source: game `summary`, else `null` (build already falls back to IGDB `storyline`; §5).
- Shown text: the first sentences of the summary, added one at a time while the total stays
  ≤ 220 characters; at least one sentence is always used, cut at a word boundary with "…" if that
  single sentence exceeds 220.
- Redaction (case- and accent-insensitive, whole words only, longest term first), replaced with
  `▇▇▇`:
  - the full game name;
  - the main title — the part before the first `:` or ` - ` (e.g. "Hollow Knight: Silksong" →
    "Hollow Knight");
  - the franchise name, if any;
  - each word of the name with 4+ letters that is not in the stopword list:
    `the, and, of, for, with, from, into, your, their, game, games, world, edition, remastered,
    definitive, complete, ultimate, deluxe, collection, part, chapter, episode`.
- Possessives and punctuation around a redacted word stay ("Zelda's" → "▇▇▇'s").
- If the game has no summary: the revealed hint reads "No description available for this game." and
  still counts as used.

### 4.3 Cover hint
- Image: `https://images.igdb.com/igdb/image/upload/t_cover_big/<coverId>.jpg`, loaded at runtime.
  This is the only network use during play besides Google Fonts.
- Pixelation: the image is drawn onto a tiny canvas then scaled up with
  `image-rendering: pixelated`. Pixel width by state:
  - 8 guesses made → 10 px wide (very blocky);
  - 9+ guesses made → 24 px wide (clearer);
  - game over → the full image in the result popup (§4.4).
  The canvas is never read back, so the cross-origin image needs no CORS.
- If `coverId` is null or the image fails to load: "Cover art unavailable for this game." (still
  counts as used).

### 4.4 Result popup
- When the game ends, the popup shows the answer's cover at full resolution above the answer name
  (when a cover exists and loads; otherwise nothing extra).

### 4.5 Share text
- If any hints were revealed, the header line gets ` 💡N` appended:
  `GTGdle #2 6/10 💡2`, `GTGdle (Free Play) X/10 💡1`. No hints → unchanged.

### 4.6 Persistence
- Daily save becomes `{ answerId, guessIds, hints }`, where `hints` is an array of revealed hint ids
  (`'summary'`, `'cover'`).
- Saves without `hints` (from before this change) load with no hints revealed.
- Unknown hint ids in a save are ignored. Free Play is still not persisted.

## 5. Data changes

- IGDB query adds fields `summary`, `storyline`, `cover.image_id`.
- Each `GAMES` entry gains:
  - `summary`: IGDB `summary`, else `storyline`, else `null`; whitespace collapsed; truncated at a
    sentence boundary to ≤ 600 characters to bound `data.js` size (one sentence minimum, cut at a
    word with "…" if that sentence alone is longer).
  - `coverId`: `cover.image_id` string, else `null`.
- Redaction happens in the browser, not the build, so the stored summary stays unredacted.
- Rebuild cost: the IGDB page cache must be refreshed (delete `scripts/.cache/igdb-*.json`), ~10
  requests; Steam caches are reused.

## 6. Code layout

- `logic.js` (pure, tested): `SUMMARY_HINT_AFTER = 5`, `COVER_HINT_AFTER = 8`, `hintUnlocked`,
  `summarySnippet`, `redactSummary`, `coverPixelWidth`, `coverUrl`, share text 💡 suffix,
  `serializeState`/`parseSavedState` with hints.
- `scripts/transform.js`: `buildEntry` adds `summary`, `coverId`; helper for build-time truncation.
- `scripts/sources.js`: field list.
- `game.js`, `index.html`, `style.css`: guide modal, hint panel, pixelated canvas, result cover.

## 7. Error handling

- Missing summary / cover / image load failure → friendly message, never a broken panel.
- localStorage unavailable → guide never auto-opens, hints not persisted; play continues.
- Corrupt saves still fall back to a fresh board (existing behavior).

## 8. Testing

- Unit (`node --test`): unlock thresholds (4/5 and 7/8 boundaries, not after game over); snippet
  length rules incl. single long sentence; redaction of full name, main title, franchise, title words,
  stopwords kept, possessives, accents, longest-first; `coverPixelWidth` by guess count and status;
  share suffix present/absent; save round-trip with hints, old-format save, unknown hint ids;
  `buildEntry` summary/storyline fallback, truncation, `coverId`.
- `data.test.js`: `summary` is string ≤ 600 or null; `coverId` is string or null; at least 90% of
  games have a coverId and 80% a summary (catches a broken query).
- Manual (browser): guide auto-opens once then not again; ? reopens; Escape closes; hints appear at
  5 and 8; summary redacts the title; cover blocky at 8, clearer at 9, full in result popup; share
  shows 💡N; reload mid-game keeps revealed hints; image blocked → fallback message.
