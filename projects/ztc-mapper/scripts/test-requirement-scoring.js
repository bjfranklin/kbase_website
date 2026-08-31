#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    // A multi-course option is completable');
const end = html.indexOf('    // ---- Area ordering / nesting helpers ----');

assert.notEqual(start, -1, 'requirement-scoring helper start marker is missing');
assert.notEqual(end, -1, 'requirement-scoring helper end marker is missing');
assert.ok(end > start, 'requirement-scoring helper markers are out of order');

const context = {
  ZTC_THRESHOLDS: { ZTC_MIN: 75 }
};
vm.runInNewContext(
  `${html.slice(start, end)}
  this.optionIsZtc = optionIsZtc;
  this.scoreAreaRequirements = scoreAreaRequirements;`,
  context
);

const ztc = { offered: true, ztcPct: 100 };
const unavailable = { offered: false, ztcPct: null };
const unknown = { offered: false, ztcPct: null };

const aiScore = context.scoreAreaRequirements(
  [ztc, unavailable, ztc, unknown],
  [],
  false
);
assert.equal(aiScore.reqTotal, 4);
assert.equal(aiScore.reqZtc, 2);
assert.equal(Math.round((aiScore.reqZtc / aiScore.reqTotal) * 100), 50);
assert.equal(aiScore.displayTotal, 4);

const unavailableChoice = context.scoreAreaRequirements(
  [unavailable, unknown],
  [],
  true
);
assert.equal(unavailableChoice.reqTotal, 1);
assert.equal(unavailableChoice.reqZtc, 0);

assert.equal(
  context.optionIsZtc([ztc, unavailable]),
  false,
  'an AND bundle with an unavailable member must not be ZTC-completable'
);

const structuredScore = context.scoreAreaRequirements(
  [],
  [{ ztcOk: true }, { ztcOk: false }],
  false
);
assert.equal(structuredScore.reqTotal, 2);
assert.equal(structuredScore.reqZtc, 1);

console.log('Requirement scoring regression tests passed.');
