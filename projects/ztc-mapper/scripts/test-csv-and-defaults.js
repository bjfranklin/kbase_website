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
assert.ok(start !== -1 && end > start, 'production model markers are missing or out of order');

const context = {};
vm.runInNewContext(
  `${html.slice(start, end)}
  this.parseCSV = parseCSV;
  this.defaultTerm = defaultTerm;
  this.currentTermCode = currentTermCode;`,
  context
);
const parse = (text) => JSON.parse(JSON.stringify(context.parseCSV(text)));

// Reference: the character-append parser shipped through v3.5.7.
const legacyParseCSV = (text) => {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
};

const cases = [
  'a,b\n1,2\n',
  'a,b\r\n"x,""y""",z\r\n\r\n1,2',
  'a,b\n1,',
  '﻿a\n\n b \n',
  'a,"b\nc",d\n"",\n',
  'a,"b\r\nc",d\r\n',
  'a,b\rc,d',
  '"only"',
  'a,"unterminated\nstill open',
  ',\n,,\n',
  'a,b\n   \nc,d\n',
  ''
];
for (const text of cases) {
  assert.deepEqual(parse(text), legacyParseCSV(text), `parseCSV differs for ${JSON.stringify(text)}`);
}
for (const fixture of ['ztc-course-dataset-sample.csv']) {
  const text = fs.readFileSync(path.join(root, 'scripts', 'fixtures', fixture), 'utf8');
  assert.deepEqual(parse(text), legacyParseCSV(text), `parseCSV differs for ${fixture}`);
}

// Default term: latest term that is not in the future.
const terms = ['2026/SP', '2026/SU', '2026/FA', '2027/SP'];
assert.equal(context.currentTermCode(new Date(2026, 10, 11)), '2026/FA');
assert.equal(context.currentTermCode(new Date(2026, 4, 31)), '2026/SP');
assert.equal(context.currentTermCode(new Date(2026, 5, 1)), '2026/SU');
assert.equal(context.currentTermCode(new Date(2026, 7, 1)), '2026/FA');
assert.equal(context.defaultTerm(terms, new Date(2026, 10, 11)), '2026/FA');
assert.equal(context.defaultTerm(terms, new Date(2027, 1, 1)), '2027/SP');
assert.equal(context.defaultTerm(terms, new Date(2030, 0, 1)), '2027/SP');
assert.equal(context.defaultTerm(terms, new Date(2020, 0, 1)), '2027/SP', 'all-future data falls back to the latest term');
assert.equal(context.defaultTerm(['2027/SP', '2026/FA'], new Date(2026, 10, 11)), '2026/FA', 'unsorted input');
assert.equal(context.defaultTerm([], new Date(2026, 10, 11)), '');

assert.match(html, /const term = defaultTerm\(anal\.terms\);/);
assert.match(html, /if \(!institutionTrendWanted \|\| !programs/);

console.log('CSV parser equivalence and default-term regression tests passed.');
