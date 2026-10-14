'use strict';

// ═══════════════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════════════
const state = {
  mode: 'daily',
  dateStr: todayStr(),
  answer: null,
  guesses: [],
  suggestions: [],
  highlighted: -1,
  lastAddedId: null,
  hints: [],
};

const $ = id => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function storageKey(dateStr) { return `gtgdle_${dateStr}`; }
function currentStatus() { return gameStatus(state.guesses, state.answer); }

// ═══════════════════════════════════════════════════════════════════════════
//  GAME FLOW
// ═══════════════════════════════════════════════════════════════════════════
function startDaily() {
  resultDismissed = false;
  state.mode = 'daily';
  state.dateStr = todayStr();
  state.answer = pickDaily(GAMES, state.dateStr);
  let saved = null;
  try { saved = parseSavedState(localStorage.getItem(storageKey(state.dateStr)), GAMES, state.answer); } catch { saved = null; }
  state.guesses = saved ? saved.guesses : [];
  state.hints = saved ? saved.hints : [];
  state.lastAddedId = null;
  render();
}

function startFree() {
  resultDismissed = false;
  state.mode = 'free';
  state.answer = pickRandom(GAMES);
  state.guesses = [];
  state.hints = [];
  state.lastAddedId = null;
  render();
}

function submitGuess(game) {
  if (currentStatus() !== 'playing') return;
  if (state.guesses.some(g => g.id === game.id)) { flash('Already guessed'); return; }
  state.guesses.push(game);
  state.lastAddedId = game.id;
  saveProgress();
  $('guess-input').value = '';
  closeSuggestions();
  render();
}

function saveProgress() {
  if (state.mode !== 'daily') return;
  try { localStorage.setItem(storageKey(state.dateStr), serializeState(state.guesses, state.answer, state.hints)); } catch { /* storage full/blocked — play on */ }
}

function flash(message) {
  $('flash').textContent = message;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { $('flash').textContent = ''; }, 2000);
}

// ═══════════════════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════════════════
function render() {
  renderHeader();
  renderPips();
  renderRows();
  const playing = currentStatus() === 'playing';
  $('guess-input').disabled = !playing;
  $('guess-input').placeholder = playing ? `Guess ${state.guesses.length + 1} of ${MAX_GUESSES}…` : 'Game over';
  renderHints();
  renderResult();
}

function renderHeader() {
  $('btn-daily').classList.toggle('active', state.mode === 'daily');
  $('btn-free').classList.toggle('active', state.mode === 'free');
  $('day-label').textContent = state.mode === 'daily'
    ? `#${dayNumber(state.dateStr)} · ${new Date(`${state.dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : 'Free Play — random game';
}

function renderPips() {
  const pips = $('pips');
  pips.replaceChildren();
  const won = currentStatus() === 'won';
  for (let i = 0; i < MAX_GUESSES; i++) {
    const pip = el('span', 'pip');
    if (i < state.guesses.length) pip.classList.add(won && i === state.guesses.length - 1 ? 'win' : 'used');
    pips.appendChild(pip);
  }
}

function renderRows() {
  const rows = $('rows');
  rows.replaceChildren();
  [...state.guesses].reverse().forEach(g => rows.appendChild(renderRow(g, compareGuess(g, state.answer))));
}

function renderRow(game, result) {
  const row = el('div', 'row');
  if (game.id === state.lastAddedId) row.classList.add('new');

  const name = el('div', 'row-name', `${game.name} `);
  name.appendChild(el('span', 'year', `(${game.year})`));
  if (game.id === state.answer.id) name.classList.add('correct');
  row.appendChild(name);

  const tiles = el('div', 'tiles');
  COLUMNS.forEach((col, i) => {
    const cell = result[col];
    const tile = el('div', `tile ${cell.status}`);
    tile.style.setProperty('--i', i);
    tile.appendChild(el('span', 'tile-value', cell.display));
    if (cell.arrow) tile.appendChild(el('span', 'tile-arrow', cell.arrow === 'up' ? '↑' : '↓'));
    if (col === 'tags' && cell.matched && cell.matched.length > TAG_DISPLAY_LIMIT) tile.title = cell.matched.join(', ');
    tiles.appendChild(tile);
  });
  row.appendChild(tiles);
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════════════════════
function updateSuggestions() {
  const guessedIds = new Set(state.guesses.map(g => g.id));
  state.suggestions = searchGames(GAMES, $('guess-input').value, guessedIds);
  state.highlighted = state.suggestions.length ? 0 : -1;
  renderSuggestions();
}

function renderSuggestions() {
  const list = $('suggestions');
  list.replaceChildren();
  state.suggestions.forEach((g, i) => {
    const li = el('li', i === state.highlighted ? 'highlighted' : '');
    li.setAttribute('role', 'option');
    li.appendChild(el('span', 'name', g.name));
    li.appendChild(el('span', 'year', String(g.year)));
    li.addEventListener('mousedown', e => { e.preventDefault(); submitGuess(g); });
    list.appendChild(li);
  });
  list.hidden = state.suggestions.length === 0;
}

function closeSuggestions() {
  state.suggestions = [];
  state.highlighted = -1;
  renderSuggestions();
}

function onInputKey(e) {
  const n = state.suggestions.length;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); state.highlighted = (state.highlighted + 1) % n; renderSuggestions(); }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); state.highlighted = (state.highlighted - 1 + n) % n; renderSuggestions(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.highlighted >= 0) submitGuess(state.suggestions[state.highlighted]);
    else if ($('guess-input').value.trim()) flash('Pick a game from the list');
  }
  else if (e.key === 'Escape') closeSuggestions();
}

// ═══════════════════════════════════════════════════════════════════════════
//  HINTS
// ═══════════════════════════════════════════════════════════════════════════
const coverCache = new Map(); // url → Promise<HTMLImageElement|null>
let wordContextCache = null;

function wordContext() {
  if (!wordContextCache) wordContextCache = buildWordContext(GAMES);
  return wordContextCache;
}

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
  const hint = summaryHintText(state.answer, state.guesses.length, wordContext());
  text.textContent = hint || 'No description available for this game.';
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
// ═══════════════════════════════════════════════════════════════════════════
//  GUIDE
// ═══════════════════════════════════════════════════════════════════════════
const GUIDE_SEEN_KEY = 'gtgdle_seen_guide';

function fillGuideConstants() {
  const values = { MAX_GUESSES, YEAR_YELLOW_DELTA, SCORE_YELLOW_DELTA, SUMMARY_HINT_AFTER, COVER_HINT_AFTER, PROPER_NOUN_REVEAL_AFTER };
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
// ═══════════════════════════════════════════════════════════════════════════
//  RESULT
// ═══════════════════════════════════════════════════════════════════════════
let resultDismissed = false;

function renderResult() {
  const status = currentStatus();
  const modal = $('result-modal');
  if (status === 'playing' || resultDismissed) { modal.hidden = true; return; }

  $('result-title').textContent = status === 'won'
    ? `You got it in ${state.guesses.length}!`
    : 'Out of guesses';
  const answer = $('result-answer');
  answer.replaceChildren('The answer was ', el('strong', '', state.answer.name), ` (${state.answer.year}).`);
  $('btn-new').hidden = state.mode !== 'free';
  $('share-fallback').hidden = true;
  $('share-msg').textContent = '';
  const cover = $('result-cover');
  cover.hidden = true;
  const url = coverUrl(state.answer.coverId);
  const answerId = state.answer.id;
  if (url) loadCover(url).then(img => { if (img && state.answer.id === answerId) { cover.src = url; cover.hidden = false; } });
  modal.hidden = false;
}

function shareResult() {
  const text = buildShareText({
    mode: state.mode,
    dateStr: state.dateStr,
    results: state.guesses.map(g => compareGuess(g, state.answer)),
    won: currentStatus() === 'won',
    hintsUsed: state.hints.length,
  });
  const showFallback = () => {
    $('share-fallback').textContent = text;
    $('share-fallback').hidden = false;
    $('share-msg').textContent = 'Copy the text above';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => { $('share-msg').textContent = 'Copied to clipboard!'; }, showFallback);
  } else {
    showFallback();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════════════
function boot() {
  if (typeof GAMES === 'undefined' || !Array.isArray(GAMES) || GAMES.length === 0) {
    $('error-banner').hidden = false;
    $('search').hidden = true;
    return;
  }
  $('btn-daily').addEventListener('click', startDaily);
  $('btn-free').addEventListener('click', startFree);
  $('guess-input').addEventListener('input', updateSuggestions);
  $('guess-input').addEventListener('keydown', onInputKey);
  $('guess-input').addEventListener('blur', closeSuggestions);
  $('btn-share').addEventListener('click', shareResult);
  $('btn-new').addEventListener('click', startFree);
  $('btn-hint-summary').addEventListener('click', () => revealHint('summary'));
  $('btn-hint-cover').addEventListener('click', () => revealHint('cover'));
  $('btn-close').addEventListener('click', () => { resultDismissed = true; $('result-modal').hidden = true; });
  $('result-modal').addEventListener('click', e => {
    if (e.target === $('result-modal')) { resultDismissed = true; $('result-modal').hidden = true; }
  });
  fillGuideConstants();
  $('btn-help').addEventListener('click', openGuide);
  $('btn-guide-close').addEventListener('click', closeGuide);
  $('guide-modal').addEventListener('click', e => { if (e.target === $('guide-modal')) closeGuide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('guide-modal').hidden) closeGuide(); });
  startDaily();
  openGuideOnFirstVisit();
}

boot();
