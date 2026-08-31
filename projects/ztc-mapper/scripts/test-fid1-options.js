#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const startMarker = '    // PRODUCTION MODEL TEST START';
const endMarker = '    // PRODUCTION MODEL TEST END';
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);

assert.notEqual(start, -1, 'production model start marker is missing');
assert.notEqual(end, -1, 'production model end marker is missing');
assert.ok(end > start, 'production model markers are out of order');

const context = {};
vm.runInNewContext(
  `${html.slice(start, end)}
  this.parseCSV = parseCSV;
  this.buildPrograms = buildPrograms;
  this.appendMarkerEvent = appendMarkerEvent;
  this.buildOptionsFromEvents = buildOptionsFromEvents;`,
  context
);

const marker = (groupTitle, condition = '') => ({
  type: 'marker',
  groupTitle,
  condition
});
const course = (key, condition = '') => {
  const [subject, number] = key.split('-');
  return {
    type: 'course',
    course: { key, subject, number },
    condition,
    groupTitle: ''
  };
};
const buildEvents = (rows) => {
  const events = [];
  for (const row of rows) {
    if (row.type === 'marker') {
      context.appendMarkerEvent(events, row.groupTitle, row.condition);
    } else {
      events.push(row);
    }
  }
  return events;
};
const labelsByCourse = (options) => {
  const labels = new Map();
  for (const option of options || []) {
    for (const item of option.courses) labels.set(item.key, option.label);
  }
  return labels;
};

const consecutiveRows = [
  marker('Group 1'),
  marker('Group 1'),
  course('CIS-1')
];
const consecutiveEvents = buildEvents(consecutiveRows);
assert.equal(
  consecutiveEvents.filter((event) => event.type === 'marker').length,
  1,
  'consecutive identical markers should collapse'
);

const repeatedRows = [
  marker('Group 1'),
  course('CIS-1'),
  marker('Group 1'),
  course('CIS-2')
];
const repeatedEvents = buildEvents(repeatedRows);
assert.equal(
  repeatedEvents.filter((event) => event.type === 'marker').length,
  2,
  'nonconsecutive repeated markers should be preserved'
);
const repeatedLabels = labelsByCourse(context.buildOptionsFromEvents(repeatedEvents));
assert.equal(repeatedLabels.get('CIS-1'), 'Group 1');
assert.equal(repeatedLabels.get('CIS-2'), 'Group 1');

const chooseOneRows = [
  course('CIS-10'),
  course('CIS-11'),
  marker('Choose one:'),
  course('ITIS-42')
];
const chooseOneLabels = labelsByCourse(
  context.buildOptionsFromEvents(buildEvents(chooseOneRows))
);
assert.equal(chooseOneLabels.get('CIS-10'), null);
assert.equal(chooseOneLabels.get('CIS-11'), null);
assert.equal(
  chooseOneLabels.get('ITIS-42'),
  'Choose one',
  'Choose one should apply only to following courses'
);

const eitherOrRows = [
  marker('Either'),
  course('ENGL-1A'),
  marker('Or'),
  course('ENGL-1B')
];
const eitherOrLabels = labelsByCourse(
  context.buildOptionsFromEvents(buildEvents(eitherOrRows))
);
assert.equal(eitherOrLabels.get('ENGL-1A'), 'Either');
assert.equal(eitherOrLabels.get('ENGL-1B'), 'Or');

const requiredCoreKeys = Array.from({ length: 12 }, (_, index) => `CIS-${index + 1}`);
const dataScienceRows = [
  ...requiredCoreKeys.map((key) => course(key)),
  marker('Choose one:'),
  course('ITIS-42'),
  marker('Choose one:'),
  marker('Choose one:')
];
const dataScienceEvents = buildEvents(dataScienceRows);
assert.equal(
  dataScienceEvents.filter((event) => event.type === 'marker').length,
  2,
  'only the trailing consecutive Choose one marker should collapse'
);
const dataScienceLabels = labelsByCourse(
  context.buildOptionsFromEvents(dataScienceEvents)
);
for (const key of requiredCoreKeys) {
  assert.equal(
    dataScienceLabels.get(key),
    null,
    `${key} should remain an unlabeled required-core course`
  );
}
assert.equal(dataScienceLabels.get('ITIS-42'), 'Choose one');

const csvRows = [
  [
    'Program Entity Title',
    'Program Status',
    'Course Subject Code',
    'Course Block Item Course Number',
    'Course Block Item Course Title',
    'Course Block Title',
    'Min Units',
    'Header Identifier (*)',
    'Group Title',
    'Condition'
  ],
  ['FID E2E Certificate', 'Active', 'CIS', '10', 'Required One', 'Required Core', '3', '', '', ''],
  ['FID E2E Certificate', 'Active', 'CIS', '11', 'Required Two', 'Required Core', '3', '', '', ''],
  ['FID E2E Certificate', 'Active', '', '', '', 'Required Core', '', '', 'Choose one:', ''],
  ['FID E2E Certificate', 'Active', 'ITIS', '42', 'Forward Choice', 'Required Core', '3', '', '', ''],
  ['FID E2E Certificate', 'Active', '', '', '', 'Required Core', '', '', 'Group 1', ''],
  ['FID E2E Certificate', 'Active', '', '', '', 'Required Core', '', '', 'Group 1', ''],
  ['FID E2E Certificate', 'Active', 'TEST', '90', 'First Group One', 'Required Core', '3', '', '', ''],
  ['FID E2E Certificate', 'Active', '', '', '', 'Required Core', '', '', 'Group 2', ''],
  ['FID E2E Certificate', 'Active', 'TEST', '91', 'Group Two', 'Required Core', '3', '', '', ''],
  ['FID E2E Certificate', 'Active', '', '', '', 'Required Core', '', '', 'Group 1', ''],
  ['FID E2E Certificate', 'Active', 'TEST', '92', 'Repeated Group One', 'Required Core', '3', '', '', '']
];
const syntheticCsv = `\uFEFF${csvRows.map((row) => row.join(',')).join('\r\n')}\r\n`;
const parsedRows = context.parseCSV(syntheticCsv);
const e2ePrograms = context.buildPrograms(parsedRows);
assert.equal(e2ePrograms.length, 1);
const e2eSubgroup = e2ePrograms[0].areas[0].subgroups[0];
const e2eOptions = e2eSubgroup.options;
assert.ok(e2eOptions, 'synthetic CSV should produce structured options');
assert.equal(
  e2eOptions.length,
  6,
  'consecutive Group 1 markers should collapse without duplicate option structure'
);
const e2eLabels = labelsByCourse(e2eOptions);
assert.equal(e2eLabels.get('CIS-10'), null, 'required core before Choose one must stay unlabeled');
assert.equal(e2eLabels.get('CIS-11'), null, 'required core before Choose one must stay unlabeled');
assert.equal(e2eLabels.get('ITIS-42'), 'Choose one', 'Choose one must apply forward');
assert.equal(e2eLabels.get('TEST-90'), 'Group 1');
assert.equal(e2eLabels.get('TEST-91'), 'Group 2');
assert.equal(
  e2eLabels.get('TEST-92'),
  'Group 1',
  'nonconsecutive repeated Group 1 marker must be preserved'
);

console.log('FID-1 helper and production CSV regression tests passed.');
