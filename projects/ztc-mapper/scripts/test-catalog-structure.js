#!/usr/bin/env node
'use strict';

// v4: pathway structure comes from the official catalog (data/catalog-<year>.js, one per academic year).
// Expected values below were read from the 2026-2027 catalog's program pages.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    // PRODUCTION MODEL TEST START');
const end = html.indexOf('    // PRODUCTION MODEL TEST END');
assert.ok(start !== -1 && end > start, 'production model markers are missing or out of order');

const context = { window: {} };
const YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
for (const year of YEARS) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', `catalog-${year}.js`), 'utf8'), context);
}
vm.runInNewContext(
  `${html.slice(start, end)}
  this.parseCSV = parseCSV;
  this.buildAnalytics = buildAnalytics;
  this.programsFromCatalog = programsFromCatalog;
  this.computeProgramView = computeProgramView;
  this.pathwayTone = pathwayTone;
  this.ztcStatus = ztcStatus;`,
  context
);

const catalog = context.window.ZTC_CATALOGS['2026-2027'];
assert.ok(catalog && catalog.meta, 'catalog structure files must define window.ZTC_CATALOGS[year]');
assert.match(catalog.meta.sourceSha256, /^[0-9a-f]{64}$/);
for (const year of YEARS) {
  assert.ok(html.includes(`<script src="data/catalog-${year}.js"></script>`), `index.html must load the ${year} catalog`);
}
assert.throws(() => context.programsFromCatalog(null), /catalog structure file/i);

const programs = context.programsFromCatalog(catalog);
assert.equal(programs.length, catalog.meta.programs);
assert.equal(new Set(programs.map((p) => p.name)).size, programs.length, 'pathway names are unique');
for (const program of programs) {
  assert.ok(typeof program.type === 'string' && program.type, `${program.name} has a type`);
}

// Reconciliation floor: fail the build if a catalog refresh parses noticeably worse.
const status = catalog.meta.blockStatus;
const verified = ['reconciled', 'approximated', 'no-courses', 'optional', 'reviewed'].reduce((sum, key) => sum + (status[key] || 0), 0);
assert.ok(verified / catalog.meta.blocks >= 0.99, `only ${verified} of ${catalog.meta.blocks} blocks verified`);

// Every listed course is "ZTC" in this synthetic term so requirement counts are easy to read.
const TERM = '2026/FA';
const keys = new Set();
for (const program of programs) {
  for (const area of program.areas) {
    for (const sg of area.subgroups) for (const course of sg.courses) keys.add(course.key);
  }
}
const analytics = context.buildAnalytics(
  context.parseCSV(
    ['Course,Course Title,Sec Term,Total Sections Term,Ztc Sections Term,Survey Completion Pct Term,Ztc Percent Term']
      .concat([...keys].map((k) => `${k},${k},${TERM},2.00,2.00,100.00%,100.00%`))
      .join('\n')
  )
);
const view = (prefix) => {
  const program = programs.find((p) => p.name.startsWith(prefix));
  assert.ok(program, `catalog pathway ${prefix}`);
  return context.computeProgramView(program, analytics, TERM);
};

const expected = [
  // [pathway, requirements, units label]
  ['Philosophy for Transfer - AA-T', 6, '18'],
  ['Business Administration 2.0 for Transfer - AS-T', 8, '28'],
  ['Cybersecurity Analyst - Certificate of Achievement', 7, '22–23'],
  ['Environmental Science for Transfer - AS-T', 9, '41'],
  ['Journalism - Certificate of Achievement', 7, '22'],
  ['Economics for Transfer - AA-T', 6, '20–23'],
  ['Spanish for Transfer - AA-T', 5, '19'],
  ['Accounting - A.S. Degree', 7, '24–25'],
  ['Photography - A.A. Degree', 9, '33–34'],
  // Areas 1-4 and 6 give 9; Area 5 is 5A + 5B + C (Laboratory Science) = 3.
  ['California General Education Transfer Curriculum (Cal-GETC)', 12, '34–42']
];
for (const [name, requirements, units] of expected) {
  const v = view(name);
  assert.equal(v.reqTotal, requirements, `${name}: requirement count`);
  assert.equal(v.reqZtc, requirements, `${name}: all requirements met when every course is ZTC`);
  assert.equal(v.unitsRequiredLabel, units, `${name}: units`);
  assert.equal(v.choiceCaveatAreas, 0, `${name}: verified against printed units`);
}

// A choice counts once: Business Administration with only MATH 60 ZTC among its math options.
const partial = context.buildAnalytics(
  context.parseCSV(
    ['Course,Course Title,Sec Term,Total Sections Term,Ztc Sections Term,Survey Completion Pct Term,Ztc Percent Term']
      .concat([...keys].map((k) => `${k},${k},${TERM},2.00,${k === 'MATH-60' ? '2.00' : '0.00'},100.00%,${k === 'MATH-60' ? '100.00%' : '0.00%'}`))
      .join('\n')
  )
);
const busAdmin = context.computeProgramView(
  programs.find((p) => p.name.startsWith('Business Administration 2.0')),
  partial,
  TERM
);
assert.equal(busAdmin.reqZtc, 1);
assert.equal(busAdmin.reqTotal, 8);

// Cal-GETC Area 5: one course from 5A, one from 5B, and section C needs a lab course.
const calGetc = programs.find((p) => p.name.startsWith('California General Education Transfer Curriculum'));
const area5 = calGetc.areas.find((a) => a.title.startsWith('AREA 5'));
assert.deepEqual(JSON.parse(JSON.stringify(area5.catalogUnits)), [7, 9]);
assert.ok(area5.notes.some((n) => /one of which must include a laboratory/.test(n)), 'Area 5 instruction is kept');
const [subA, subB, subC] = area5.subgroups;
assert.match(subC.title, /Laboratory Science/);
assert.ok(subC.notes.some((n) => /any course in 5A or 5B with a laboratory/.test(n)), 'section C instruction is kept');
assert.ok(subC.slots[0].summary && subC.slots[0].need === 1);
assert.ok(subC.options.every((o) => o.courses.some((c) => c.lab)), 'section C lists only lab options');
assert.ok(subA.options.some((o) => o.courses.map((c) => c.key).join('+') === 'ESC-1+ESC-1L'), 'Either/Or: course with its lab');
assert.ok(subA.options.some((o) => o.courses.map((c) => c.key).join('+') === 'ESC-1'), 'Either/Or: course alone');
// The two alternatives of one "Either ... Or ..." entry stay tied together for display.
const bundleOf = (o) => o.courses.map((c) => c.key).join('+');
const escAlone = subA.options.find((o) => bundleOf(o) === 'ESC-1');
const escWithLab = subA.options.find((o) => bundleOf(o) === 'ESC-1+ESC-1L');
assert.ok(escAlone.choice && escAlone.choice === escWithLab.choice, 'ESC 1 alternatives share an Either/Or group');
assert.equal(escAlone.label, 'Either');
assert.notEqual(subA.options.find((o) => bundleOf(o) === 'ESC-5').choice, escAlone.choice, 'each Either/Or entry is its own group');
assert.equal(subA.options.find((o) => bundleOf(o) === 'ASTRON-26').choice, undefined, 'plain courses are not grouped');
assert.match(html, /data-either-or="true"/, 'the Pathway view groups Either/Or alternatives');
assert.match(html, /Academic catalog years included:/, 'the import screen names the catalog years');
// Every unverified-section note carries the same explainer.
assert.equal((html.match(/openDashboardExplainer\(UNVERIFIED_EXPLAINER\)/g) || []).length, 3, 'dashboard, pathway and section notes explain "unverified section"');
assert.match(html, /title: 'Unverified section'/);
assert.doesNotMatch(html, /Program structure<\/div>/, 'the catalog card is gone from the import screen');
const datasetWith = (ztcKeys) =>
  context.buildAnalytics(
    context.parseCSV(
      ['Course,Course Title,Sec Term,Total Sections Term,Ztc Sections Term,Survey Completion Pct Term,Ztc Percent Term']
        .concat([...keys].map((k) => `${k},${k},${TERM},2.00,${ztcKeys.has(k) ? '2.00' : '0.00'},100.00%,${ztcKeys.has(k) ? '100.00%' : '0.00%'}`))
        .join('\n')
    )
  );
const area5Of = (ztcKeys) =>
  context.computeProgramView(calGetc, datasetWith(ztcKeys), TERM).areas.find((a) => a.title.startsWith('AREA 5'));
const slotsMet = (area) => Array.from(area.requirementSlots, (g) => g.candidates.some((c) => c.ztcOk));
// Non-lab ZTC courses in 5A and 5B: two requirements met, the lab requirement is not.
assert.deepEqual(slotsMet(area5Of(new Set(['ASTRON-26', 'BIOL-12']))), [true, true, false]);
// A lecture alone does not meet the lab requirement; lecture + lab does.
assert.deepEqual(slotsMet(area5Of(new Set(['ESC-1', 'BIOL-12']))), [true, true, false]);
assert.deepEqual(slotsMet(area5Of(new Set(['ESC-1', 'ESC-1L', 'BIOL-12']))), [true, true, true]);

// General-education area rows are one requirement, met by any course of the Cal-GETC area.
const nursing = programs.find((p) => p.name.startsWith('Nursing: ADN'));
const geSlots = nursing.areas.flatMap((a) => a.subgroups.flatMap((sg) => sg.slots.filter((slot) => slot.summary)));
assert.ok(geSlots.length >= 3 && geSlots.every((slot) => slot.need === 1 && slot.options.length > 0));
assert.ok(geSlots.some((slot) => /Cal-GETC Area 6/.test(slot.summaryLabel)));

// Pathway colour rule: green only at 100%, yellow 75-99%, red below 75%. Courses keep 75%.
assert.equal(context.pathwayTone(100), 'full');
assert.equal(context.pathwayTone(99), 'high');
assert.equal(context.pathwayTone(75), 'high');
assert.equal(context.pathwayTone(74), 'low');
assert.equal(context.pathwayTone(null), 'none');
assert.equal(context.ztcStatus(75), 'ztc', 'course-level threshold is unchanged');

// No block is dropped: every catalog block with courses either scores or is listed.
for (const program of programs) {
  for (const area of program.areas) {
    const hasCourses = area.subgroups.some((sg) => sg.courses.length > 0 || (sg.options || []).length > 0);
    assert.ok(hasCourses || area.reconciliation === 'no-courses', `${program.name} / ${area.title} lost its courses`);
  }
}

// ---- Rules that closed the 2026-27 unverified sections ----
const programNamed = (prefix) => programs.find((p) => p.name.startsWith(prefix));
const scored = (prefix, ztcKeys) => context.computeProgramView(programNamed(prefix), ztcKeys ? datasetWith(ztcKeys) : analytics, TERM);
const areaNamed = (v, prefix) => v.areas.find((a) => a.title.startsWith(prefix));

// Courses the catalog lists but does not require are shown and never counted.
for (const [prefix, requirements, units] of [
  ['Engineering - A.S. Degree', 9, '34–35'], // "Strongly recommended:" under "Any three courses"
  ['Geological Sciences - A.S. Degree', 6, '26'], // "This course is recommended, but not required:"
  ['Industrial Electrical Technology Level III', 15, '42'], // "Recommended (Optional):"
  ['Interior Design - A.S. Degree', 13, '39'], // "Optional Course:"
  ['Fire Prevention Inspector', 8, '18.5'] // a whole "Recommended (Optional)" section
]) {
  const v = scored(prefix);
  assert.equal(v.reqTotal, requirements, `${prefix}: requirements`);
  assert.equal(v.unitsRequiredLabel, units, `${prefix}: units`);
  assert.equal(v.choiceCaveatAreas, 0, `${prefix}: verified`);
}
const fire = scored('Fire Prevention Inspector');
assert.equal(areaNamed(fire, 'Recommended (Optional)').reconciliation, 'optional');
assert.equal(areaNamed(fire, 'Recommended (Optional)').areaPct, null);

// "Choose one group: Group 1: BIOL 1 OR BIOL 20 / Group 2: BIOL 424 AND BIOL 424L" is one requirement.
const pe = scored('Physical Education - A.A. Degree');
assert.equal(pe.choiceCaveatAreas, 0);
assert.equal(areaNamed(pe, 'Required Core').reqTotal ?? areaNamed(pe, 'Required Core').requirementSlots.length, 3);
const peChoice = programNamed('Physical Education - A.A. Degree').areas[0].subgroups.flatMap((sg) => sg.slots.map((slot) => slot.options.map((i) => bundleOf(sg.options[i])))).find((options) => options.length === 3);
assert.deepEqual(JSON.parse(JSON.stringify(peChoice)), ['BIOL-1', 'BIOL-20', 'BIOL-424+BIOL-424L']);

// "Any three courses (maximum of one from each category)": three of the four categories.
const movement = (ztcKeys) => areaNamed(scored('Kinesiology for Transfer', ztcKeys), 'Movement-Based Courses').requirementSlots[0];
assert.equal(movement(new Set()).requiredCount, 3);
assert.equal(movement(new Set()).candidates.length, 4);
const metCategories = (ztcKeys) => movement(ztcKeys).candidates.filter((c) => c.ztcOk).length;
assert.equal(metCategories(new Set(['KINACT-24', 'KINACT-25', 'KINACT-26'])), 1, 'three Fitness courses fill one category only');
assert.equal(metCategories(new Set(['KINACT-9', 'KINACT-31', 'KINACT-24'])), 3);

// "... or any courses not taken from List A": only what List A leaves over counts in List B.
const hospitalityA = programNamed('Hospitality Management for Transfer').areas.find((a) => a.title.startsWith('List A')).subgroups[0];
const listAKeys = hospitalityA.slots[0].options.map((i) => bundleOf(hospitalityA.options[i]));
const listB = (ztcKeys) => {
  const area = areaNamed(scored('Hospitality Management for Transfer', ztcKeys), 'List B');
  const group = area.requirementSlots[0];
  return Math.min(group.requiredCount, group.qualifying);
};
assert.equal(listB(new Set(listAKeys.slice(0, 3))), 0, 'List A uses its three ZTC courses itself');
assert.equal(listB(new Set(listAKeys.slice(0, 4))), 1, 'a fourth ZTC course in List A is left over for List B');
assert.equal(listB(new Set(listAKeys.slice(0, 5))), 2);
assert.equal(scored('Hospitality Management for Transfer').choiceCaveatAreas, 0);

// A left-over course is claimed once: English List B and List C both borrow from List A.
const englishLists = (ztcKeys) => Array.from(scored('English for Transfer', new Set(ztcKeys)).areas)
  .filter((a) => /^List [ABC]/.test(a.title))
  .map((a) => Math.min(a.requirementSlots[0].requiredCount, a.requirementSlots[0].qualifying));
assert.deepEqual(englishLists(['ENGL-70A', 'ENGL-70B', 'ENGL-75A']), [2, 1, 0], 'one spare List A course cannot serve both List B and List C');
assert.deepEqual(englishLists(['ENGL-70A', 'ENGL-70B', 'ENGL-75A', 'ENGL-75B']), [2, 1, 1]);
assert.deepEqual(englishLists(['ENGL-70A', 'ENGL-70B', 'ENGL-7A', 'ENGL-7B']), [2, 1, 1], 'List B\u2019s own spare course serves List C');

// "Any three courses from at least two of the following areas".
const socialJustice = programNamed('Social Justice Studies for Transfer').areas.find((a) => a.title.startsWith('List A')).subgroups[0];
const byArea = {};
for (const index of socialJustice.slots[0].options) {
  const option = socialJustice.options[index];
  (byArea[option.label] = byArea[option.label] || []).push(bundleOf(option));
}
const [firstArea, secondArea] = Object.values(byArea);
const listAMet = (ztcKeys) => {
  const group = areaNamed(scored('Social Justice Studies for Transfer', new Set(ztcKeys)), 'List A').requirementSlots[0];
  return Math.min(group.requiredCount, group.qualifying);
};
assert.equal(listAMet(firstArea.slice(0, 3)), 2, 'three ZTC courses from one area fill only two of the three places');
assert.equal(listAMet([...firstArea.slice(0, 2), secondArea[0]]), 3);
// Disciplines are course subjects (Cal-GETC Area 4: two courses from at least two disciplines).
const area4 = (ztcKeys) => {
  const group = areaNamed(scored('California General Education Transfer Curriculum', new Set(ztcKeys)), 'AREA 4').requirementSlots[0];
  return Math.min(group.requiredCount, group.qualifying);
};
const area4Sub = calGetc.areas.find((a) => a.title.startsWith('AREA 4')).subgroups[0];
const area4Keys = area4Sub.slots[0].options.map((i) => area4Sub.options[i].courses[0]);
const anthro = area4Keys.filter((course) => course.subject === 'ANTHRO').map((course) => course.key);
const econ = area4Keys.filter((course) => course.subject === 'ECON').map((course) => course.key);
assert.ok(anthro.length >= 2 && econ.length >= 1);
assert.equal(area4(anthro.slice(0, 2)), 1, 'two courses in one discipline fill one of the two places');
assert.equal(area4([anthro[0], econ[0]]), 2);

// A correction the reader made to the catalog text is shown with the section.
assert.ok(area5.notes.some((n) => /^Note from the app: catalog prints 'ASTRON 27 OR ASTRON 27L'/.test(n)));

// Noncredit certificates print hours only for the pathway; the total verifies the section.
assert.equal(scored('Caregiving Essentials').choiceCaveatAreas, 0);

// Sections signed off in catalog/reviewed-sections.json are verified by review, tied to the catalog text.
const reviewedFile = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'reviewed-sections.json'), 'utf8'));
const reconciliation = JSON.parse(fs.readFileSync(path.join(root, 'data', 'catalog-2026-2027-reconciliation.json'), 'utf8'));
for (const entry of reviewedFile.sections.filter((e) => e.catalogYear === '2026-2027')) {
  const row = reconciliation.blocks.find((b) => b.program === entry.pathway && b.block === entry.section);
  assert.ok(row, `reviewed section exists: ${entry.pathway} / ${entry.section}`);
  assert.equal(row.sectionSha256, entry.sectionSha256, 'a review is tied to the catalog text it was made on');
  assert.equal(row.status, 'reviewed');
  assert.ok(entry.decidedBy && entry.decidedOn && entry.basis);
  const area = programNamed(entry.pathway).areas.find((a) => a.title === entry.section);
  assert.equal(area.review.decidedBy, entry.decidedBy);
}
assert.equal(scored('Political Science for Transfer').choiceCaveatAreas, 0);

// One 2026-27 pathway is still unverified, and it is the one the catalog itself contradicts.
const stillFlagged = programs.filter((p) => context.computeProgramView(p, analytics, TERM).choiceCaveatAreas > 0).map((p) => p.name);
assert.deepEqual(JSON.parse(JSON.stringify(stillFlagged)), ['Biology for Transfer - AS-T']);

// Unreconciled blocks are surfaced, never hidden.
const flagged = programs.filter((p) => context.computeProgramView(p, analytics, TERM).choiceCaveatAreas > 0);
const unverifiedBlocks = (status.unreconciled || 0) + (status['no-printed-units'] || 0) + (status.unscored || 0);
assert.ok(flagged.length > 0 === unverifiedBlocks > 0);

console.log(
  `Catalog structure tests passed (${programs.length} pathways, ${verified}/${catalog.meta.blocks} sections verified, ${flagged.length} pathways flagged).`
);
