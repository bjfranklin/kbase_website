#!/usr/bin/env node
'use strict';

// A second, deliberately simple reader of the catalog exports.
//
// The unit check in build-catalog-structure.py catches a section whose units do not
// add up. It cannot catch a rule that was misread but still adds up. This test counts
// requirements straight from the catalog Markdown with its own logic and compares the
// count with what the app scores. It only speaks for pathways it can read with
// certainty: every section is either a plain list (each course required) or a
// "any N courses" list. The only nesting it reads is a plain "Choose one" between
// single courses. Groups, bundles, sub-areas, unit rules, optional lists and
// general-education rows are beyond it. Anything else is skipped, not guessed.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    // PRODUCTION MODEL TEST START');
const end = html.indexOf('    // PRODUCTION MODEL TEST END');
const YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
const context = { window: {} };
for (const year of YEARS) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', `catalog-${year}.js`), 'utf8'), context);
}
vm.runInNewContext(
  `${html.slice(start, end)}
  this.api = { programsFromCatalog, computeProgramView };`,
  context
);
const NO_DATA = { index: {} };

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const COURSE_ROW = /^\| [A-Z][A-Z&]+ [A-Z]?\d+[A-Z]*\*? \|/;

// Requirement count for one pathway, or null when this reader is not certain.
const countRequirements = (lines) => {
  let total = 0;
  let rule = null; // { any: N } | { all: true }
  let courses = 0;
  let sawBlock = false;
  let inChoice = false;
  const close = () => {
    if (rule === null) return true;
    if (rule.any) {
      if (courses < rule.any) return false;
      total += rule.any;
    } else {
      if (courses === 0) return false;
      total += courses;
    }
    return true;
  };
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    if (!text.startsWith('|')) {
      // A bold line before the first section is the pathway's heading; any other
      // text between tables (sub-areas, notes, optional lists) is beyond this reader.
      if (!sawBlock && /^\*\*.*\*\*:?$/.test(text)) continue;
      return null;
    }
    const cells = text.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells[0] === 'Course' || /^-+$/.test(cells[0])) continue;
    if (cells[0] === '' && /^Total:/.test(cells[2] || '')) continue;
    if (cells[0].startsWith('**')) {
      if (!close()) return null;
      sawBlock = true;
      courses = 0;
      inChoice = false;
      const title = cells[0].replace(/\*/g, '').toLowerCase();
      if (/not taken|each|maximum|minimum|units|least|group|area|optional|recommend|elective|\bor\b/.test(title)) return null;
      const any = title.match(/\b(?:any|choose|select)\s+(one|two|three|four|five|six|\d)\b/) || title.match(/\b(one|two|three|four|five|six|\d)\s+courses?\b/);
      if (any) rule = { any: WORDS[any[1]] || Number(any[1]) };
      else if (/\b(required|requirements|core|courses)\b/.test(title)) rule = { all: true };
      else return null;
      continue;
    }
    if (!sawBlock) return null;
    // "Choose one:" followed by indented alternatives separated by OR is one requirement.
    if (/^\*choose one:?\*$/i.test(cells[0])) {
      if (rule.any) return null;
      inChoice = true;
      courses += 1;
      continue;
    }
    if (cells[0].startsWith('↳')) {
      const inner = cells[0].slice(1).trim();
      if (!inChoice) return null;
      if (inner === 'OR') continue;
      if (!COURSE_ROW.test(`| ${inner} |`)) return null; // AND bundles, notes
      continue;
    }
    inChoice = false;
    if (!COURSE_ROW.test(text)) return null;
    courses += 1;
  }
  return close() && sawBlock ? total : null;
};

const summary = {};
for (const year of YEARS) {
  const markdown = fs.readFileSync(path.join(root, 'catalog', `Chaffey_Catalog_${year}_Degrees_and_Certificates.md`), 'utf8').split('\n');
  const sections = new Map();
  let name = null;
  let inRequirements = false;
  for (const line of markdown) {
    if (line.startsWith('### ')) {
      name = line.slice(4).trim();
      inRequirements = false;
      if (sections.has(name)) name = null; // the catalog prints every pathway twice
      else sections.set(name, []);
    } else if (line.startsWith('#### ')) {
      inRequirements = /^#### Program Requirements/.test(line);
    } else if (name && inRequirements) {
      sections.get(name).push(line);
    }
  }
  const programs = context.api.programsFromCatalog(context.window.ZTC_CATALOGS[year]);
  let checked = 0;
  const mismatches = [];
  for (const program of programs) {
    const lines = sections.get(program.name);
    if (!lines) continue;
    const expected = countRequirements(lines);
    if (expected === null) continue;
    checked += 1;
    const actual = context.api.computeProgramView(program, NO_DATA, year).reqTotal;
    if (actual !== expected) mismatches.push(`${program.name}: catalog text gives ${expected}, app scores ${actual}`);
  }
  assert.deepEqual(mismatches, [], `${year}: requirement counts differ from the catalog text`);
  assert.ok(checked >= 50, `${year}: only ${checked} pathways could be counted independently`);
  summary[year] = `${checked} of ${programs.length}`;
}

console.log('Independent requirement counts match the app:', JSON.stringify(summary));
