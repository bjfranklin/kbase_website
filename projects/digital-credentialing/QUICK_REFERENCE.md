# Quick Reference: Modifying the ACES Dashboard

## Adding a New ACES Skill

### Time Required: ~15 minutes

### Steps:

1. **Add to ACES_SKILLS configuration** (Section 3, ~Line 520):
```javascript
const ACES_SKILLS = {
  // ... existing skills
  'New Skill Name': {
    color: '#hexcolor',      // Unique hex color for charts
    iconName: 'IconName',    // Must match an icon in Icons object
    tokens: [
      'Token Name 1',
      'Token Name 2', 
      'Token Name 3',
      'Token Name 4'
    ]
  }
};
```

2. **Add icon if needed** (Section 2, ~Line 200):
```javascript
const Icons = {
  // ... existing icons
  NewIcon: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
         viewBox="0 0 24 24" fill="none" stroke="currentColor" 
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
         aria-hidden="true" {...props}>
      {/* SVG paths here */}
    </svg>
  ),
};
```

**Done!** The skill will automatically appear in all charts and statistics when CSV data contains it.

---

## Changing Chart Colors

### Donut Chart Opacity
Located in `donutChartData` useMemo (~Line 1560):

```javascript
// Current: 70% background, 90% border, 85% hover
backgroundColor: sortedSkills.map(([skill]) => 
  hexToRgba(ACES_SKILLS[skill]?.color || '#6b7280', 0.7)  // Change 0.7
),
borderColor: sortedSkills.map(([skill]) => 
  hexToRgba(ACES_SKILLS[skill]?.color || '#6b7280', 0.9)  // Change 0.9
),
hoverBackgroundColor: sortedSkills.map(([skill]) => 
  hexToRgba(ACES_SKILLS[skill]?.color || '#6b7280', 0.85) // Change 0.85
)
```

### Bar Chart Colors
Located in `skillChartData` useMemo (~Line 1700):
```javascript
backgroundColor: sortedSkills.map(([skill]) => 
  (ACES_SKILLS[skill]?.color || '#6b7280') + '80'  // 80 = 50% opacity in hex
),
```

### Individual Skill Colors
Update in `ACES_SKILLS` constant (~Line 520):
```javascript
'Communication': {
  color: '#22c55e',  // Change this hex value
  iconName: 'MessageSquare',
  tokens: [...]
}
```

---

## Adding a New Tab

### Time Required: ~30 minutes

### Steps:

1. **Add tab definition** (~Line 1910):
```javascript
{[
  { id: 'overview', label: 'Overview', icon: Icons.BarChart },
  { id: 'pathways', label: 'Pathways', icon: Icons.GitBranch },
  { id: 'badges', label: 'Badges', icon: Icons.Award },
  { id: 'newtab', label: 'New Tab', icon: Icons.NewIcon }  // ADD THIS
].map(tab => (
```

2. **Add tab content** (after Badges Tab, ~Line 2070):
```javascript
{/* New Tab */}
{activeTab === 'newtab' && (
  <div className={`${themeColors.card} border ${themeColors.cardBorder} rounded-xl p-6`}
       role="region" 
       aria-label="New tab content">
    <h3 className={`font-semibold ${themeColors.text} mb-4`}>New Tab Content</h3>
    {/* Your content here */}
  </div>
)}
```

---

## Adding a New Export Format

### Time Required: ~20 minutes

### Steps:

1. **Create export function** (inside ExportModal, ~Line 1280):
```javascript
const exportToJSON = () => {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aces-credentials-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  onClose();
};
```

2. **Add button in export grid** (~Line 1350):
```javascript
<button
  onClick={exportToJSON}
  className={`flex flex-col items-center gap-3 p-6 ${themeColors.card} border ${themeColors.cardBorder} rounded-lg ${themeColors.cardHover} transition-all`}
  aria-label="Export data as JSON file"
>
  <Icons.FileText className="w-8 h-8 text-yellow-400" aria-hidden="true" />
  <div className="text-center">
    <div className={`font-semibold text-sm ${themeColors.text}`}>JSON</div>
    <div className={`text-xs ${themeColors.textMuted}`}>Raw Data</div>
  </div>
</button>
```

---

## Modifying Theme Colors

### Location: THEME_CONFIG (~Line 625)

```javascript
const THEME_CONFIG = {
  dark: {
    bg: 'bg-slate-950',            // Main background
    card: 'bg-slate-900/50',        // Card background
    cardBorder: 'border-slate-800', // Card border
    cardHover: 'hover:bg-slate-800/50', // Card hover state
    text: 'text-white',             // Primary text
    textMuted: 'text-slate-400',    // Secondary text
    input: 'bg-slate-800',          // Input background
    inputBorder: 'border-slate-700', // Input border
    // ... more properties
  },
  light: {
    bg: 'bg-gray-50',
    card: 'bg-white',
    cardBorder: 'border-gray-200',
    // ... more properties
  }
};
```

---

## Code Locations Quick Reference

| Feature | Section | Approx. Lines |
|---------|---------|---------------|
| Accessibility CSS | Head | 27-86 |
| Skip Link | Head | 188-189 |
| Icons | Section 2 | 224-510 |
| ACES Skills Config | Section 3 | 512-620 |
| Theme Config | Section 4 | 622-680 |
| hexToRgba Helper | Section 5 | 685-700 |
| parseCSV Function | Section 5 | 705-750 |
| processData Function | Section 5 | 755-820 |
| extractSkillInfo | Section 5 | 825-850 |
| ChartComponent | Section 5B | 855-920 |
| ProgressRing | Section 5B | 925-980 |
| BadgeImage | Section 5B | 985-1030 |
| StatCard | Section 5B | 1000-1030 |
| SkillPathwayCard | Section 5C | 1035-1120 |
| BadgeGallery | Section 6 | 1125-1215 |
| ExportModal | Section 7 | 1220-1420 |
| DonutChart | Section 8 | 1425-1500 |
| YearComparison | Section 9 | 1505-1600 |
| Main App State | Section 10 | 1605-1660 |
| Statistics useMemos | Section 10 | 1665-1780 |
| Tab Navigation | Section 10 | 1910-1960 |
| Overview Tab | Section 10 | 1980-2020 |
| Pathways Tab | Section 10 | 2025-2050 |
| Badges Tab | Section 10 | 2055-2070 |

---

## Common Patterns

### Pattern: Adding Accessibility to New Elements

```javascript
// Button with accessibility
<button
  onClick={handleClick}
  className="..."
  aria-label="Descriptive action label"
>
  <Icons.SomeIcon className="w-5 h-5" aria-hidden="true" />
  Visible Label
</button>

// Region with label
<div 
  role="region" 
  aria-label="Section description"
>
  {/* content */}
</div>

// Progress indicator
<div
  role="progressbar"
  aria-valuenow={50}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Loading progress: 50%"
>
```

### Pattern: Modal with Scroll Lock

```javascript
const [isOpen, setIsOpen] = useState(false);
const closeButtonRef = useRef(null);

useEffect(() => {
  if (isOpen) {
    // Lock background scroll
    document.body.classList.add('modal-open');
    
    // Focus first element
    setTimeout(() => closeButtonRef.current?.focus(), 100);
    
    // Handle ESC key
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleEscape);
    };
  }
}, [isOpen]);
```

### Pattern: Theme-Aware Component

```javascript
const MyComponent = ({ theme }) => {
  const themeColors = THEME_CONFIG[theme];
  
  return (
    <div className={`${themeColors.card} border ${themeColors.cardBorder} rounded-xl p-6`}>
      <h3 className={themeColors.text}>Title</h3>
      <p className={themeColors.textMuted}>Description</p>
    </div>
  );
};
```

### Pattern: Chart with Theme Support

```javascript
const chartOptions = useMemo(() => ({
  plugins: {
    legend: {
      labels: {
        color: theme === 'dark' ? '#e2e8f0' : '#374151'
      }
    }
  },
  scales: {
    x: {
      ticks: { color: theme === 'dark' ? '#94a3b8' : '#6b7280' },
      grid: { color: theme === 'dark' ? '#334155' : '#e5e7eb' }
    }
  }
}), [theme]);
```

---

## Testing After Modifications

1. **Visual**: Both dark and light themes
2. **Data**: Upload CSV and verify display
3. **Charts**: All chart types render correctly
4. **Export**: Test all export formats
5. **Accessibility**: 
   - Tab through all interactive elements
   - Test ESC key on modals
   - Verify focus indicators visible
6. **Console**: Check for errors

---

## CSV Data Format Expected

The dashboard expects CSV exports from Canvas Credentials/Badgr with these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Issue Date | When badge was awarded | 2022-03-15 |
| Badge Class Name | Name of the badge | Communication Token 1 |
| Badge Image URL | URL to badge image | https://... |

### Sample CSV Row:
```
2022-03-15,"Communication Token 1",https://badges.example.com/img/comm-t1.png
```

---

## Need Help?

Refer to:
- `README.md` - Full documentation
- `ACCESSIBILITY_VERIFICATION.md` - ADA compliance details
- `CODE_ORGANIZATION.md` - Detailed code structure
- `FEATURES_SUMMARY.md` - Feature overview
- JSDoc comments in code (look for `/** ... */`)
