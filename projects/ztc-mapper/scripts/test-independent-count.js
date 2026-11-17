#!/usr/bin/env node
'use strict';

// A second, deliberately simple reader of the catalog exports.
//
// The unit check in build-catalog-structure.py catches a section whose units do not
// add up. It cannot catch a rule that was misread but still adds up. This test counts
// requirements straight from the catalog Markdown with its own logic and compares the
// count with what the app scores. It only speaks for pathways it can read with
// certainty: every section is either a plain list (each course required) or a
// "any N courses" list (including "or any course not taken from List A"), an
// "N units from the following" list of fixed-unit courses, "Choose one" entries,
// "Choose one group" with Group 1 / Group 2 lists, and suggested courses under a
// "Recommended (Optional)" caption. Sub-areas, "one from each", minimum-unit rules
// with conditions and general-education rows are beyond it. Anything else is skipped, not guessed.

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

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const COURSE_ROW = /^\| [A-Z][A-Z&]+ [A-Z]?\d+[A-Z]*\*? \|/;

// Requirement count for one pathway, or null when this reader is not certain.
const countRequirements = (lines) => {
  let total = 0;
  let rule = null; // { any: N, open? } | { all: true } | { units: N } | { group: true }
  let courses = 0;
  let units = [];
  let sawBlock = false;
  let inChoice = false;
  let inGroups = false; // after a "Choose one group:" caption inside a section
  let suggested = false; // after a "Recommended (Optional):" caption inside a section
  const close = () => {
    if (rule === null) return true;
    if (rule.group) {
      total += 1;
    } else if (rule.any) {
      if (!rule.open && courses < rule.any) return false;
      total += rule.any;
    } else if (rule.units) {
      // Fewest whole courses that reach the unit target.
      const sorted = units.slice().sort((x, y) => y - x);
      let sum = 0;
      let count = 0;
      while (count < sorted.length && sum + 1e-9 < rule.units) sum += sorted[count++];
      if (sum + 1e-9 < rule.units) return false;
      total += count;
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
      const bold = /^\*\*(.*?):?\*\*:?$/.exec(text);
      // A bold line before the first section is the pathway's heading.
      if (!sawBlock && bold) continue;
      if (bold && rule) {
        const caption = bold[1].replace(/:$/, '').trim().toLowerCase();
        // "Choose one group:" then "Group 1:", "Group 2:" lists: one requirement.
        if (caption === 'choose one group' && rule.all) {
          inGroups = true;
          total += 1;
          continue;
        }
        if (/^group \d+$/.test(caption) && (rule.group || inGroups)) continue;
        // Suggested courses under a section are listed, never required.
        if (/^(strongly recommended|recommended \(optional\)|optional course)$/.test(caption) && rule.all) {
          suggested = true;
          continue;
        }
      }
      return null; // sub-areas, notes, optional lists: beyond this reader
    }
    const cells = text.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells[0] === 'Course' || /^-+$/.test(cells[0])) continue;
    if (cells[0] === '' && /^Total:/.test(cells[2] || '')) continue;
    if (cells[0].startsWith('**')) {
      if (!close()) return null;
      sawBlock = true;
      courses = 0;
      units = [];
      inChoice = false;
      inGroups = false;
      suggested = false;
      const title = cells[0].replace(/\*/g, '').replace(/:\s*$/, '').toLowerCase();
      if (/each|maximum|minimum|least|area|optional|recommend/.test(title)) return null;
      const open = /\bor any courses? not taken from\b/.test(title);
      const unitRule = /^(?:plus )?(\w+) units from the following$/.exec(title);
      const any = title.match(/\b(?:any|choose|select)\s+(one|two|three|four|five|six|\d)\s+courses?\b/);
      if (title === 'choose one group') rule = { group: true };
      else if (unitRule && (WORDS[unitRule[1]] || Number(unitRule[1]))) rule = { units: WORDS[unitRule[1]] || Number(unitRule[1]) };
      else if (/units|group|elective/.test(title) && !any) return null;
      else if (/\bor\b/.test(title) && !open) return null;
      else if (any) rule = { any: WORDS[any[1]] || Number(any[1]), open };
      else if (/\b(required|requirements|core|courses)\b/.test(title)) rule = { all: true };
      else return null;
      continue;
    }
    if (!sawBlock) return null;
    // A footnote row: no course, no units.
    if (/^(\\\*|<sup>)/.test(cells[0]) && !cells[2]) continue;
    // "Choose one:" followed by indented alternatives separated by OR is one requirement.
    if (/^\*choose one:?\*$/i.test(cells[0])) {
      if (rule.units || rule.group || inGroups) return null;
      inChoice = true;
      if (!suggested) courses += 1;
      continue;
    }
    if (cells[0].startsWith('↳')) {
      const inner = cells[0].slice(1).trim();
      if (!inChoice) return null;
      if (inner === 'OR' || inner === 'AND') continue; // AND: taken together, still one alternative
      if (!COURSE_ROW.test(`| ${inner} |`)) return null;
      continue;
    }
    inChoice = false;
    if (!COURSE_ROW.test(text)) return null;
    if (rule.units) {
      if (!/^\d+(\.\d+)?$/.test(cells[2] || '')) return null; // variable units
      units.push(Number(cells[2]));
    }
    if (!inGroups && !rule.group && !suggested) courses += 1;
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
  assert.ok(checked >= 120, `${year}: only ${checked} pathways could be counted independently`);
  summary[year] = `${checked} of ${programs.length}`;
}

console.log('Independent requirement counts match the app:', JSON.stringify(summary));
