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

assert.notEqual(start, -1, 'requirement-scoring helper start marker is missing');
assert.notEqual(end, -1, 'requirement-scoring helper end marker is missing');
assert.ok(end > start, 'requirement-scoring helper markers are out of order');

const context = {};
vm.runInNewContext(
  `${html.slice(start, end)}
  this.optionIsZtc = optionIsZtc;
  this.scoreAreaRequirements = scoreAreaRequirements;
  this.parseCount = parseCount;
  this.parseCSV = parseCSV;
  this.buildAnalytics = buildAnalytics;
  this.buildPrograms = buildPrograms;
  this.computeProgramView = computeProgramView;`,
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

const chooseTwoScore = context.scoreAreaRequirements(
  [ztc, ztc, unavailable],
  [],
  true,
  2
);
assert.equal(chooseTwoScore.reqTotal, 2);
assert.equal(chooseTwoScore.reqZtc, 2);

const chooseThreeScore = context.scoreAreaRequirements(
  [ztc, ztc, unavailable, unknown],
  [],
  true,
  3
);
assert.equal(chooseThreeScore.reqTotal, 3);
assert.equal(chooseThreeScore.reqZtc, 2);

assert.equal(context.parseCount('16.00'), 16);
assert.equal(context.parseCount('1,000.00'), 1000);
assert.equal(context.parseCount('16.5'), null);
assert.equal(context.parseCount('-1'), null);
assert.equal(context.parseCount('Infinity'), null);
assert.equal(context.parseCount('0x10'), null);
assert.equal(context.parseCount('1e2'), null);

const fixture = (name) =>
  fs.readFileSync(path.join(root, 'scripts', 'fixtures', name), 'utf8');
const programs = context.buildPrograms(
  context.parseCSV(fixture('calculation-integrity-program-summary.csv'))
);
const analytics = context.buildAnalytics(
  context.parseCSV(fixture('calculation-integrity-course-analytics.csv'))
);
const viewFor = (name) => {
  const program = programs.find((candidate) => candidate.name === name);
  assert.ok(program, `${name} fixture program exists`);
  return context.computeProgramView(program, analytics, '2026/FA');
};

const chooseTwo = viewFor('Choose Two Certificate');
assert.deepEqual([chooseTwo.reqZtc, chooseTwo.reqTotal, chooseTwo.adoptionPct], [2, 2, 100]);
assert.equal(chooseTwo.unitsRequired, 6);

const chooseThree = viewFor('Choose Three Certificate');
assert.deepEqual([chooseThree.reqZtc, chooseThree.reqTotal, chooseThree.adoptionPct], [2, 3, 67]);

const grouped = viewFor('Grouped Curriculum');
assert.deepEqual([grouped.reqZtc, grouped.reqTotal], [2, 2]);
assert.equal(grouped.unitsRequired, 6, 'one Arts plus one Humanities must drive units');

const requiredCore = viewFor('Required Core Certificate');
assert.deepEqual([requiredCore.reqZtc, requiredCore.reqTotal], [2, 3]);

const component = viewFor('Component Curriculum');
assert.deepEqual([component.reqZtc, component.reqTotal], [3, 3]);
assert.equal(component.unitsRequired, 9, 'two 1C alternatives form one required component');

const andBundle = viewFor('AND Bundle Certificate');
assert.deepEqual([andBundle.reqZtc, andBundle.reqTotal], [1, 1]);
const bundleOptions = andBundle.areas[0].subgroups[0].options;
assert.ok(bundleOptions.some((option) => option.courses.length === 2 && !option.ztcOk));

const labConstraint = viewFor('Lab Constraint Curriculum');
assert.deepEqual([labConstraint.reqZtc, labConstraint.reqTotal], [3, 3]);
assert.equal(labConstraint.unitsRequired, 10);
assert.equal(labConstraint.unitsRequiredLabel, '≥10');
assert.equal(labConstraint.unitsRequiredUnverifiable, true);
const labArea = labConstraint.areas.find((area) => area.title.startsWith('AREA 5'));
assert.ok(labArea, 'lab constraint area exists');
assert.equal(labArea.requirementSlots.reduce((sum, group) => sum + group.requiredCount, 0), 2);
assert.equal(labArea.unitsLabel, '≥7');

const duplicateMetrics = viewFor('Duplicate Metrics Certificate');
assert.deepEqual([duplicateMetrics.coursesWithData, duplicateMetrics.coursesTotal], [2, 2]);
assert.equal(duplicateMetrics.avgSurvey, 90);
assert.equal(duplicateMetrics.reqTotal, 3, 'requirement placements remain distinct');

const decimalMetrics = analytics.index['TEST-101'].terms['2026/FA'];
assert.deepEqual(
  [decimalMetrics.totalSec, decimalMetrics.ztcSec, decimalMetrics.surveysSub, decimalMetrics.surveysPend],
  [16, 16, 16, 0]
);
const fractionalMetrics = analytics.index['BAD-101'].terms['2026/FA'];
assert.deepEqual(
  [fractionalMetrics.totalSec, fractionalMetrics.ztcSec, fractionalMetrics.surveysSub, fractionalMetrics.surveysPend],
  [null, null, null, null]
);

console.log('Requirement scoring regression tests passed.');
