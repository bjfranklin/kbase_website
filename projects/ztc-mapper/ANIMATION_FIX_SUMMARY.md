# ZTC Pathway Mapper - Animation Flickering Fix Summary

## Problem Description
After the Cursor optimization work, the application experienced animation glitches/flickering when clicking on course cards. This occurred:
- After CSV import, before filters were applied
- When many course cards were visible
- The issue resolved once filters reduced the card count

## Root Cause Analysis

### Primary Issue: GPU Layer Overload
The Cursor optimizations added CSS properties that force GPU layer creation on many elements. While GPU acceleration is beneficial for isolated elements, applying it to **every course card** creates too many compositor layers, overwhelming the browser.

### Specific Problems Identified:

1. **`.course-card-container` class** (removed)
   - Applied `transform: translateZ(0)` and `will-change: transform` to every course card
   - With 50+ cards, this created 50+ GPU layers
   - Browser compositor struggled to handle all layers during modal animation

2. **Complex modal animation with deferred backdrop blur** (removed)
   - `animationComplete` state caused extra re-render mid-animation
   - Double `requestAnimationFrame` pattern added complexity
   - Dynamically changing `backdropFilter` via inline styles triggered repaints
   - Multiple `useEffect` hooks with timers created race conditions

3. **Excessive CSS animation properties** (simplified)
   - `will-change` on animation classes
   - `isolation: isolate` creating extra stacking contexts
   - Complex `perspective`, `backface-visibility`, `translate3d` transforms
   - `.modal-overlay` and `.modal-content` classes with GPU hints

4. **Area column scroll container GPU hints** (removed)
   - `transform: translateZ(0)` and `willChange: 'scroll-position'` added more layers

## Changes Made

### CSS (Lines 47-74)
**Before (Problematic):**
```css
@keyframes scaleIn {
  from { transform: translate3d(0, 0, 0) scale3d(0.98, 0.98, 1); opacity: 0; }
  to { transform: translate3d(0, 0, 0) scale3d(1, 1, 1); opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
  will-change: opacity;
  transform: translateZ(0);
}
.animate-scaleIn {
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}
/* Plus .modal-overlay, .modal-content, .course-card-container classes */
```

**After (Fixed):**
```css
@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
.animate-scaleIn {
  animation: scaleIn 0.2s ease-out;
}
```

### CourseCard Component
**Before:** `className={...} course-card-container`
**After:** `className={...}` (no GPU-forcing class)

### CourseDetailModal Component
**Before (Problematic):**
```javascript
const CourseDetailModal = ({ course, onClose }) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  
  useEffect(() => {
    // Double RAF pattern for deferred backdrop blur
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationComplete(true);
        });
      });
    }, 220);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Body scroll prevention with timer
    const timer = setTimeout(() => {
      document.body.classList.add('modal-open');
    }, 10);
    return () => { ... };
  }, []);
  
  return (
    <div 
      className={`... modal-overlay ${animationComplete ? 'animation-complete' : ''}`}
      style={{ 
        backdropFilter: animationComplete ? 'blur(4px)' : 'none',
        ...
      }}
    >
      <div className={`... modal-content`}>
        ...
      </div>
    </div>
  );
};
```

**After (Fixed):**
```javascript
const CourseDetailModal = ({ course, onClose }) => {
  if (!course) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      ...
    >
      <div 
        ref={(el) => { if (el) setupFocusTrap(el); }}
        className={`${theme.modal} ... animate-scaleIn`}
      >
        ...
      </div>
    </div>
  );
};
```

### AreaColumn Scroll Container
**Before:** `style={{ ..., transform: 'translateZ(0)', willChange: 'scroll-position' }}`
**After:** `style={{ margin: '1px', borderRadius: '0.75rem', paddingRight: '8px' }}`

### Other Modals (Export, Project Manager, Column Mapping)
- Removed `modal-overlay` class from overlay divs
- Removed `modal-content` class from inner divs
- Simplified focus trap ref callbacks (removed setTimeout delays)

## What Was Preserved

All of the following improvements from the Cursor work remain intact:
- ✅ Full ADA/WCAG 2.1 Level AA compliance
- ✅ Refactored code layout with section headers
- ✅ JSDoc documentation on functions
- ✅ Constants extraction for maintainability
- ✅ Unified filter system for scalability
- ✅ Enhanced pathway structure with compatibility helpers
- ✅ Area requirements display (when data present)
- ✅ All accessibility features (ARIA, keyboard navigation, focus trap)

## Why This Fix Works

1. **Fewer GPU Layers**: By not forcing every course card into its own GPU layer, the browser's compositor can handle the workload efficiently

2. **Simpler Animation**: The original `scale(0.9)` → `scale(1)` animation is lightweight and doesn't require complex 3D transforms

3. **Immediate Backdrop Blur**: Using `backdrop-blur-sm` class from the start (instead of deferring via state) eliminates the mid-animation re-render

4. **No State-Based Animation**: Removing the `animationComplete` state eliminates the extra render cycle that was causing visual glitches

## Testing Recommendations

1. Load CSV with many courses (50+)
2. Before applying any filters, click on course cards
3. Verify smooth modal animation with no flickering
4. **Verify background scroll is locked when modal is open**
5. Test with both dark and light themes
6. Verify all accessibility features still work:
   - ESC key closes modals
   - Tab navigation works
   - Screen reader announcements function

---

## Additional Enhancement: Background Scroll Lock

A centralized scroll lock was added to prevent the background from scrolling while any modal is open. This improves the user experience by keeping focus on the modal content.

### Implementation (Lines 558-577)
```javascript
// ========================================
// SCROLL LOCK FOR MODALS
// ========================================

/**
 * Prevents background scrolling when any modal is open
 * Centralized handler for all modals to avoid conflicts
 */
useEffect(() => {
  const isAnyModalOpen = showMapping || showProjectManager || showExportModal || selectedCourse;
  if (isAnyModalOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
  // Cleanup on unmount
  return () => {
    document.body.style.overflow = '';
  };
}, [showMapping, showProjectManager, showExportModal, selectedCourse]);
```

### Why Centralized?
- Single effect handles all four modals (Course Detail, Export, Project Manager, Column Mapping)
- Avoids potential race conditions from multiple effects
- Clean cleanup when component unmounts
- Follows React best practices for side effects

---

## Note: Tailwind CSS CDN Warning

You may see this console warning:
> "cdn.tailwindcss.com should not be used in production..."

**This warning can be safely ignored** for your use case because:

1. **Single-file application**: You don't have a build pipeline to run PostCSS
2. **One-time load**: The app loads once and stays open, so initial load time is minimal  
3. **Self-contained**: Keeps everything in one portable HTML file
4. **Internal tool**: Not a high-traffic public website where bundle size matters

The warning is meant for production websites where you'd want optimized, tree-shaken CSS. For an internal dashboard tool like the ZTC Pathway Mapper, the CDN approach is actually ideal.
