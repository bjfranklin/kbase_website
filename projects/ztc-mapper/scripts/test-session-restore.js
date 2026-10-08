#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    // PRODUCTION MODEL TEST START');
const end = html.indexOf('    // PRODUCTION MODEL TEST END');

assert.notEqual(start, -1, 'production model start marker is missing');
assert.notEqual(end, -1, 'production model end marker is missing');

const context = {};
vm.runInNewContext(
  `${html.slice(start, end)}
  this.validatePersistedDataset = validatePersistedDataset;
  this.validatePersistedUiState = validatePersistedUiState;`,
  context
);

const dataset = {
  programs: [{ name: 'Example A.S.', type: 'Degree', areas: [] }],
  analytics: { index: { 'BUSL-400': {} } },
  terms: ['2026/FA', '2027/SP'],
  selectedTerm: '2026/FA',
  savedAt: '2026-10-08T00:00:00.000Z'
};

const normalized = context.validatePersistedDataset(dataset);
assert.equal(normalized.schemaVersion, 1, 'schema-less v3 payloads must migrate in memory');
assert.equal(normalized.selectedTerm, '2026/FA');
assert.equal(normalized.programs[0].type, 'Degree', 'a valid type string is kept as-is');

// A header-only Active pathway (no course keys) is legitimate: it parses to
// zero requirement areas and renders as "no score". It must survive restore.
const headerOnly = context.validatePersistedDataset({
  ...dataset,
  programs: [...dataset.programs, { name: 'Header Only Certificate', type: 'Certificate', areas: [] }]
});
assert.equal(headerOnly.programs.length, 2);

// Saved payloads that predate `type` (or carry a non-string) re-derive it from
// the name instead of being rejected or leaking `undefined` into the type filter.
const retyped = context.validatePersistedDataset({
  ...dataset,
  programs: [
    { name: 'Business Administration AS-T', areas: [] },
    { name: 'Welding Certificate', type: 42, areas: [] },
    { name: 'IGETC', type: '   ', areas: [] }
  ]
});
assert.deepEqual(
  retyped.programs.map(p => p.type),
  ['Transfer Degree', 'Certificate', 'GE / Transfer Pattern']
);
assert.ok(retyped.programs.every(p => typeof p.type === 'string' && p.type.trim()));

// An unknown selectedTerm falls back to the latest term.
assert.equal(
  context.validatePersistedDataset({ ...dataset, selectedTerm: '1900/SP' }).selectedTerm,
  '2027/SP'
);

assert.throws(
  () => context.validatePersistedDataset({ programs: [], analytics: { index: {} }, terms: [] }),
  /no active pathways/i
);
assert.throws(
  () => context.validatePersistedDataset({ ...dataset, schemaVersion: 99 }),
  /unsupported schema/i
);
assert.throws(
  () => context.validatePersistedDataset({ ...dataset, analytics: {} }),
  /analytics/i
);
assert.throws(
  () => context.validatePersistedDataset({
    ...dataset,
    programs: [{ name: 'Broken', type: 'Degree' }]
  }),
  /pathway data/i
);

const restoredUi = context.validatePersistedUiState({
  schemaVersion: 1,
  selectedTerm: '2027/SP',
  selectedProgram: 'Example A.S.',
  selectedCourseKey: 'BUSL-400',
  primaryView: 'courses',
  search: 'business',
  typeFilter: 'Degree',
  pathwayAdoptionFilter: 'high',
  courseStatusFilter: 'ztc',
  sortBy: 'survey',
  dashboardOpen: true
}, normalized);
assert.equal(restoredUi.selectedTerm, '2027/SP');
assert.equal(restoredUi.primaryView, 'courses');
assert.equal(restoredUi.dashboardOpen, true);

const rejectedUi = context.validatePersistedUiState({
  schemaVersion: 1,
  selectedTerm: '1900/SP',
  selectedProgram: 'Unknown',
  selectedCourseKey: 'NOPE-1',
  primaryView: 'invalid',
  pathwayAdoptionFilter: 'invalid',
  courseStatusFilter: 'invalid',
  sortBy: 'invalid'
}, normalized);
assert.equal(rejectedUi.selectedTerm, '2026/FA');
assert.equal(rejectedUi.selectedProgram, 'Example A.S.');
assert.equal(rejectedUi.selectedCourseKey, 'BUSL-400');
assert.equal(rejectedUi.primaryView, 'program');
assert.equal(rejectedUi.pathwayAdoptionFilter, 'all');

// Source contract for the parts that live inside the App component and cannot
// run under `vm` without React. Each check is a single, specific line so an
// unrelated edit elsewhere in the file cannot satisfy it by accident.
const appSource = html.slice(end);
assert.match(appSource, /class AppErrorBoundary extends React\.Component/);
assert.match(html, /const UI_STORAGE_KEY = STORAGE_KEY \+ '-ui'/);
assert.ok(appSource.includes("const timeout = window.setTimeout(persist, 250);"), 'UI persistence stays debounced');
assert.ok(appSource.includes("window.addEventListener('pagehide', persist);"), 'pending UI state flushes on pagehide');
assert.ok(appSource.includes("window.removeEventListener('pagehide', persist);"), 'pagehide listener is cleaned up');
const persistBlock = appSource.slice(appSource.indexOf('const persist = () => {'), appSource.indexOf("window.addEventListener('pagehide', persist);"));
assert.ok(persistBlock.includes('localStorage.setItem(UI_STORAGE_KEY,'), 'persist() writes the UI key');
assert.ok(persistBlock.includes('if (written) return;'), 'persist() is idempotent per change');

console.log('Session restore and persistence regression tests passed.');
