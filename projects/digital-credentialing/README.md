# ACES Credentials Analytics Dashboard - Code Documentation

## Overview

The ACES Credentials Analytics Dashboard is a React-based web application for analyzing and visualizing Academic and Career/Community Employability Skills (ACES) digital credential data from Canvas Credentials/Badgr exports. It provides comprehensive analytics, pathway visualization, badge gallery, and export capabilities for tracking student skill credential achievements.

## Architecture

### Technology Stack
- **React 18** - UI framework
- **Tailwind CSS (CDN)** - Styling (CDN is appropriate for single-file apps)
- **Babel Standalone** - JSX compilation
- **Chart.js 4.4** - Data visualization (bar, line, donut charts)
- **jsPDF & jsPDF-AutoTable** - PDF report generation
- **SheetJS (XLSX)** - Excel/CSV export
- **html2canvas** - PNG screenshot export

### File Structure
- Single-file HTML application (`aces-credentials-dashboard-v3.html`)
- All code is inline with clear section organization
- Constants and configuration at the top
- Utility functions grouped by purpose
- React components defined with JSDoc documentation

### Note on Tailwind CDN Warning
You may see this console warning:
> "cdn.tailwindcss.com should not be used in production..."

**This warning can be safely ignored** for your use case because:
- This is a single-file application without a build pipeline
- The app loads once and stays open (minimal impact on load time)
- Keeps everything self-contained in one portable HTML file
- Internal tool, not a high-traffic public website

## ACES Framework Overview

### The 12 ACES Skills
1. **Adaptability** - Flexibility and resilience in changing situations
2. **Collaboration** - Teamwork and cooperation with others
3. **Communication** - Written and verbal expression
4. **Critical Thinking** - Analysis and problem-solving
5. **Digital Fluency** - Technology proficiency and digital literacy
6. **Empathy** - Understanding and relating to others
7. **Entrepreneurial Mindset** - Innovation and initiative
8. **Professionalism** - Workplace conduct and ethics
9. **Resilience** - Perseverance and recovery from setbacks
10. **Self-Awareness** - Personal insight and reflection
11. **Social/Global Awareness** - Cultural competency and global perspective
12. **Sustainability** - Environmental responsibility

### Credential Structure
- **Outcome Tokens**: 4 per skill, require 2× proficiency demonstrations
- **Skill Credentials**: Awarded after completing all 4 tokens for a skill
- **T-Shaped Skills**: Combines transferable ACES skills with technical discipline skills

## Code Organization

### CSS Section (Lines 27-185)
- **Accessibility Styles** (Lines 28-86)
  - Skip link styling
  - Screen reader only class (`.sr-only`)
  - Enhanced focus indicators
  - Reduced motion support
  - High contrast mode support
- **Modal & Scroll Lock Styles** (Lines 88-96)
- **Scrollbar Styles** (Lines 98-130)
- **Animation Keyframes** (Lines 132-155)
- **Animation Classes** (Lines 157-165)
- **Component Styles** (Lines 167-185)

### JavaScript Sections

| Section | Description | Approx. Lines |
|---------|-------------|---------------|
| 1. React Hooks & Imports | Hook destructuring | 219-222 |
| 2. SVG Icon Components | Accessible icon library | 224-510 |
| 3. ACES Skills Configuration | Skills, colors, tokens | 512-620 |
| 4. Theme Configuration | Dark/light theme settings | 622-680 |
| 5. Utility Functions | CSV parsing, data extraction | 682-850 |
| 5B. UI Components | ProgressRing, BadgeImage, StatCard | 852-1030 |
| 6. Badge Gallery Component | Badge display with modal | 1032-1215 |
| 7. Export Modal Component | CSV/PNG/PDF export | 1217-1420 |
| 8. Donut Chart Component | Skill distribution chart | 1422-1500 |
| 9. Year Comparison Component | YoY analytics cards | 1502-1600 |
| 10. Main App Component | Application logic | 1602-2080 |
| 11. App Initialization | ReactDOM render | 2082-2095 |

## Key Features

### 1. Data Import
- CSV file upload from Canvas Credentials/Badgr exports
- Automatic column detection for badge data
- Real-time data processing with loading state
- Supports thousands of badge records

### 2. Analytics Dashboard (Overview Tab)
- **Bar Chart**: Awards by ACES skill
- **Line Chart**: Monthly award trends
- **Donut Chart**: Skill distribution (muted colors for readability)
- **Year-over-Year Comparison**: Growth metrics with percentage change

### 3. Pathway Visualization (Pathways Tab)
- Token → Credential progression flow
- Progress rings showing completion status
- Visual mapping of 4 tokens per skill credential

### 4. Badge Gallery (Badges Tab)
- Grid display of all badge images
- Organized by ACES skill category
- Detail modal with badge information
- Fallback placeholder for missing images

### 5. Statistics Cards
- Total awards count
- Skill credentials vs. outcome tokens breakdown
- Unique skills tracked
- Award counts by category

### 6. Export Options
- **CSV**: Raw data spreadsheet
- **PNG**: Dashboard screenshot
- **PDF**: Formatted analytics report with charts

### 7. Theme Support
- Dark mode (default)
- Light mode
- Persisted to localStorage

## Data Flow

```
CSV Upload
    ↓
parseCSV() → Parse raw CSV text with quote handling
    ↓
processData() → Extract skill, token, credential info
    ↓
Build processedData array with badge objects
    ↓
Calculate statistics (useMemo hooks)
    ↓
Render dashboard with Chart.js visualizations
    ↓
Export as needed (CSV/PNG/PDF)
```

## Key Functions Reference

### `parseCSV(text)`
Parses CSV text with proper quote handling:
- Handles quoted fields containing commas
- Handles escaped quotes within fields
- Returns array of row arrays

### `processData(rawData)`
Processes raw CSV data into structured format:
- Extracts issue date, badge class name, image URL
- Determines skill and token from badge name
- Identifies credentials vs. tokens
- Returns array of processed badge objects

### `extractSkillInfo(badgeClassName)`
Extracts ACES skill and token information:
- Matches badge name against ACES_SKILLS configuration
- Returns `{ skill, token, isCredential }`

### `hexToRgba(hex, alpha)`
Converts hex color to rgba with opacity:
- Used for muted donut chart colors
- Enables transparency while maintaining color identity

## Statistics Calculation

### Skill Counts
```javascript
processedData.forEach(d => {
  skillCounts[d.skill] = (skillCounts[d.skill] || 0) + 1;
});
```

### Credential vs. Token Counts
```javascript
let credentialCount = 0;
processedData.forEach(d => {
  if (d.isCredential) credentialCount++;
});
const tokenCount = processedData.length - credentialCount;
```

### Monthly Distribution
```javascript
processedData.forEach(d => {
  const month = d.issueDate.toLocaleString('default', { month: 'short', year: '2-digit' });
  monthCounts[month] = (monthCounts[month] || 0) + 1;
});
```

### Year-over-Year Comparison
```javascript
const currentYearData = processedData.filter(d => d.issueDate.getFullYear() === currentYear);
const previousYearData = processedData.filter(d => d.issueDate.getFullYear() === previousYear);
const percentChange = ((current - previous) / previous) * 100;
```

## Configuration Constants

### ACES_SKILLS
Defines all 12 ACES skills with:
- `color`: Hex color code for charts
- `iconName`: Icon component reference
- `tokens`: Array of 4 outcome token names

### THEME_CONFIG
Dark and light theme configurations:
- Background colors
- Text colors (primary and muted)
- Card styles (background, border, hover)
- Modal styles
- Chart text colors
- Input/button styling

## LocalStorage

### Theme Persistence
- Key: `aces-theme`
- Values: `"dark"` or `"light"`
- Retrieved on app initialization
- Updated on theme toggle

## Modifying the Application

### Adding a New ACES Skill
```javascript
const ACES_SKILLS = {
  // ... existing skills
  'New Skill': {
    color: '#hexcode',
    iconName: 'IconName',
    tokens: ['Token 1', 'Token 2', 'Token 3', 'Token 4']
  }
};
```

### Changing Chart Colors/Opacity
Update the `donutChartData` useMemo to adjust opacity:
```javascript
backgroundColor: sortedSkills.map(([skill]) => 
  hexToRgba(ACES_SKILLS[skill]?.color || '#6b7280', 0.7)  // Adjust 0.7
),
```

### Adding New Export Format
1. Create export function following existing pattern
2. Add button in ExportModal component
3. Include appropriate ARIA labels for accessibility

### Modifying Theme Colors
Update `THEME_CONFIG` constant:
```javascript
const THEME_CONFIG = {
  dark: {
    bg: 'bg-slate-950',
    card: 'bg-slate-900/50',
    // ... more properties
  },
  light: {
    bg: 'bg-gray-50',
    card: 'bg-white',
    // ... more properties
  }
};
```

## Browser Compatibility

- Modern browsers with ES6+ support
- Requires JavaScript enabled
- LocalStorage support for theme persistence
- FileReader API for CSV upload
- Canvas API for chart rendering

## Performance Considerations

- Charts use `useMemo` for data computation (prevents recalculation)
- Chart instances properly destroyed on updates (prevents memory leaks)
- Loading state prevents UI interaction during processing
- Scroll lock prevents background scrolling in modals
- Simple CSS animations (no GPU-forcing on repeated elements)

## Error Handling

- CSV parsing includes robust quote handling
- Image loading with fallback placeholders
- Theme defaults to dark if localStorage unavailable
- Console logging for debugging
- Graceful handling of missing/malformed data

## Accessibility Features

Complete WCAG 2.1 Level AA compliance:
- Skip to main content link
- ARIA labels on all interactive elements
- ARIA roles for semantic structure
- Keyboard navigation (Tab, Enter, Escape)
- Focus trap in modals
- Focus return after modal close
- Screen reader announcements
- Reduced motion support
- High contrast mode support
- Decorative icons marked with aria-hidden

## Version History

- **v1.0**: Initial dashboard with basic charts
- **v2.0**: Added pathway visualization, badge gallery, export suite
- **v3.0**: Full accessibility compliance, muted donut colors, scroll lock, code organization

## File Locations Quick Reference

| Feature | Section | Approx. Lines |
|---------|---------|---------------|
| Accessibility CSS | Head styles | 27-86 |
| Scroll Lock CSS | Head styles | 88-96 |
| Animation CSS | Head styles | 132-165 |
| Skip Link HTML | Body | 188-189 |
| Icons | Section 2 | 224-510 |
| ACES Config | Section 3 | 512-620 |
| Theme Config | Section 4 | 622-680 |
| ProgressRing | Section 5 | 735-790 |
| BadgeImage | Section 5 | 795-860 |
| StatCard | Section 5 | 865-910 |
| BadgeGallery | Section 6 | 1032-1215 |
| ExportModal | Section 7 | 1217-1420 |
| DonutChart | Section 8 | 1422-1500 |
| YearComparison | Section 9 | 1502-1600 |
| Main App | Section 10 | 1602-2080 |

## Support

For questions or issues:
1. Check this documentation
2. Review function JSDoc comments in code
3. Check browser console for errors
4. Verify CSV format matches Canvas Credentials export

## Related Documentation

- `ACCESSIBILITY_VERIFICATION.md` - ADA compliance details
- `QUICK_REFERENCE.md` - Quick guide for modifications
- `CODE_ORGANIZATION.md` - Detailed code structure
- `FEATURES_SUMMARY.md` - Feature overview
