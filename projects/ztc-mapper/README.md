# ZTC Pathway Mapper - Code Documentation

## Overview

The ZTC Pathway Mapper is a React-based web application for analyzing and visualizing Zero Textbook Cost (ZTC) course data across academic pathways. It allows users to upload CSV data, map columns, visualize pathway progress, and export reports in multiple formats.

## Architecture

### Technology Stack
- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Babel Standalone** - JSX compilation
- **jsPDF & jsPDF-AutoTable** - PDF generation
- **SheetJS (XLSX)** - Excel export
- **Chart.js** - Data visualization
- **html2canvas** - PNG screenshot export

### File Structure
- Single-file HTML application (`index-v2.html`)
- All code is inline with clear section organization
- Constants and configuration at the top
- Utility functions grouped by purpose
- React components defined within main component

## Code Organization

### Constants & Configuration
Located at the top of the file (after Icons definition):

- **ZTC_THRESHOLDS** - Percentage thresholds for ZTC status categorization
- **STORAGE_KEYS** - LocalStorage keys for persistence
- **DEFAULT_COLUMN_MAPPING** - Initial CSV column mapping state
- **COLUMN_PATTERNS** - Auto-detection patterns for CSV columns
- **EXPORT_CONFIG** - Configuration for export functionality
- **COURSE_CATALOG_URL** - External course catalog URL template
- **THEME_CONFIG** - Dark and light theme configurations
- **ZTC_STATUS_CONFIG** - Badge styling for ZTC statuses

### Utility Functions
Reusable helper functions for common operations:

- `parsePercentage(value)` - Parses percentage values from various formats
- `getPercentageColorClass(percentage)` - Gets color class based on ZTC percentage
- `getMetricBackgroundClass(percentage)` - Gets background class for metric cards
- `getProgressBarColorClass(percentage)` - Gets progress bar color based on percentage

### Main Sections

#### 1. CSV Processing & Data Import
- `parseCSV(text)` - Parses CSV with proper quote handling
- `autoDetectMapping(headers)` - Auto-detects column mappings
- `handleFileUpload(event)` - Handles file upload
- `processCSVData()` - Processes mapped CSV data
- `determineZTCStatus(value)` - Determines ZTC status from percentage

#### 2. Statistics Calculation
- `getCoursesForArea(pathwayName, area)` - Gets courses for a pathway area
- `calculateAreaStats(area)` - Calculates ZTC stats for an area
- `calculateFilteredAreaStats(area)` - Calculates filtered area stats
- `calculatePathwayStats(pathway)` - Calculates overall pathway stats
- `calculateFilteredPathwayStats(pathway)` - Calculates filtered pathway stats
- `getFilteredCourses(area)` - Filters courses based on search/filters

#### 3. Project Management
- `loadProject(project)` - Loads a project into application state
- `saveProject(name, coursesData, pathwaysData)` - Saves current state as project
- `deleteProject(projectId)` - Deletes a project
- `clearDatasource()` - Resets application to initial state

#### 4. Export Functionality
- `exportAnalysis()` - Opens export modal
- `createChartDataURL(pathway, stats)` - Creates chart for PDF embedding
- `exportToCSV(pathwayName)` - Exports to CSV format
- `exportToExcel(pathwayName)` - Exports to Excel with multiple sheets
- `exportToPDF(pathwayName)` - Exports to PDF with charts
- `exportToPNG()` - Exports dashboard screenshot
- `exportAllPathways(format)` - Batch exports all pathways

#### 5. UI Components
- `ZTCBadge` - Status badge component
- `CourseCard` - Course card display component
- `CourseDetailModal` - Detailed course information modal
- `AreaColumn` - Area column with course list
- `ProgressDashboard` - Main dashboard with statistics

#### 6. Accessibility & Keyboard Navigation
- ESC key handling for modal closing
- Focus trap for modals
- Focus return management

## ZTC Percentage Calculation Logic

### Thresholds
- **75-100%** = ZTC (fully zero textbook cost)
- **51-74%** = Partial (partially zero textbook cost)
- **0-50%** = Not ZTC (not zero textbook cost)

### Calculation Method
1. **Area Level**: Counts courses with `ztcStatus === 'ztc'` (75%+) only
   - Formula: `(ztcCount / totalCourses) * 100`
   - Partial courses (51-74%) are tracked separately but **do not** contribute to percentage

2. **Pathway Level**: 
   - Uses `Set` to deduplicate courses across multiple areas
   - A course appearing in both "Area A" and "Area B" counts only once
   - Same calculation method: only fully ZTC courses (75%+) count toward percentage

### Important Notes
- The percentage represents "ZTC Complete" - only fully ZTC courses count
- Partial courses are displayed separately in the UI but don't affect the percentage
- This is intentional design to show completion status, not weighted progress

## Data Flow

```
CSV Upload
  ↓
parseCSV() → Parse raw CSV text
  ↓
autoDetectMapping() → Auto-detect column mappings
  ↓
User confirms/edits mappings
  ↓
processCSVData() → Extract courses and pathways
  ↓
determineZTCStatus() → Categorize each course
  ↓
Build pathway structure
  ↓
Save as project (localStorage)
  ↓
Display in UI
  ↓
calculatePathwayStats() / calculateAreaStats() → Calculate percentages
  ↓
Render dashboard and area columns
```

## Key Functions Reference

### `determineZTCStatus(value)`
Converts raw ZTC percentage value to status category:
- Handles text indicators ("ztc", "partial", "not")
- Parses numeric values
- Applies ZTC_THRESHOLDS constants

### `calculatePathwayStats(pathway)`
Calculates overall pathway statistics:
- Deduplicates courses using Set
- Counts ZTC, Partial, and Not ZTC courses
- Returns percentage based on fully ZTC courses only

### `processCSVData()`
Main data processing function:
- Extracts course data from CSV rows
- Determines ZTC status for each course
- Maps courses to pathway areas
- Builds pathway structure
- Saves as project

## Modifying the Application

### Changing ZTC Thresholds
Update `ZTC_THRESHOLDS` constant:
```javascript
const ZTC_THRESHOLDS = {
  ZTC_MIN: 75,        // Change this value
  PARTIAL_MIN: 51,    // Change this value
  NOT_ZTC_MAX: 50     // Change this value
};
```

### Adding New Export Format
1. Create new export function following existing pattern
2. Add button in Export Modal component
3. Update `exportAllPathways()` if batch export needed

### Modifying Theme Colors
Update `THEME_CONFIG` constant:
```javascript
const THEME_CONFIG = {
  dark: {
    colors: { /* ... */ },
    scrollbar: { /* ... */ }
  },
  light: { /* ... */ }
};
```

### Adding New CSV Column Patterns
Update `COLUMN_PATTERNS` constant:
```javascript
const COLUMN_PATTERNS = {
  course: ['course code', 'course', 'new pattern'],
  // ...
};
```

## LocalStorage Structure

### Projects
Key: `ztc-projects`
Structure:
```json
[
  {
    "id": 1234567890,
    "name": "Project Name",
    "created": "2024-01-01T00:00:00.000Z",
    "lastModified": "2024-01-01T00:00:00.000Z",
    "courses": [...],
    "pathways": [...],
    "columnMapping": {...}
  }
]
```

### Theme
Key: `ztc-theme`
Value: `"dark"` or `"light"`

## Error Handling

- CSV parsing includes quote handling for complex data
- Division by zero protection in all percentage calculations
- Null/undefined checks in statistics functions
- Try-catch blocks for localStorage operations
- Validation in export functions

## Browser Compatibility

- Modern browsers with ES6+ support
- Requires JavaScript enabled
- LocalStorage support required
- FileReader API for CSV upload

## Performance Considerations

- Excel export limited to 10 area sheets per pathway
- Batch exports include delays to prevent browser throttling
- Chart rendering includes delay for proper canvas generation
- Course deduplication uses Set for O(1) lookups

## Accessibility Features

- ARIA labels and roles throughout
- Keyboard navigation (ESC to close modals)
- Focus trap in modals
- Screen reader support (sr-only class)
- Skip to main content link
- Enhanced focus indicators

## Maintenance Notes

### Code Style
- JSDoc comments for all major functions
- Clear section headers with `// ========================================`
- Descriptive variable names
- Constants extracted to top of file
- Error handling in critical paths

### Testing Recommendations
1. Test CSV upload with various formats
2. Verify percentage calculations with known data
3. Test export functionality with large datasets
4. Verify theme persistence
5. Test keyboard navigation and accessibility

### Common Issues
- **CSV parsing errors**: Check for proper quote handling
- **Percentage calculations**: Verify ZTC_THRESHOLDS are correct
- **Export failures**: Check browser console for errors
- **Theme not persisting**: Verify STORAGE_KEYS constant

## Future Improvements

Potential enhancements for future development:
1. Split into modular files (components, utils, constants)
2. Add TypeScript for type safety
3. Implement unit tests
4. Add data validation layer
5. Support for additional export formats
6. Real-time collaboration features
7. Server-side data persistence

## Support

For questions or issues:
1. Check this documentation
2. Review function JSDoc comments
3. Check browser console for errors
4. Verify constants match requirements

