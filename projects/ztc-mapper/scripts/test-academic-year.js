#!/usr/bin/env node
'use strict';

// v4.1: pathways are scored over an academic year (Fall -> Spring -> Summer) against
// that year's catalog. A course is ZTC for the year only if it meets the 75% rule in
// every term it was offered.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    // PRODUCTION MODEL TEST START');
const end = html.indexOf('    // PRODUCTION MODEL TEST END');
assert.ok(start !== -1 && end > start, 'production model markers must exist');

const YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
const context = { window: {} };
for (const year of YEARS) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', `catalog-${year}.js`), 'utf8'), context);
}
vm.runInNewContext(
  `${html.slice(start, end)}
  this.api = { parseCSV, buildAnalytics, programsFromCatalog, computeProgramView, yearOfTerm,
    academicYearTerms, yearLabel, yearStatus, catalogYears, defaultYear, isYearKey };`,
  context,
  { filename: 'index.html#production-model' }
);
const api = context.api;
const plain = (value) => JSON.parse(JSON.stringify(value));

// Year definition: Fall leads, Summer trails.
assert.deepEqual(plain(api.academicYearTerms('2026-2027')), ['2026/FA', '2027/SP', '2027/SU']);
assert.equal(api.yearOfTerm('2026/FA'), '2026-2027');
assert.equal(api.yearOfTerm('2027/SP'), '2026-2027');
assert.equal(api.yearOfTerm('2026/SU'), '2025-2026');
assert.equal(api.yearLabel('2026-2027'), '2026–27');
assert.ok(api.isYearKey('2026-2027') && !api.isYearKey('2026/FA'));
assert.deepEqual(plain(api.catalogYears()), YEARS);
assert.equal(api.defaultYear(['2026/FA', '2027/SP'], new Date(2026, 10, 14)), '2026-2027');
assert.equal(api.defaultYear(['2031/FA'], new Date(2031, 10, 1)), '2026-2027', 'falls back to the latest catalog');

const HEADER = 'Course,Course Title,Sec Term,Total Sections Term,Ztc Sections Term,Surveys Submitted Term,Pending Surveys Term,Survey Completion Pct Term,Ztc Percent Term';
const row = (course, term, total, ztc, submitted = total) =>
  `${course},${course},${term},${total}.00,${ztc}.00,${submitted}.00,${total - submitted}.00,${((submitted / total) * 100).toFixed(2)}%,${((ztc / total) * 100).toFixed(2)}%`;
const dataset = (rows) => api.buildAnalytics(api.parseCSV([HEADER].concat(rows).join('\n')));

// Strict course rule.
const analytics = dataset([
  row('AAA-1', '2026/FA', 4, 4), row('AAA-1', '2027/SP', 4, 4), // ZTC in both terms
  row('BBB-1', '2026/FA', 10, 10), row('BBB-1', '2027/SP', 2, 1), // pooled 92%, but Spring is 50%
  row('CCC-1', '2027/SP', 1, 1), // offered in Spring only
  row('DDD-1', '2026/SU', 1, 1) // Summer 2026 belongs to 2025-26
]);
const program = {
  name: 'Test pathway', type: 'Certificate', catalogTotalUnits: null,
  areas: [{
    id: 'a0', title: 'Required', requirement: { choice: false, n: null }, isHeaderArea: false, ruleLabel: 'All required',
    notes: [], catalogUnits: [12, 12], reconciliation: 'reconciled',
    subgroups: [{
      id: 'a0-0', title: null, requirement: { choice: null, n: null }, isLabReference: false, notes: [],
      courses: ['AAA-1', 'BBB-1', 'CCC-1', 'DDD-1'].map((key) => ({ key, subject: key.split('-')[0], number: '1', courseTitle: key, units: 3, unitsMax: 3, lab: false, headerId: null, groupTitle: null, condition: null })),
      options: ['AAA-1', 'BBB-1', 'CCC-1', 'DDD-1'].map((key) => ({ label: null, courses: [{ key, subject: key.split('-')[0], number: '1', courseTitle: key, units: 3, unitsMax: 3, lab: false, headerId: null, groupTitle: null, condition: null }] })),
      slots: [0, 1, 2, 3].map((i) => ({ need: 1, options: [i] }))
    }]
  }]
};
const yearView = api.computeProgramView(program, analytics, '2026-2027');
const courses = Object.fromEntries(yearView.areas[0].subgroups[0].options.map((o) => [o.courses[0].key, o.courses[0]]));
assert.equal(courses['AAA-1'].status, 'ztc');
assert.equal(courses['BBB-1'].ztcPct, 50, 'the year shows the lowest term');
assert.notEqual(courses['BBB-1'].status, 'ztc', 'a missed term fails the year even when pooled sections pass');
assert.deepEqual(plain(courses['BBB-1'].metrics.missedTerms), ['2027/SP']);
assert.equal(courses['BBB-1'].coZtc, true, "Chancellor's Office ZTC still needs only one section");
assert.equal(courses['CCC-1'].status, 'ztc', 'terms where the course is not offered are ignored');
assert.equal(courses['DDD-1'].offered, false, 'Summer 2026 is not part of 2026-27');
assert.equal(yearView.reqTotal, 4);
assert.equal(yearView.reqZtc, 2);
// The single-term rule is unchanged.
const fallView = api.computeProgramView(program, analytics, '2026/FA');
assert.equal(fallView.reqZtc, 2);
assert.equal(fallView.areas[0].subgroups[0].options[1].courses[0].status, 'ztc');
assert.equal(api.computeProgramView(program, analytics, '2025-2026').reqZtc, 1, 'DDD-1 counts in 2025-26');

// Survey completion and "in progress".
const status = api.yearStatus(dataset([
  row('AAA-1', '2026/FA', 100, 100, 98), row('AAA-1', '2027/SP', 100, 50, 74)
]), ['2026/FA', '2027/SP'], '2026-2027');
assert.equal(status.surveyPct, 86);
assert.equal(status.inProgress, true);
assert.match(status.reason, /2027\/SP surveys at 74%/);
assert.match(status.reason, /2027\/SU not in the dataset yet/);
const closed = api.yearStatus(dataset([
  row('AAA-1', '2025/FA', 10, 10, 10), row('AAA-1', '2026/SP', 10, 10, 9), row('AAA-1', '2026/SU', 10, 10, 10)
]), ['2025/FA', '2026/SP', '2026/SU'], '2025-2026');
assert.equal(closed.inProgress, false);
assert.equal(closed.surveyPct, 97);

// Every catalog year loads and every pathway scores without dropping a block.
const counts = {};
for (const year of YEARS) {
  const catalog = context.window.ZTC_CATALOGS[year];
  assert.equal(catalog.meta.catalogYear, year);
  const programs = api.programsFromCatalog(catalog);
  assert.ok(programs.length >= 180, `${year} should have at least 180 pathways`);
  assert.equal(new Set(programs.map((p) => p.name)).size, programs.length, `${year} pathway names are unique`);
  const verified = ['reconciled', 'approximated', 'no-courses', 'optional', 'reviewed'].reduce((sum, key) => sum + (catalog.meta.blockStatus[key] || 0), 0);
  assert.ok(verified / catalog.meta.blocks >= 0.93, `${year}: at least 93% of blocks verified`);
  for (const p of programs) {
    const view = api.computeProgramView(p, analytics, year);
    assert.ok(view.reqTotal >= 0);
    for (const area of p.areas) {
      const hasCourses = area.subgroups.some((sg) => sg.courses.length > 0 || (sg.options || []).length > 0);
      assert.ok(hasCourses || area.reconciliation === 'no-courses', `${year} ${p.name} / ${area.title} lost its courses`);
    }
  }
  counts[year] = `${programs.length} pathways, ${verified}/${catalog.meta.blocks} verified`;
}

// Reader rules that only the older catalogs exercise.
const older = (year, prefix) => {
  const found = api.programsFromCatalog(context.window.ZTC_CATALOGS[year]).find((p) => p.name.startsWith(prefix));
  assert.ok(found, `${year}: ${prefix}`);
  return api.computeProgramView(found, { index: {} }, year);
};
const sectionOf = (view, prefix) => view.areas.find((a) => a.title.startsWith(prefix));
const VERIFIED = ['reconciled', 'approximated', 'no-courses', 'optional', 'reviewed'];
const needOf = (area) => Array.from(area.requirementSlots).reduce((sum, group) => sum + group.requiredCount, 0);
// Two "Choose one group:" captions inside one section are two requirements.
assert.equal(older('2024-2025', 'General Automotive Service Technician - Certificate').reqTotal, 2);
assert.equal(older('2024-2025', 'Master Automotive Technician - Certificate').reqTotal, 6);
assert.ok(older('2024-2025', 'Master Automotive Technician - Certificate').areas.every((a) => VERIFIED.includes(a.reconciliation)));
// "Nine units from the following" with 3, 3, 4, 4 and 1.5 unit courses: three courses,
// and the totals a student can end with are the 9.5 to 11 the catalog prints.
const nineUnits = sectionOf(older('2024-2025', 'Accounting - Certificate of Achievement'), 'Nine units');
assert.equal(needOf(nineUnits), 3);
assert.equal(nineUnits.reconciliation, 'reconciled');
// A general-education area with a plain list and no count is one course.
const ethnic = sectionOf(older('2024-2025', 'Intersegmental General Education Transfer Curriculum'), 'AREA 7');
assert.equal(needOf(ethnic), 1);
assert.equal(ethnic.reconciliation, 'reconciled');
// "Required CSU only" is counted, and the printed range starts without it.
const english = sectionOf(older('2024-2025', 'Intersegmental General Education Transfer Curriculum'), 'AREA 1');
assert.equal(needOf(english), 3);
assert.equal(english.reconciliation, 'reconciled');
// Language Other Than English can be met in high school: listed, not scored.
const physicsGe = sectionOf(older('2024-2025', 'University of California Transfer Pathway: P'), 'Additional IGETC');
assert.equal(needOf(physicsGe), 3);
assert.equal(physicsGe.reconciliation, 'approximated');
// A sign-off covers another year only when that year prints the same text.
const politicalScience = (year) => sectionOf(older(year, 'Political Science for Transfer'), 'List B').reconciliation;
assert.equal(politicalScience('2023-2024'), 'reviewed');
assert.equal(sectionOf(older('2023-2024', 'Political Science for Transfer'), 'List A').reconciliation, 'unreconciled');

console.log('Academic-year tests passed:', JSON.stringify(counts));
