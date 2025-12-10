# ACES Dashboard - Code Organization Guide

## File Structure Overview

The ACES Credentials Analytics Dashboard is a **single-file HTML application** containing:
- HTML structure
- CSS styles (in `<style>` tags)
- JavaScript/React code (in `<script type="text/babel">` tags)

**Total Lines**: ~2,095  
**File**: `aces-credentials-dashboard-v3.html`

---

## Document Structure

```
<!DOCTYPE html>
├── <head>
│   ├── Meta tags & Title
│   ├── External Libraries (CDN)
│   │   ├── Tailwind CSS
│   │   ├── React 18
│   │   ├── Babel Standalone
│   │   ├── Chart.js 4.4
│   │   ├── jsPDF & AutoTable
│   │   ├── SheetJS (XLSX)
│   │   └── html2canvas
│   └── <style> CSS Section
│       ├── Accessibility Styles
│       ├── Modal & Scroll Lock
│       ├── Scrollbar Styles
│       ├── Animation Keyframes
│       ├── Animation Classes
│       └── Component Styles
├── <body>
│   ├── Skip Link (accessibility)
│   ├── <div id="root">
│   └── <script type="text/babel"> JavaScript/React
│       ├── Section 1: React Hooks
│       ├── Section 2: Icon Components
│       ├── Section 3: ACES Skills Config
│       ├── Section 4: Theme Config
│       ├── Section 5: Utility Functions
│       ├── Section 5B: UI Components
│       ├── Section 6: Badge Gallery
│       ├── Section 7: Export Modal
│       ├── Section 8: Donut Chart
│       ├── Section 9: Year Comparison
│       ├── Section 10: Main App
│       └── Section 11: App Init
└── </html>
```

---

## CSS Sections (Lines 27-185)

### Accessibility Styles (Lines 28-86)
```css
/* Skip link for keyboard navigation */
.skip-link { ... }
.skip-link:focus { ... }

/* Screen reader only content */
.sr-only { ... }

/* Enhanced focus indicators */
*:focus-visible { ... }

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) { ... }

/* High contrast mode */
@media (prefers-contrast: high) { ... }
```

### Modal & Scroll Lock (Lines 88-96)
```css
body.modal-open {
  overflow: hidden;
  padding-right: 8px; /* Prevent layout shift */
}
```

### Scrollbar Styles (Lines 98-130)
Custom scrollbar styling for webkit browsers with dark/light theme support.

### Animation Keyframes (Lines 132-155)
```css
@keyframes fadeIn { ... }
@keyframes scaleIn { ... }
@keyframes pulse { ... }
```

### Animation Classes (Lines 157-165)
```css
.animate-fadeIn { ... }
.animate-scaleIn { ... }
.animate-pulse-subtle { ... }
```

### Component Styles (Lines 167-185)
Tab underline animation and other component-specific styles.

---

## JavaScript Sections

### Section 1: React Hooks & Imports (Lines 219-222)
```javascript
const { useState, useEffect, useMemo, useRef, useCallback } = React;
```

### Section 2: SVG Icon Components (Lines 224-510)
```javascript
const Icons = {
  Upload: (props) => <svg aria-hidden="true" ...>,
  Download: (props) => <svg aria-hidden="true" ...>,
  Sun: (props) => <svg aria-hidden="true" ...>,
  Moon: (props) => <svg aria-hidden="true" ...>,
  Award: (props) => <svg aria-hidden="true" ...>,
  BarChart: (props) => <svg aria-hidden="true" ...>,
  // ... 20+ icons total
};
```

**Key Points:**
- All icons include `aria-hidden="true"` for accessibility
- Props spread allows className and styling customization
- Consistent stroke-based design (Lucide-style)

### Section 3: ACES Skills Configuration (Lines 512-620)
```javascript
const ACES_SKILLS = {
  'Adaptability': {
    color: '#f59e0b',        // Amber
    iconName: 'Lightbulb',
    tokens: ['Token 1', 'Token 2', 'Token 3', 'Token 4']
  },
  'Collaboration': {
    color: '#3b82f6',        // Blue
    iconName: 'Users',
    tokens: [...]
  },
  // ... 12 skills total
};
```

**Key Points:**
- Each skill has unique color for charts
- Icon references link to Icons object
- Tokens array defines the 4 outcome tokens per skill

### Section 4: Theme Configuration (Lines 622-680)
```javascript
const THEME_CONFIG = {
  dark: {
    bg: 'bg-slate-950',
    card: 'bg-slate-900/50',
    cardBorder: 'border-slate-800',
    cardHover: 'hover:bg-slate-800/50',
    text: 'text-white',
    textMuted: 'text-slate-400',
    modal: 'bg-slate-900',
    modalBorder: 'border-slate-700',
    chartText: '#e2e8f0',
    chartGrid: '#334155',
    input: 'bg-slate-800',
    inputBorder: 'border-slate-700',
    inputFocus: 'focus:ring-blue-500',
  },
  light: {
    bg: 'bg-gray-50',
    card: 'bg-white',
    // ... corresponding light theme values
  }
};
```

### Section 5: Utility Functions (Lines 682-850)

#### hexToRgba (Lines 685-700)
```javascript
/**
 * Converts hex color to rgba with specified opacity
 * @param {string} hex - Hex color code (#RRGGBB)
 * @param {number} alpha - Opacity (0-1)
 * @returns {string} rgba color string
 */
const hexToRgba = (hex, alpha) => { ... };
```

#### parseCSV (Lines 705-750)
```javascript
/**
 * Parses CSV text with proper quote handling
 * @param {string} text - Raw CSV text
 * @returns {Array<Array<string>>} Array of row arrays
 */
const parseCSV = (text) => { ... };
```

#### processData (Lines 755-820)
```javascript
/**
 * Processes raw CSV data into structured badge objects
 * @param {Array} rawData - Parsed CSV rows
 * @returns {Array} Processed badge objects
 */
const processData = (rawData) => { ... };
```

#### extractSkillInfo (Lines 825-850)
```javascript
/**
 * Extracts ACES skill and token from badge class name
 * @param {string} badgeClassName - Badge name from CSV
 * @returns {Object} { skill, token, isCredential }
 */
const extractSkillInfo = (badgeClassName) => { ... };
```

### Section 5B: UI Components (Lines 852-1030)

#### ChartComponent (Lines 855-920)
Wrapper component for Chart.js with:
- Automatic chart destruction on data change
- Theme-aware styling
- Proper canvas reference management

#### ProgressRing (Lines 925-980)
SVG circular progress indicator with:
- Configurable size and stroke width
- Theme support
- Full ARIA accessibility (`role="progressbar"`, `aria-valuenow`, etc.)

#### BadgeImage (Lines 985-1025)
Badge image display with:
- Lazy loading support
- Fallback placeholder
- Error handling
- Alt text from badge name

#### StatCard (Lines 1000-1030)
Statistics card component with:
- Icon, value, and label display
- Theme-aware styling
- `role="region"` for accessibility

### Section 5C: Skill Pathway Card (Lines 1035-1120)
Displays token → credential progression:
- Progress ring showing completion
- Token list with completion indicators
- Visual flow from tokens to credential

### Section 6: Badge Gallery Component (Lines 1125-1215)
```javascript
/**
 * Gallery display of all badge images organized by skill.
 * Features: scroll lock, keyboard navigation, modal detail view.
 */
const BadgeGallery = ({ data, theme }) => { ... };
```

**Key Features:**
- Grid layout of badge images
- Click to view badge details
- Detail modal with scroll lock
- ESC key to close
- Grouped by ACES skill
- ARIA labels and roles

### Section 7: Export Modal Component (Lines 1220-1420)
```javascript
/**
 * Modal for exporting dashboard data.
 * Supports: CSV, PNG, PDF formats.
 * Features: scroll lock, focus trap, keyboard navigation.
 */
const ExportModal = ({ isOpen, onClose, data, theme }) => { ... };
```

**Key Features:**
- Three export formats (CSV, PNG, PDF)
- Scroll lock when open
- Focus management
- ESC key handling
- Theme-aware styling

### Section 8: Donut Chart Component (Lines 1425-1500)
```javascript
/**
 * Donut chart showing skill distribution.
 * Uses muted colors (70% opacity) for readability.
 */
const DonutChart = ({ data, theme }) => { ... };
```

**Key Features:**
- Chart.js doughnut chart
- Muted colors via hexToRgba
- Center label with total
- Theme-aware text colors
- `role="img"` with `aria-label`

### Section 9: Year Comparison Component (Lines 1505-1600)
```javascript
/**
 * Year-over-year comparison cards.
 * Shows current vs previous year with percentage change.
 */
const YearComparison = ({ data, theme }) => { ... };
```

**Key Features:**
- Current year vs previous year metrics
- Percentage change calculation
- Trend indicators (up/down arrows)
- Color-coded positive/negative changes

### Section 10: Main App Component (Lines 1605-2080)
```javascript
/**
 * Main application component.
 * Manages state, data processing, and renders all UI.
 */
const App = () => { ... };
```

**State Variables:**
- `processedData` - Parsed badge data
- `theme` - Current theme ('dark' | 'light')
- `activeTab` - Current tab ('overview' | 'pathways' | 'badges')
- `showExportModal` - Export modal visibility
- `selectedBadge` - Selected badge for detail view

**Key useMemo Hooks:**
- `skillCounts` - Awards per skill
- `monthlyData` - Monthly distribution
- `credentialCount` - Skill credentials count
- `tokenCount` - Outcome tokens count
- `skillChartData` - Bar chart data
- `lineChartData` - Line chart data
- `donutChartData` - Donut chart data

**Render Structure:**
```jsx
<div className={themeColors.bg}>
  <header>
    {/* Logo, title, theme toggle, export button */}
  </header>
  
  <main id="main-content">
    {processedData.length === 0 ? (
      <EmptyState />
    ) : (
      <>
        <StatsCards />
        <TabNavigation />
        
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'pathways' && <PathwaysTab />}
        {activeTab === 'badges' && <BadgesTab />}
      </>
    )}
  </main>
  
  <ExportModal />
</div>
```

### Section 11: App Initialization (Lines 2082-2095)
```javascript
// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

---

## Data Flow Diagram

```
┌─────────────────┐
│   CSV Upload    │
│   (File Input)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   parseCSV()    │
│  Quote handling │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  processData()  │
│ Extract fields  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│extractSkillInfo │
│ Match to ACES   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ processedData   │
│    (state)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │ useMemo │
    │  hooks  │
    └────┬────┘
         │
    ┌────┼────────┬──────────┐
    ▼    ▼        ▼          ▼
┌──────┐┌──────┐┌──────┐┌──────────┐
│Stats ││Charts││Gallery││ Pathways │
│Cards ││      ││       ││          │
└──────┘└──────┘└──────┘└──────────┘
         │
         ▼
┌─────────────────┐
│  Export Modal   │
│ CSV/PNG/PDF     │
└─────────────────┘
```

---

## Component Hierarchy

```
App
├── Header
│   ├── Logo & Title
│   ├── ThemeToggle (button)
│   ├── ExportButton (button)
│   └── ClearButton (button)
│
├── Empty State (conditional)
│   └── FileUpload
│
├── Dashboard Content (conditional)
│   ├── StatCards (4x)
│   │   └── StatCard (icon, value, label)
│   │
│   ├── TabNavigation
│   │   └── Tab buttons (3x)
│   │
│   ├── Overview Tab
│   │   ├── BarChart (ChartComponent)
│   │   ├── LineChart (ChartComponent)
│   │   ├── DonutChart
│   │   └── YearComparison
│   │
│   ├── Pathways Tab
│   │   └── SkillPathwayCard (12x)
│   │       └── ProgressRing
│   │
│   └── Badges Tab
│       └── BadgeGallery
│           ├── BadgeImage (multiple)
│           └── Badge Detail Modal
│
└── ExportModal (conditional)
    └── Export Buttons (CSV, PNG, PDF)
```

---

## Section Headers in Code

The code uses clear section markers for navigation:

```javascript
// ============================================
// 1. SECTION NAME
// ============================================

// --------------------------------------------
// Subsection Name
// --------------------------------------------
```

**Section Count**: 11 major sections + subsections

---

## JSDoc Documentation Style

All major functions include JSDoc comments:

```javascript
/**
 * Brief description of function purpose.
 * Additional details if needed.
 * 
 * @param {type} paramName - Parameter description
 * @returns {type} Return value description
 */
const functionName = (paramName) => {
  // implementation
};
```

---

## Key Design Decisions

### 1. Single-File Architecture
- **Why**: Portability, no build step required
- **Trade-off**: Larger file size, but simpler deployment

### 2. CDN Libraries
- **Why**: No npm/build dependencies
- **Trade-off**: Requires internet connection on first load

### 3. useMemo for Statistics
- **Why**: Prevent recalculation on every render
- **Trade-off**: Memory usage for cached values

### 4. Theme via State + localStorage
- **Why**: Persist user preference
- **Trade-off**: Flash of wrong theme possible (mitigated)

### 5. ACES_SKILLS as Constant
- **Why**: Easy to modify skills/tokens
- **Trade-off**: Requires code change to add skills

---

## Modification Guidelines

### Adding New Code
1. Find appropriate section using headers
2. Follow existing patterns and naming
3. Add JSDoc comments for functions
4. Include ARIA attributes for accessibility
5. Support both theme modes

### Testing Changes
1. Test both themes
2. Test keyboard navigation
3. Test with screen reader
4. Verify chart rendering
5. Test all export formats

---

## File Size Breakdown (Approximate)

| Section | Lines | % of Total |
|---------|-------|------------|
| HTML/CSS | 190 | 9% |
| Icons | 290 | 14% |
| Configuration | 170 | 8% |
| Utility Functions | 170 | 8% |
| UI Components | 180 | 9% |
| Badge Gallery | 90 | 4% |
| Export Modal | 200 | 10% |
| Charts | 175 | 8% |
| Main App | 480 | 23% |
| Other | 150 | 7% |
| **Total** | **~2,095** | **100%** |
