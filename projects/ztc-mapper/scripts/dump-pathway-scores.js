#!/usr/bin/env node
'use strict';

// Score every pathway for every built-in catalog year from a ZTC course dataset CSV.
// Same output shape as the Rust twin's `ztc-bake`, so the two models can be compared
// value for value:
//   node scripts/dump-pathway-scores.js dataset.csv > production.json
//   (cd ../ztc-mapper-rs && cargo run -p ztc_bake -- dataset.csv -o rust.json)
// Never commit institutional CSVs or their output.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const [input] = process.argv.slice(2);
if (!input) {
  console.error('usage: dump-pathway-scores.js ZTC_DATASET.csv > scores.json');
  process.exit(2);
}
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('    // PRODUCTION MODEL TEST START');
const end = html.indexOf('    // PRODUCTION MODEL TEST END');
const context = { window: {} };
for (const file of fs.readdirSync(path.join(root, 'data')).filter((name) => /^catalog-\d{4}-\d{4}\.js$/.test(name)).sort()) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', file), 'utf8'), context);
}
vm.runInNewContext(
  `${html.slice(start, end)}
  this.api = { parseCSV, buildAnalytics, programsFromCatalog, computeProgramView, yearStatus, catalogYears };`,
  context
);
const api = context.api;
const analytics = api.buildAnalytics(api.parseCSV(fs.readFileSync(input, 'utf8')));

const pathway = (program, period) => {
  const view = api.computeProgramView(program, analytics, period);
  return {
    name: program.name,
    type: program.type,
    pct: view.adoptionPct,
    reqZtc: view.reqZtc,
    reqTotal: view.reqTotal,
    units: view.unitsRequiredLabel,
    unverifiedSections: view.choiceCaveatAreas,
    coursesWithData: view.coursesWithData,
    coursesTotal: view.coursesTotal,
    avgSurvey: view.avgSurvey,
    coCount: view.coCount,
    areas: view.areas.map((area) => ({
      title: area.title,
      pct: area.areaPct,
      units: area.unitsLabel,
      ztcOptions: area.ztcCount,
      options: area.dataCount,
      unscored: area.unscored
    }))
  };
};

const years = {};
const catalogYears = api.catalogYears();
for (const year of catalogYears) {
  const status = api.yearStatus(analytics, analytics.terms, year);
  years[year] = {
    surveyPct: status.surveyPct,
    inProgress: status.inProgress,
    reason: status.reason,
    pathways: api.programsFromCatalog(context.window.ZTC_CATALOGS[year]).map((program) => pathway(program, year))
  };
}
const byTerm = {};
const latest = api.programsFromCatalog(context.window.ZTC_CATALOGS[catalogYears[catalogYears.length - 1]]);
for (const term of analytics.terms) {
  byTerm[term] = latest.map((program) => api.computeProgramView(program, analytics, term).adoptionPct);
}
process.stdout.write(JSON.stringify({ terms: analytics.terms, years, byTerm }));
