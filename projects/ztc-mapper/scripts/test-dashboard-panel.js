#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(html, /const \[primaryView, setPrimaryView\] = useState\('program'\)/, 'primaryView must default to program');
assert.match(html, /const \[dashboardOpen, setDashboardOpen\] = useState\(false\)/, 'dashboardOpen must be independent boolean state');
assert.equal(html.includes("useState('dashboard')"), false, 'full-page dashboard view state must be removed');
assert.equal(html.includes("view === 'dashboard'"), false, 'Dashboard must not remain a reading-view branch');
assert.equal(html.includes("switchView('dashboard')"), false, 'Dashboard must not remain a top navigation destination');

assert.match(html, /aria-expanded=\{dashboardOpen\}/, 'Dashboard toggle must expose aria-expanded');
assert.match(html, /aria-controls="dashboard-panel"/, 'Dashboard toggle must point at aria-controls=dashboard-panel');
assert.match(html, /data-dashboard-pullout="true"/, 'Dashboard trigger must be the left-edge pullout tab');
assert.match(html, /className=\{`dashboard-pullout-tab/, 'Dashboard trigger must use pullout-tab styling');
assert.match(html, /id="dashboard-panel"/, 'dashboard-panel id is required');
assert.match(html, /id="sidebar-nav-panel"/, 'sidebar-nav-panel id is required');
assert.match(html, /data-sidebar-column="true"/, 'sidebar column marker is required for geometry tests');
assert.match(html, /data-reading-pane="true"/, 'reading pane marker is required for geometry tests');
assert.match(html, /sidebar-column w-72 lg:w-80/, 'Dashboard must keep the existing w-72 lg:w-80 sidebar width');
assert.match(html, /\.sidebar-column \{ position: relative; overflow: hidden; \}/, 'sidebar overflow must clip the sliding panes');
assert.match(html, /max-width: 639px/, 'Dashboard must switch to a primary canvas below 640px');
assert.match(html, /dashboard-primary-canvas/, 'narrow Dashboard primary-canvas state is required');
assert.match(html, /setIsNarrowViewport/, 'narrow viewport state must track breakpoint changes');
assert.match(html, /className=\{`sidebar-pane sidebar-pane-dash/, 'Dashboard must slide inside the sidebar, not replace the reading pane');
assert.match(html, /is-inactive/, 'inactive sliding content must be marked non-interactive');
assert.match(html, /inert: ''/, 'inactive pane must use inert so it is not keyboard-focusable');
assert.match(html, /aria-hidden=\{dashboardOpen && isNarrowViewport/, 'narrow reading pane must be hidden from assistive technology');
assert.match(html, /if \(e\.key !== 'Escape'\) return;/, 'Escape must close the Dashboard panel');
assert.match(html, /setDashboardOpen\(false\);/, 'Dashboard close must clear dashboardOpen');
assert.match(html, /prefers-reduced-motion: reduce/, 'reduced-motion support must remain');

assert.equal(html.includes('role="dialog"') && html.includes('aria-modal="true"') && /id="dashboard-panel"[\s\S]*role="dialog"/.test(html), false);
assert.doesNotMatch(
  html,
  /id="dashboard-panel"[^>]*(fixed inset-0|role="dialog")/,
  'Dashboard panel must not be a viewport-fixed dialog'
);

const viewsNav = html.match(/<nav aria-label="Views"[\s\S]*?<\/nav>/);
assert.ok(viewsNav, 'Views nav is required');
assert.match(viewsNav[0], />Pathway<\/button>/, 'Pathway must remain a primary view');
assert.match(viewsNav[0], />Courses<\/button>/, 'Courses must remain a primary view');
assert.equal(viewsNav[0].includes('>Dashboard</button>'), false, 'Dashboard must not be inside the Views nav');
const topBar = html.match(/\{\/\* top bar \*\/\}[\s\S]*?<\/header>/);
assert.ok(topBar, 'top bar is required');
assert.equal(topBar[0].includes('dashboardToggleRef'), false, 'Dashboard trigger must not remain in the top bar');

assert.equal(html.includes("view !== 'dashboard'"), false, 'exports must not be gated on a Dashboard reading view');
assert.match(html, /Current pathway \(CSV\)/, 'pathway CSV export must remain available');
assert.match(html, /Current pathway \(PDF\)/, 'pathway PDF export must remain available');

assert.match(html, /renderInstitutionTrendDetail/, 'full institution trend must have a reading-pane detail view');
assert.match(html, /primaryView === 'courses' \? renderCourseView\(\) : renderProgram\(\)/, 'main pane must preserve Pathway/Courses rendering');
assert.match(html, /const Sparkline =/, 'sidebar trend must use the compact sparkline');
assert.match(html, /Average ZTC adoption/, 'Dashboard must feature a headline adoption outcome');
assert.match(html, /dashboard-comparison-details/, 'distribution and ranking must use progressive disclosure');
assert.match(html, /Distribution by ZTC-ability/, 'stacked distribution must retain a text label');
assert.match(html, /View all pathways/, 'short ranking must offer a Pathway-view drill-down');
assert.match(html, /dashboard-pullout-tab\.is-open/, 'open pullout must use an edge indicator');
assert.equal(html.includes("dashboardOpen ? 'bg-blue-600 text-white'"), false, 'pullout must not use a solid-blue active fill');
assert.match(html, /Icons\.ChevronLeft/, 'open pullout must show a directional chevron');

console.log('Dashboard panel source regressions passed.');
