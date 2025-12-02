# Quick Reference: Adding New Features

## Adding a New Filter Dropdown

### Example: Adding "Pathway Progression" Filter

**Time Required:** ~30 minutes

**Steps:**

1. **Add to filter state** (Line ~500):
```javascript
const [filters, setFilters] = useState({
  search: '',
  term: 'all',
  ztcStatus: 'all',
  pathwayProgression: 'all'  // ADD THIS
});
```

2. **Add column pattern** (Line ~320):
```javascript
const COLUMN_PATTERNS = {
  // ... existing
  pathwayProgression: ['progression', 'pathway progression']  // ADD THIS
};
```

3. **Extract in CSV processing** (Line ~790, in processCSVData):
```javascript
course.pathwayProgression = row[headers.indexOf(columnMapping.pathwayProgression)] || '';
```

4. **Add filter logic** (Line ~1575, in getFilteredCourses):
```javascript
if (filters.pathwayProgression !== 'all') {
  filtered = filtered.filter(course => 
    course.pathwayProgression === filters.pathwayProgression
  );
}
```

5. **Add UI dropdown** (Line ~2272, after ZTC filter):
```javascript
<select
  value={filters.pathwayProgression}
  onChange={(e) => updateFilter('pathwayProgression', e.target.value)}
  className={`px-3 py-1.5 ${theme.input} rounded-lg text-sm font-medium focus:outline-none focus:ring-2 ${theme.inputFocus}`}
  aria-label="Filter by pathway progression"
>
  <option value="all">All Progressions</option>
  {availableProgressions.map(prog => (
    <option key={prog} value={prog}>{prog}</option>
  ))}
</select>
```

6. **Update clear function** (Line ~525):
```javascript
const clearAllFilters = () => {
  setSearchQuery('');
  setTermFilter('all');
  setZtcFilter('all');
  updateFilter('pathwayProgression', 'all');  // ADD THIS
};
```

7. **Get available values** (add useMemo, Line ~1580):
```javascript
const availableProgressions = useMemo(() => {
  return Array.from(new Set(courses.map(c => c.pathwayProgression).filter(Boolean))).sort();
}, [courses]);
```

**Done!** Filter automatically works with all existing functionality.

---

## Adding Area Requirements from CSV

### Automatic Detection

**No code changes needed!** Just add columns to your CSV:

- Column name pattern: `"[Area Name] Required"`
- Examples:
  - "Area A Required" → Sets requirement for "Area A"
  - "List B Required" → Sets requirement for "List B"
  - "GETC-1A Required" → Sets requirement for "GETC-1A"

**The system will:**
1. ✅ Automatically detect these columns
2. ✅ Extract requirement values
3. ✅ Display in area columns
4. ✅ Show in area summary cards

**Example CSV:**
```
Course Code,Area A,Area A Required,List B,List B Required
MATH 101,Area A,2,List B,1
ENG 101,Area A,2,,
```

---

## Adding More Area Metadata

### Example: Adding Min/Max Courses

**Time Required:** ~15 minutes

**Steps:**

1. **Update CSV processing** (Line ~900, after requirements detection):
```javascript
// Detect min/max columns
const areaMinCourses = {};
const areaMaxCourses = {};
headers.forEach((header, index) => {
  const minMatch = header.match(/(.+?)\s+Min/i);
  const maxMatch = header.match(/(.+?)\s+Max/i);
  if (minMatch) {
    const areaName = minMatch[1].trim();
    const value = data[0]?.[index];
    if (value) areaMinCourses[areaName] = parseInt(value, 10);
  }
  if (maxMatch) {
    const areaName = maxMatch[1].trim();
    const value = data[0]?.[index];
    if (value) areaMaxCourses[areaName] = parseInt(value, 10);
  }
});

// Add to pathway structure
if (hasRequirements) {
  pathway.areas = pathway.areas.map(areaName => {
    return {
      name: areaName,
      coursesRequired: areaRequirements[areaName] || 0,
      minCourses: areaMinCourses[areaName] || 0,  // NEW
      maxCourses: areaMaxCourses[areaName] || 0   // NEW
    };
  });
}
```

2. **Use in components** (Line ~1870, in AreaColumn):
```javascript
const areaMetadata = getAreaMetadata(area);
const minCourses = areaMetadata?.minCourses || 0;
const maxCourses = areaMetadata?.maxCourses || 0;

// Display if available
{minCourses > 0 && (
  <div className="text-xs text-blue-400">Min: {minCourses}</div>
)}
```

---

## Code Locations Quick Reference

| Feature | Location | Lines |
|---------|----------|-------|
| Filter State | State Management | ~490-510 |
| Filter Helpers | State Management | ~490-530 |
| Filter Logic | getFilteredCourses | ~1556-1580 |
| Filter UI | Header Section | ~2259-2298 |
| Compatibility Helpers | Statistics Section | ~1400-1430 |
| CSV Processing | processCSVData | ~773-920 |
| Requirements Detection | processCSVData | ~880-920 |
| AreaColumn Component | UI Components | ~1855-1920 |
| ProgressDashboard | UI Components | ~2050-2150 |

---

## Testing New Features

After adding a new feature:

1. **Test with existing data** - Ensure nothing breaks
2. **Test with new data** - Verify new feature works
3. **Test filters** - Ensure all filters work together
4. **Test exports** - Verify exports include new data
5. **Test saved projects** - Ensure projects save/load correctly

---

## Common Patterns

### Pattern: Adding Filter from CSV Column

1. Add to `COLUMN_PATTERNS`
2. Extract in `processCSVData()`
3. Add to `filters` state
4. Add filter logic in `getFilteredCourses()`
5. Add UI dropdown
6. Update `clearAllFilters()`

### Pattern: Adding Area Metadata

1. Detect column pattern in CSV processing
2. Extract values
3. Add to pathway.areas structure
4. Use `getAreaMetadata()` in components
5. Display conditionally (only if data exists)

---

## Need Help?

Refer to:
- `SCALABILITY_IMPLEMENTATION.md` - Full implementation details
- `IMPACT_ANALYSIS.md` - Impact assessment
- `SCALABILITY_ANALYSIS.md` - Original analysis
- Function JSDoc comments in code

