#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
};

const programPath = valueAfter('--program-summary');
const analyticsPath = valueAfter('--analytics');
const term = valueAfter('--term') || '2026/FA';
const outputPath = valueAfter('--output');
const baselineRef = valueAfter('--baseline-ref') || 'HEAD';

if (!programPath || !analyticsPath || !outputPath) {
  console.error(
    'usage: compare-fid1.js --program-summary FILE --analytics FILE --output FILE [--term TERM] [--baseline-ref REF]'
  );
  process.exit(2);
}

const loadRuntime = (html, label) => {
  const stableStartMarker = '    // PRODUCTION MODEL TEST START';
  const stableEndMarker = '    // PRODUCTION MODEL TEST END';
  const legacyStartMarker = '    // CONSTANTS';
  const legacyEndMarker = '    // SMALL COMPONENTS';
  const stableStart = html.indexOf(stableStartMarker);
  const stableEnd = html.indexOf(stableEndMarker);
  const hasStableMarker = stableStart !== -1 || stableEnd !== -1;
  if (hasStableMarker) {
    assert.notEqual(stableStart, -1, `${label}: stable production model start marker is missing`);
    assert.notEqual(stableEnd, -1, `${label}: stable production model end marker is missing`);
  }
  const start = hasStableMarker ? stableStart : html.indexOf(legacyStartMarker);
  const end = hasStableMarker ? stableEnd : html.indexOf(legacyEndMarker);
  assert.notEqual(start, -1, `${label}: production model start marker is missing`);
  assert.notEqual(end, -1, `${label}: production model end marker is missing`);
  assert.ok(end > start, `${label}: runtime markers are out of order`);

  const context = {};
  vm.runInNewContext(
    `${html.slice(start, end)}
    this.parseCSV = parseCSV;
    this.buildAnalytics = buildAnalytics;
    this.buildPrograms = buildPrograms;
    this.computeProgramView = computeProgramView;`,
    context
  );
  return context;
};

const baselineCommitSha = childProcess
  .execFileSync('git', ['rev-parse', '--verify', `${baselineRef}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
  .trim();
assert.match(baselineCommitSha, /^[0-9a-f]{40}$/i, 'resolved baseline must be a full commit SHA');

const baselineHtml = childProcess.execFileSync(
  'git',
  ['show', `${baselineCommitSha}:ztc-mapper/index.html`],
  { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
);
const currentHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const programBytes = fs.readFileSync(programPath);
const analyticsBytes = fs.readFileSync(analyticsPath);
const programText = programBytes.toString('utf8');
const analyticsText = analyticsBytes.toString('utf8');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const programSha256 = sha256(programBytes);
const analyticsSha256 = sha256(analyticsBytes);
assert.match(programSha256, /^[0-9a-f]{64}$/, 'Program Summary SHA-256 is invalid');
assert.match(analyticsSha256, /^[0-9a-f]{64}$/, 'Course Analytics SHA-256 is invalid');

const buildSnapshot = (html, label) => {
  const runtime = loadRuntime(html, label);
  const programs = runtime.buildPrograms(runtime.parseCSV(programText));
  const analyticsResult = runtime.buildAnalytics(runtime.parseCSV(analyticsText));
  const analytics = { index: analyticsResult.index };
  const scores = new Map(
    programs.map((program) => {
      const view = runtime.computeProgramView(program, analytics, term);
      return [
        program.name,
        {
          adoption_pct: view.adoptionPct,
          requirement_total: view.reqTotal,
          requirement_ztc: view.reqZtc
        }
      ];
    })
  );
  return { programs, scores };
};

const subgroupRows = (program) =>
  program.areas.flatMap((area, areaIndex) =>
    area.subgroups.map((subgroup, subgroupIndex) => ({
      key: `${areaIndex}:${subgroupIndex}:${area.title}:${subgroup.title || ''}`,
      area_title: area.title,
      subgroup_title: subgroup.title,
      courses: subgroup.courses.map((course) => course.key),
      options: (subgroup.options || []).map((option) => ({
        label: option.label,
        courses: option.courses.map((course) => course.key)
      }))
    }))
  );

const baseline = buildSnapshot(baselineHtml, 'baseline');
const current = buildSnapshot(currentHtml, 'current');
const baselinePrograms = new Map(baseline.programs.map((program) => [program.name, program]));
const currentPrograms = new Map(current.programs.map((program) => [program.name, program]));
const programNames = Array.from(
  new Set([...baselinePrograms.keys(), ...currentPrograms.keys()])
).sort();

const blockChanges = [];
for (const programName of programNames) {
  const beforeProgram = baselinePrograms.get(programName);
  const afterProgram = currentPrograms.get(programName);
  const beforeRows = new Map((beforeProgram ? subgroupRows(beforeProgram) : []).map((row) => [row.key, row]));
  const afterRows = new Map((afterProgram ? subgroupRows(afterProgram) : []).map((row) => [row.key, row]));
  const rowKeys = Array.from(new Set([...beforeRows.keys(), ...afterRows.keys()])).sort();
  for (const key of rowKeys) {
    const before = beforeRows.get(key) || null;
    const after = afterRows.get(key) || null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      blockChanges.push({
        program: programName,
        area_title: after?.area_title ?? before?.area_title ?? null,
        subgroup_title: after?.subgroup_title ?? before?.subgroup_title ?? null,
        before,
        after
      });
    }
  }
}

const scoreChanges = [];
for (const programName of programNames) {
  const before = baseline.scores.get(programName) || null;
  const after = current.scores.get(programName) || null;
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    scoreChanges.push({ program: programName, before, after });
  }
}

const comparison = {
  schema_version: 'ztc-fid1-comparison-v1',
  baseline_ref: baselineRef,
  baseline_commit_sha: baselineCommitSha,
  term,
  source_basenames: {
    program_summary: path.basename(programPath),
    analytics: path.basename(analyticsPath)
  },
  source_sha256: {
    program_summary: programSha256,
    analytics: analyticsSha256
  },
  summary: {
    baseline_programs: baseline.programs.length,
    current_programs: current.programs.length,
    changed_program_structures: new Set(blockChanges.map((change) => change.program)).size,
    changed_blocks: blockChanges.length,
    changed_program_scores: scoreChanges.length
  },
  block_changes: blockChanges,
  score_changes: scoreChanges
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
console.log(JSON.stringify(comparison.summary));
