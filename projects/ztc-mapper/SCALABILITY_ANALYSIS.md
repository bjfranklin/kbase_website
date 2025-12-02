# Scalability Analysis & Recommendations

## Current Scalability Assessment

### ✅ **Strengths (What Makes It Scalable)**

1. **Modular Filter Logic**: The `getFilteredCourses()` function uses a chainable filter pattern
2. **Centralized Constants**: Configuration values are in one place
3. **Flexible Data Structure**: Course objects can easily accept new properties
4. **Component-Based UI**: React components make it easy to add new UI elements
5. **Extensible Column Mapping**: Auto-detection patterns can be extended

### ⚠️ **Current Limitations (What Needs Improvement)**

1. **Hardcoded Filter State**: Each filter requires individual state variables
2. **Manual Filter Updates**: Must update multiple places when adding filters
3. **No Generic Filter System**: No unified way to add new filters
4. **Pathway Structure Fixed**: Pathway objects only store `name` and `areas`
5. **Area Display Static**: AreaColumn doesn't support dynamic metadata

## Recommended Improvements for Scalability

### 1. **Unified Filter System**

**Current Approach (Not Scalable):**
```javascript
const [termFilter, setTermFilter] = useState('all');
const [ztcFilter, setZtcFilter] = useState('all');
// Adding new filter requires new state variable
```

**Recommended Approach (Scalable):**
```javascript
// Single filter state object
const [filters, setFilters] = useState({
  search: '',
  term: 'all',
  ztcStatus: 'all',
  pathwayProgression: 'all',  // NEW - easy to add
  studentLevel: 'all',         // NEW - easy to add
  // ... more filters
});

// Generic filter update function
const updateFilter = (filterName, value) => {
  setFilters(prev => ({ ...prev, [filterName]: value }));
};

// Generic filter application
const applyFilters = (courses) => {
  return courses.filter(course => {
    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      if (!course.code.toLowerCase().includes(query) && 
          !course.title.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Term filter
    if (filters.term !== 'all' && course.term !== filters.term) {
      return false;
    }
    
    // ZTC filter
    if (filters.ztcStatus !== 'all' && course.ztcStatus !== filters.ztcStatus) {
      return false;
    }
    
    // NEW: Pathway progression filter (example)
    if (filters.pathwayProgression !== 'all' && 
        course.pathwayProgression !== filters.pathwayProgression) {
      return false;
    }
    
    return true;
  });
};
```

### 2. **Extensible Pathway Structure**

**Current Structure:**
```javascript
pathway = {
  name: "Pathway Name",
  areas: ["Area A", "Area B", ...]
}
```

**Recommended Structure:**
```javascript
pathway = {
  name: "Pathway Name",
  areas: [
    {
      name: "Area A",
      coursesRequired: 2,        // NEW - from datasource
      minCourses: 1,             // NEW - optional minimum
      maxCourses: 3,             // NEW - optional maximum
      description: "...",         // NEW - optional description
      progressionLevel: "1"      // NEW - for filtering
    },
    // ...
  ],
  metadata: {                    // NEW - extensible metadata
    totalCoursesRequired: 10,
    studentLevel: "transfer",
    // ... more metadata
  }
}
```

### 3. **Filter Configuration System**

**Recommended Approach:**
```javascript
// Filter configuration - defines all available filters
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
    options: () => availableTerms,  // Dynamic options
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
  },
  // NEW: Pathway Progression Filter
  {
    id: 'pathwayProgression',
    type: 'select',
    label: 'Pathway Progression',
    options: () => getAvailableProgressionLevels(),  // From datasource
    getValue: (course) => course.pathwayProgression,
    sourceColumn: 'Pathway Progression'  // CSV column name
  },
  // NEW: Student Level Filter
  {
    id: 'studentLevel',
    type: 'select',
    label: 'Student Level',
    options: () => getAvailableStudentLevels(),  // From datasource
    getValue: (course) => course.studentLevel,
    sourceColumn: 'Student Level'  // CSV column name
  }
];
```

### 4. **Dynamic Filter UI Generation**

**Recommended Component:**
```javascript
/**
 * FilterBar Component - Dynamically generates filters from FILTER_CONFIG
 */
const FilterBar = () => {
  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {FILTER_CONFIG.map(filter => {
        if (filter.type === 'text') {
          return (
            <div key={filter.id} className="flex-1 relative">
              {filter.icon && <filter.icon className="..." />}
              <input
                type="text"
                placeholder={filter.placeholder}
                value={filters[filter.id] || ''}
                onChange={(e) => updateFilter(filter.id, e.target.value)}
                aria-label={filter.label}
                className="..."
              />
            </div>
          );
        }
        
        if (filter.type === 'select') {
          const options = typeof filter.options === 'function' 
            ? filter.options() 
            : filter.options;
          
          return (
            <select
              key={filter.id}
              value={filters[filter.id] || 'all'}
              onChange={(e) => updateFilter(filter.id, e.target.value)}
              aria-label={filter.label}
              className="..."
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        }
        
        return null;
      })}
      
      {/* Clear filters button */}
      {hasActiveFilters() && (
        <button onClick={clearAllFilters}>Clear</button>
      )}
    </div>
  );
};
```

### 5. **Enhanced Area Column with Requirements**

**Recommended Component Update:**
```javascript
const AreaColumn = ({ area, areaMetadata }) => {
  const filteredCourses = getFilteredCourses(area.name);
  const stats = calculateFilteredAreaStats(area.name);
  
  // NEW: Get requirements from area metadata
  const coursesRequired = areaMetadata?.coursesRequired || 0;
  const coursesRemaining = Math.max(0, coursesRequired - filteredCourses.length);
  
  return (
    <div className="...">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="...">{area.name}</h3>
          {stats.ztcPercentage >= ZTC_THRESHOLDS.ZTC_MIN && 
            <Icons.CheckCircle className="..." />}
        </div>
        
        {/* NEW: Requirements Display */}
        {coursesRequired > 0 && (
          <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
            <div className="font-semibold">Requirements:</div>
            <div>
              {filteredCourses.length} of {coursesRequired} courses
              {coursesRemaining > 0 && (
                <span className="text-amber-400">
                  {' '}({coursesRemaining} remaining)
                </span>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${statusColor}`}>
            {stats.ztcPercentage}% ZTC
          </span>
          <span className={theme.emptyText}>
            ({stats.ztcCount}/{stats.totalCourses})
          </span>
        </div>
      </div>
      
      {/* Course list */}
      <div className="...">
        {filteredCourses.map(course => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
};
```

### 6. **Enhanced CSV Processing for New Fields**

**Recommended Update to processCSVData():**
```javascript
const processCSVData = () => {
  // ... existing code ...
  
  // NEW: Extract pathway progression and student level from CSV
  const progressionColumn = columnMapping.pathwayProgression || 
    headers.find(h => h.toLowerCase().includes('progression'));
  const studentLevelColumn = columnMapping.studentLevel || 
    headers.find(h => h.toLowerCase().includes('student level'));
  
  // NEW: Extract area requirements from CSV
  // Assumes CSV has columns like "Area A Required", "List B Required", etc.
  const areaRequirements = {};
  headers.forEach(header => {
    const match = header.match(/(.+?)\s+Required/i);
    if (match) {
      const areaName = match[1].trim();
      // Store requirement for this area
      areaRequirements[areaName] = header;
    }
  });
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const course = {
      // ... existing fields ...
      
      // NEW: Extract pathway progression
      pathwayProgression: progressionColumn 
        ? row[headers.indexOf(progressionColumn)] || ''
        : '',
      
      // NEW: Extract student level
      studentLevel: studentLevelColumn
        ? row[headers.indexOf(studentLevelColumn)] || ''
        : '',
    };
    
    // ... rest of processing ...
  }
  
  // NEW: Build enhanced pathway structure with requirements
  Object.values(pathwayGroups).forEach(pathway => {
    pathway.areas = pathway.areas.map(areaName => {
      const requirementColumn = areaRequirements[areaName];
      const requirementValue = requirementColumn && data.length > 0
        ? data[0][headers.indexOf(requirementColumn)]
        : null;
      
      return {
        name: areaName,
        coursesRequired: requirementValue ? parseInt(requirementValue, 10) : 0,
        // Can add more metadata here
      };
    });
  });
  
  // ... rest of code ...
};
```

## Implementation Roadmap

### Phase 1: Refactor Filter System (High Priority)
**Effort**: 2-3 hours
**Impact**: Makes adding new filters trivial

1. Convert filter state to unified object
2. Create `updateFilter()` helper function
3. Refactor `getFilteredCourses()` to use filter object
4. Update filter UI to use new system

### Phase 2: Add Filter Configuration (Medium Priority)
**Effort**: 3-4 hours
**Impact**: Enables dynamic filter UI generation

1. Create `FILTER_CONFIG` constant
2. Create `FilterBar` component
3. Replace hardcoded filter UI with dynamic generation
4. Add auto-detection for new filter columns

### Phase 3: Enhance Pathway Structure (High Priority)
**Effort**: 2-3 hours
**Impact**: Enables requirements display

1. Update pathway structure to include area metadata
2. Extract requirements from CSV during processing
3. Update `AreaColumn` to display requirements
4. Add requirements to area summary cards

### Phase 4: Add New Filters (Low Effort After Phase 1-2)
**Effort**: 30 minutes per filter
**Impact**: Adds new filtering capabilities

1. Add filter config to `FILTER_CONFIG`
2. Add column mapping in auto-detection
3. Extract field in `processCSVData()`
4. Filter automatically works!

## Example: Adding Pathway Progression Filter

### Before (Current - Not Scalable):
```javascript
// 1. Add state variable
const [progressionFilter, setProgressionFilter] = useState('all');

// 2. Update getFilteredCourses
if (progressionFilter !== 'all') {
  filtered = filtered.filter(c => c.progression === progressionFilter);
}

// 3. Add UI element
<select value={progressionFilter} onChange={...}>
  ...
</select>

// 4. Update clear filters
if (progressionFilter !== 'all') { ... }

// 5. Update hasActiveFilters
const hasActiveFilters = ... || progressionFilter !== 'all';
```

### After (Recommended - Scalable):
```javascript
// 1. Add to FILTER_CONFIG
{
  id: 'pathwayProgression',
  type: 'select',
  label: 'Pathway Progression',
  options: () => getAvailableProgressionLevels(),
  getValue: (course) => course.pathwayProgression,
  sourceColumn: 'Pathway Progression'
}

// 2. Add to column mapping auto-detection
pathwayProgression: findColumn(['progression', 'pathway progression'])

// 3. Extract in processCSVData
course.pathwayProgression = row[headers.indexOf(columnMapping.pathwayProgression)] || '';

// Done! Filter UI and logic automatically work
```

## Scalability Score

### Current Scalability: **6/10**
- ✅ Easy to add new course properties
- ✅ Easy to add new UI components
- ⚠️ Moderate effort to add new filters (requires multiple updates)
- ⚠️ Moderate effort to add area requirements (requires structure changes)

### After Recommended Improvements: **9/10**
- ✅ Trivial to add new filters (just config)
- ✅ Trivial to add new course properties
- ✅ Easy to add area requirements
- ✅ Easy to extend pathway metadata
- ✅ Dynamic UI generation

## Recommendations Summary

1. **Implement unified filter system** - Makes adding filters 10x easier
2. **Create filter configuration** - Enables dynamic UI generation
3. **Enhance pathway structure** - Supports requirements and metadata
4. **Update CSV processing** - Extract new fields automatically
5. **Enhance AreaColumn** - Display requirements and metadata

These changes will make your application highly scalable for future requirements while maintaining backward compatibility.

