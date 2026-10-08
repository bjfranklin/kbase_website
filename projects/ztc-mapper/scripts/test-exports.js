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
const context = {};

vm.runInNewContext(
  `${html.slice(start, end)}
  this.csvEscape = csvEscape;
  this.buildProgramCsv = buildProgramCsv;
  this.programExportCaveat = programExportCaveat;`,
  context
);

assert.equal(context.csvEscape('=CMD()'), "'=CMD()", 'spreadsheet formulas must be neutralized');
assert.equal(context.csvEscape('+1'), "'+1");
assert.equal(context.csvEscape('a,b'), '"a,b"');
assert.equal(context.csvEscape('line\nbreak'), '"line\nbreak"');
assert.equal(context.csvEscape('bare\rreturn'), '"bare\rreturn"', 'a bare CR must be quoted so it cannot split the row');
assert.equal(context.csvEscape('\rlead'), "\"'\rlead\"", 'leading CR is both neutralized and quoted');
assert.equal(context.csvEscape('say "hi"'), '"say ""hi"""');
assert.equal(context.csvEscape(null), '');
assert.equal(context.csvEscape(3.5), '3.5');

const program = { name: '=Example GE', type: 'GE / Transfer Pattern' };
const view = {
  areas: [{
    title: 'AREA 1',
    subgroups: [{
      title: 'Required',
      isLabReference: false,
      options: [{
        label: 'Choose one',
        courses: [{
          subject: 'TEST',
          number: '101',
          courseTitle: 'Example, Course',
          analyticsTitle: '',
          units: 3,
          headerId: '',
          ztcPct: 100,
          surveyPct: 90,
          status: 'ztc',
          coZtc: true
        }]
      }]
    }]
  }]
};

const csv = context.buildProgramCsv(program, view, '2026/FA');
assert.match(csv, /Export Note/);
assert.match(csv, /Source export may omit option nesting visible in the catalog/);
assert.match(csv, /'=Example GE/);
assert.match(csv, /"Example, Course"/);
assert.equal(csv.trim().split('\n').length, 2);

assert.match(html, /doc\.splitTextToSize\(`Note: \$\{caveat\}`/);
assert.match(html, /startY: caveat \? 38 : 28/);
assert.match(html, /const programViewCache = useMemo/);
assert.match(html, /<ul className="mt-2 space-y-2" aria-label="Laboratory courses/);

console.log('Export, lab semantics, and view-cache regression tests passed.');
