'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'data.js');
const skip = !fs.existsSync(DATA) && 'data.js not generated yet (run npm run build-data)';

test('generated data invariants', { skip }, () => {
  const GAMES = require(DATA);
  const config = require('../scripts/config.js');
  const { startsWithWords } = require('../scripts/transform.js');
  const { normalize } = require('../logic.js');

  assert.ok(GAMES.length >= 2500 && GAMES.length <= 3000, `count ${GAMES.length}`);
  assert.equal(new Set(GAMES.map(g => g.id)).size, GAMES.length, 'unique ids');
  assert.equal(new Set(GAMES.map(g => `${normalize(g.name)}|${g.year}`)).size, GAMES.length, 'unique name+year');

  for (const g of GAMES) {
    const where = `${g.name} (${g.id})`;
    assert.equal(typeof g.id, 'number', where);
    assert.ok(typeof g.name === 'string' && g.name.length, where);
    assert.ok(Number.isInteger(g.year) && g.year >= 1970 && g.year <= 2027, `${where} year ${g.year}`);
    assert.ok(g.primaryTags.length <= 5, `${where} primaryTags`);
    assert.ok(g.primaryTags.length + g.secondaryTags.length >= 1, `${where} has no tags`);
    assert.ok(g.secondaryTags.length <= 15, `${where} secondaryTags`);
    for (const k of ['primaryTags', 'secondaryTags', 'platforms', 'developers']) {
      assert.ok(Array.isArray(g[k]) && g[k].every(s => typeof s === 'string'), `${where} ${k}`);
    }
    assert.ok(g.franchise === null || typeof g.franchise === 'string', `${where} franchise`);
    assert.ok(g.metacritic === null || (Number.isInteger(g.metacritic) && g.metacritic >= 0 && g.metacritic <= 100), `${where} metacritic`);
    assert.ok(g.summary === null || (typeof g.summary === 'string' && g.summary.length <= 600), `${where} summary`);
    assert.ok(g.coverId === null || (typeof g.coverId === 'string' && g.coverId.length > 0), `${where} coverId`);
    if (!config.forceInclude.includes(g.id)) {
      const names = [g.name, g.franchise].filter(Boolean);
      const hit = config.blockedFranchises.find(b => names.some(n => startsWithWords(n, b)));
      assert.equal(hit, undefined, `${where} is blocklisted (${hit})`);
    }
  }
  const share = key => GAMES.filter(g => g[key]).length / GAMES.length;
  assert.ok(share('coverId') >= 0.9, `only ${Math.round(share('coverId') * 100)}% have covers`);
  assert.ok(share('summary') >= 0.8, `only ${Math.round(share('summary') * 100)}% have summaries`);
});
