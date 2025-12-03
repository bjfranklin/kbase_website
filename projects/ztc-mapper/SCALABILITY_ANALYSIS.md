# Scalability Analysis & Recommendations

## Current Scalability Assessment

### ✅ **Implemented Strengths**

1. **Unified Filter System**: Internal `filters` object with helper functions (`updateFilter`, `hasActiveFilters`, `clearAllFilters`)
2. **Centralized Constants**: Configuration values (thresholds, patterns, themes) in one place
3. **Flexible Data Structure**: Course objects can easily accept new properties
4. **Component-Based UI**: React components make it easy to add new UI elements
5. **Extensible Column Mapping**: Auto-detection patterns can be extended
6. **Compatibility Helpers**: `getAreaName()` and `getAreaMetadata()` support both simple and enhanced pathway structures
7. **Enhanced Pathway Structure**: Supports area requirements and metadata when present in CSV
8. **Background Scroll Lock**: Centralized modal UX improvement

### ✅ **What Was Implemented**

| Recommendation | Status | Notes |
|----------------|--------|-------|
| Unified Filter System | ✅ Implemented | Internal `filters` object with sync to individual states |
| Compatibility Helpers | ✅ Implemented | `getAreaName()`, `getAreaMetadata()` functions |
| Enhanced Pathway Structure | ✅ Implemented | Automatic detection of "Area Required" columns |
| Requirements Display | ✅ Implemented | Shows in AreaColumn when data exists |
| Filter Helper Functions | ✅ Implemented | `updateFilter()`, `hasActiveFilters()`, `clearAllFilters()` |
| Animation Performance | ✅ Fixed | Removed GPU-forcing that caused flickering |
| Scroll Lock | ✅ Implemented | Background frozen when modals are open |

### ⚠️ **Future Enhancements (Optional)**

1. **Dynamic Filter UI Generation**: Could create `FILTER_CONFIG` constant for fully dynamic filter rendering
2. **FilterBar Component**: Could extract filter UI into separate component
3. **Additional Filters**: Ready to add (pathway progression, student level, etc.)

## Current Implementation Details

### Unified Filter System (Implemented)

```javascript
// Unified filter state (internal)
const [filters, setFilters] = useState({
  search: '',
  term: 'all',
  ztcStatus: 'all'
});

// Helper functions
const updateFilter = (filterName, value) => {
  setFilters(prev => ({ ...prev, [filterName]: value }));
};

const hasActiveFilters = () => {
  return filters.search !== '' || 
         filters.term !== 'all' || 
         filters.ztcStatus !== 'all';
};

const clearAllFilters = () => {
  setSearchQuery('');
  setTermFilter('all');
  setZtcFilter('all');
};

// Filter application in getFilteredCourses()
const getFilteredCourses = (area) => {
  let filtered = getCoursesForArea(selectedPathway, area);

  if (filters.search) {
    const query = filters.search.toLowerCase();
    filtered = filtered.filter(course => 
      course.code.toLowerCase().includes(query) ||
      course.title.toLowerCase().includes(query)
    );
  }

  if (filters.term !== 'all') {
    filtered = filtered.filter(course => course.term === filters.term);
  }

  if (filters.ztcStatus !== 'all') {
    filtered = filtered.filter(course => course.ztcStatus === filters.ztcStatus);
  }

  return filtered;
};
```

### Compatibility Helpers (Implemented)

```javascript
/**
 * Gets area name - handles both string and object formats
 */
const getAreaName = (area) => {
  if (typeof area === 'string') return area;
  if (area && typeof area === 'object' && area.name) return area.name;
  return '';
};

/**
 * Gets area metadata - returns null for string format, metadata for object format
 */
const getAreaMetadata = (area) => {
  if (typeof area === 'string') return null;
  if (area && typeof area === 'object') {
    const { name, ...metadata } = area;
    return Object.keys(metadata).length > 0 ? metadata : null;
  }
  return null;
};
```

### Enhanced Pathway Structure (Implemented)

The system automatically detects area requirements if CSV has columns like:
- "Area A Required"
- "List B Required"
- "GETC-1A Required"

When detected:
```javascript
pathway = {
  name: "Pathway Name",
  areas: [
    {
      name: "Area A",
      coursesRequired: 2  // From CSV
    },
    // ...
  ]
}
```

When not detected (backward compatible):
```javascript
pathway = {
  name: "Pathway Name",
  areas: ["Area A", "Area B", ...]  // Simple strings
}
```

### Scroll Lock (Implemented)

```javascript
/**
 * Prevents background scrolling when any modal is open
 */
useEffect(() => {
  const isAnyModalOpen = showMapping || showProjectManager || showExportModal || selectedCourse;
  if (isAnyModalOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
  return () => {
    document.body.style.overflow = '';
  };
}, [showMapping, showProjectManager, showExportModal, selectedCourse]);
```

## How to Add New Filters (Current Process)

Adding a new filter now requires these steps:

### Step 1: Add to Filter State
```javascript
const [filters, setFilters] = useState({
  search: '',
  term: 'all',
  ztcStatus: 'all',
  pathwayProgression: 'all'  // NEW
});
```

### Step 2: Add Column Pattern (if from CSV)
```javascript
const COLUMN_PATTERNS = {
  // ... existing patterns
  pathwayProgression: ['progression', 'pathway progression', 'level']
};
```

### Step 3: Extract in CSV Processing
```javascript
course.pathwayProgression = row[headers.indexOf(columnMapping.pathwayProgression)] || '';
```

### Step 4: Add Filter Logic
```javascript
if (filters.pathwayProgression !== 'all') {
  filtered = filtered.filter(course => 
    course.pathwayProgression === filters.pathwayProgression
  );
}
```

### Step 5: Add UI Element
```javascript
<select
  value={filters.pathwayProgression}
  onChange={(e) => updateFilter('pathwayProgression', e.target.value)}
  aria-label="Filter by pathway progression"
>
  <option value="all">All Progressions</option>
  {availableProgressions.map(prog => (
    <option key={prog} value={prog}>{prog}</option>
  ))}
</select>
```

### Step 6: Update Helper Functions
```javascript
const hasActiveFilters = () => {
  return filters.search !== '' || 
         filters.term !== 'all' || 
         filters.ztcStatus !== 'all' ||
         filters.pathwayProgression !== 'all';  // NEW
};

const clearAllFilters = () => {
  // ... existing clears
  updateFilter('pathwayProgression', 'all');  // NEW
};
```

**Time estimate**: ~30 minutes per new filter

## Optional Future Enhancement: Filter Configuration System

If you need to add many filters frequently, consider implementing a dynamic filter configuration system:

```javascript
const FILTER_CONFIG = [
  {
    id: 'search',
    type: 'text',
    label: 'Search courses...',
    placeholder: 'Search courses...',
    icon: Icons.Search
  },
  {
    id: 'term',
    type: 'select',
    label: 'Term',
    options: () => availableTerms,
    getValue: (course) => course.term
  },
  {
    id: 'ztcStatus',
    type: 'select',
    label: 'ZTC Status',
    options: [
      { value: 'all', label: 'All Status' },
      { value: 'ztc', label: 'ZTC Only' },
      { value: 'partial', label: 'Partial Only' },
      { value: 'not-ztc', label: 'Not ZTC Only' }
    ],
    getValue: (course) => course.ztcStatus
  }
];
```

This would allow adding new filters with just a config entry, but requires more upfront development.

## Scalability Score

### Current Scalability: **8/10** (Improved from 6/10)
- ✅ Unified filter system implemented
- ✅ Compatibility helpers for pathway structure
- ✅ Automatic requirements detection
- ✅ Easy to add new course properties
- ✅ Easy to add new UI components
- ✅ Background scroll lock for modals
- ⚠️ Filter UI still manually created (but helper functions exist)

### If Dynamic Filter Config Implemented: **9/10**
- ✅ Trivial to add new filters (just config)
- ✅ Dynamic UI generation
- ✅ Everything else from 8/10

## Performance Considerations

### Animation Performance (Important)
⚠️ **Do NOT add GPU-forcing CSS to course cards:**
```css
/* AVOID on course cards: */
.course-card-container {
  transform: translateZ(0);  /* Creates too many GPU layers */
  will-change: transform;    /* Causes flickering with many cards */
}
```

The current implementation uses simple `scale()` and `opacity` animations on modals only. This performs well regardless of the number of course cards displayed.

### Recommended Animation Approach
- Apply GPU hints only to modal overlays (single elements)
- Keep individual card styling simple
- Use CSS classes rather than inline animation styles

## Recommendations Summary

### Already Implemented ✅
1. Unified filter system with helper functions
2. Compatibility helpers for pathway structure
3. Enhanced pathway structure with auto-detection
4. Requirements display in AreaColumn
5. Animation performance optimization
6. Background scroll lock for modals

### Future Enhancements (Optional)
1. Dynamic filter UI generation with `FILTER_CONFIG`
2. FilterBar component extraction
3. Additional metadata fields in pathway structure
4. `prefers-reduced-motion` support for accessibility

## Conclusion

The application has been significantly improved from a scalability standpoint. The unified filter system, compatibility helpers, and enhanced pathway structure make it straightforward to add new features while maintaining full backward compatibility with existing data.
