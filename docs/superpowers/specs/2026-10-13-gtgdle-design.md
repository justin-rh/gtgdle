# GTGdle (working title) — Design Spec

**Date:** 2026-10-13
**Status:** Draft — awaiting review
**Name:** "GTGdle" is a placeholder; final name TBD by Justin (cosmetic only, does not block implementation).

## 1. Purpose

A Spotle-style daily guessing game for video games. Casual side project for friends and
coworkers — a static page shared by link, modeled on the existing Batootle game in `../uncdle/`.

**Success looks like:** a friend opens the page, guesses today's game within 10 tries using
column feedback, and shares an emoji result grid. Clues should feel fair: answers are
recognizable games, and the feedback narrows the field meaningfully each guess.

## 2. Scope

**In:**
- Daily mode (date-seeded answer, same for everyone) and Free Play mode (random answer)
- 10 guesses via autocomplete search
- Six feedback columns: Year, Tags, Platform, Developer, Franchise, Metacritic
- Share-as-emoji-grid, daily progress persisted in `localStorage`
- One-shot Node build script that produces the bundled game dataset

**Out (YAGNI):** accounts, backend, live API calls at runtime, stats/streak dashboards beyond
what Batootle has, hints, hard mode, leaderboards, mobile app wrappers.

## 3. Architecture

Plain static site, no framework, no bundler — opens directly from disk or any static host.

```
gtgdle/
  index.html          page shell, column headers, mode toggle
  style.css           visuals
  logic.js            PURE functions: comparisons, seeding, normalization (no DOM)
  game.js             DOM, state, input, rendering, share, localStorage
  data.js             GENERATED — `const GAMES = [...]`
  scripts/
    build-data.js     Node script: IGDB + SteamSpy + Steam store → data.js
    config.js         blocklists, allowlists, platform map, tag aliases, overrides
    .cache/           raw API responses (gitignored) so reruns are cheap
  excluded.txt        GENERATED — every dropped game and why
  test/
    logic.test.js     node:test unit tests for logic.js
    data.test.js      shape/invariant checks on data.js
```

`logic.js` is loaded by a `<script>` tag in the browser and also `require`d by tests
(`if (typeof module !== 'undefined') module.exports = {...}`). This separation is the main
structural change from Batootle, where comparison logic lives inside `game.js`.

## 4. Data model

Each entry in `GAMES`:

```js
{
  id: 1942,                         // IGDB id (stable, unique)
  name: "The Witcher 3: Wild Hunt",
  year: 2015,
  primaryTags: ["Open World", "RPG", "Story Rich", "Atmospheric", "Fantasy"],
  secondaryTags: ["Mature", "Choices Matter", "Third Person", ...],
  platforms: ["PC", "PS4", "Xbox One", "Switch", "PS5", "Xbox Series"],
  developers: ["CD Projekt RED"],
  franchise: "The Witcher",         // or null
  metacritic: 93                    // integer 0–100, or null
}
```

## 5. Data pipeline (`scripts/build-data.js`)

Run manually: `TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... node scripts/build-data.js`.
Credentials come from a free Twitch developer app; they are never written into output files.

**Step 1 — IGDB candidate list.**
OAuth via Twitch client-credentials, then page `POST https://api.igdb.com/v4/games`
(500/request, ≤4 req/s). Filters: main games and remakes/remasters only (no DLC, bundles,
episodes, mods), has `first_release_date`, sorted by `total_rating_count` desc. Fetch
~5,000 candidates so ~3,000 survive exclusions.
Fields: name, first_release_date, genres, themes, keywords, platforms,
involved_companies (company name + developer flag), franchises, collection,
aggregated_rating, total_rating_count, external_games (to find the Steam app id).

**Step 2 — Exclusions** (rules in `config.js`), each logged to `excluded.txt` with a reason:
1. *Franchise blocklist* (always excluded): Call of Duty, Battlefield, FIFA, EA Sports FC,
   Madden NFL, NBA 2K, NBA Live, NHL, MLB The Show, Pro Evolution Soccer, eFootball,
   WWE 2K / SmackDown, F1 (Codemasters/EA series), NCAA / College Football, PGA Tour,
   Medal of Honor, Tom Clancy's Ghost Recon, Tom Clancy's Rainbow Six, Sniper Elite,
   Sniper: Ghost Warrior, Homefront. Matched against IGDB franchise/collection names and a
   name-prefix fallback. Non-generic shooters (Halo, Doom, Half-Life, BioShock, Titanfall,
   Portal, Crysis) are not affected.
2. *Sport genre filter:* drop games whose IGDB genres include "Sport" unless on the sport
   allowlist: Rocket League, Wii Sports (+ Resort), Mario Tennis / Golf / Strikers /
   Power Tennis, Punch-Out!!, Tony Hawk's Pro Skater series, NBA Jam, Windjammers,
   Mutant League, Mario & Sonic at the Olympic Games, Golf Story, OlliOlli, Skate series,
   Sega Superstars Tennis.
3. *Manual overrides* in `config.js`: `forceInclude: [igdbId...]` and
   `forceExclude: [igdbId...]` — the one-line escape hatch after reviewing `excluded.txt`.
4. *Duplicate collapse:* if two entries share a normalized name, keep the higher
   `total_rating_count`.

Take the top 3,000 survivors by `total_rating_count`.

**Step 3 — Steam enrichment** (only for games with a Steam app id):
- `https://steamspy.com/api.php?request=appdetails&appid=X` → `tags` object ordered by vote
  count. Primary = top 5, secondary = ranks 6–20. Rate limit 1 req/s; responses cached in
  `scripts/.cache/` so a full first run (~50 min worst case) is only paid once.
- `https://store.steampowered.com/api/appdetails?appids=X` → `metacritic.score` if present.

**Step 4 — Field derivation:**
| Field | Source |
|---|---|
| `year` | IGDB `first_release_date` (UTC year) |
| `primaryTags` | Steam top 5; else IGDB genres + themes |
| `secondaryTags` | Steam ranks 6–20; else IGDB keywords (first 15) |
| `platforms` | IGDB platforms → normalized via `platformMap` (e.g. Windows/Mac/Linux → "PC", "PlayStation 4" → "PS4"); deduped; unmapped platforms dropped and logged |
| `developers` | IGDB involved_companies where `developer = true` |
| `franchise` | IGDB first franchise; else collection; else `null` |
| `metacritic` | Steam store metacritic; else IGDB `aggregated_rating` rounded; else `null` |

**Tag normalization:** Steam and IGDB name things differently ("Role-playing (RPG)" vs "RPG").
All tags pass through `tagAliases` in `config.js` so both vocabularies land on one name.
Secondary tags that duplicate a primary tag are removed.

**Output:** `data.js` (`const GAMES = [...]`, sorted by name) and `excluded.txt`.

## 6. Gameplay

- **Daily:** answer = `GAMES[floor(mulberry32(yyyymmdd)() * GAMES.length)]` (same approach as
  Batootle). Day number counts from `2026-10-13`. Because the answer depends on array length
  and order, regenerating `data.js` changes future daily answers — acceptable for a casual game.
- **Free Play:** random answer; "New game" button after finish.
- **Guessing:** text box with autocomplete over `GAMES` names (case/punctuation-insensitive
  substring match, up to 8 suggestions, each showing name + year to disambiguate). Only
  games in the list can be submitted; duplicate guesses are rejected.
- **Win:** guess `id === answer.id`. **Lose:** 10 wrong guesses → answer revealed.
- **Persistence:** daily guesses saved under a `localStorage` key per date; reload restores
  the board. Free Play is not persisted.
- **Share:** emoji grid (🟩🟨⬛ per column, one row per guess) plus "GTGdle #N X/10".

## 7. Column rules (`logic.js`)

Each comparison returns `{ status: 'green'|'yellow'|'gray', display, arrow? }`.

| Column | Green | Yellow | Gray | Display |
|---|---|---|---|---|
| **Year** | equal | \|Δ\| ≤ 3 | otherwise | guess year + ↑ (answer later) / ↓ (answer earlier) when not green |
| **Tags** | guess.primary ∩ answer.primary ≠ ∅ | otherwise, (guess.primary ∪ guess.secondary) ∩ (answer.primary ∪ answer.secondary) ≠ ∅ | no overlap | the matched tags (up to 3, "+N" if more); gray shows "No match" |
| **Platform** | sets equal | sets overlap | disjoint | green: all; yellow: shared platforms; gray: guess's platforms |
| **Developer** | any shared developer | — | none shared | guess's developer(s) |
| **Franchise** | both non-null and equal | — | otherwise | guess's franchise or "—" |
| **Metacritic** | equal | \|Δ\| ≤ 5 | otherwise | guess score + ↑/↓; if either side is `null`: gray, shows "N/A", no arrow |

Comparisons are case-insensitive on normalized strings.

## 8. UI

Follows Batootle's layout: header with title, mode toggle, guess pips; column headers with
hover tooltips explaining each rule; one row of six tiles per guess, newest on top; result
modal with share button. Visual styling decided during implementation (frontend-design
pass), dark theme, responsive down to phone width (tiles wrap text, tags shrink).

## 9. Error handling

- **Build script:** fails fast with a clear message on missing credentials or IGDB auth
  failure. Individual SteamSpy/Steam failures are retried once, then the game falls back to
  IGDB-derived tags/score and the fallback is logged. Script prints a summary: total kept,
  excluded by reason, % with Steam tags, % with null metacritic.
- **Game:** if `GAMES` is missing or empty, show an error banner instead of a broken board.
  Corrupt `localStorage` is discarded silently.

## 10. Testing

- `node --test test/` — no dependencies.
- `logic.test.js`: every column rule including boundaries (Δ=3/4 years, Δ=5/6 score,
  null metacritic, null franchise both sides, equal vs overlapping platforms, primary vs
  secondary tag overlap, display truncation), seeded daily pick is deterministic,
  name normalization.
- `data.test.js`: unique ids and names, required fields present with correct types,
  1 ≤ primaryTags ≤ 5, no blocklisted franchise present, count between 2,500 and 3,000.
- Manual: play a daily and a free-play game in the browser end to end, including reload
  mid-game and the share text.
