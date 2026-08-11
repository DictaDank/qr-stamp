# QR-Stamp Architecture

This document describes the architecture, module structure, data flow, and testing strategy for QR-Stamp.

## Table of Contents

1. [Module Structure](#module-structure)
2. [Data Flow](#data-flow)
3. [State Shape](#state-shape)
4. [Testing Strategy](#testing-strategy)
5. [File Organization](#file-organization)
6. [Integration Patterns](#integration-patterns)

---

## Module Structure

QR-Stamp is built with 8 core modules, each with a single responsibility.

### 1. AppState (state.js)

**Responsibility:** Immutable state management using a reducer pattern

**Key Classes:**
- `AppState` - Main state container with subscription system
- `createAction()` - Factory function for creating actions

**Key Methods:**
- `getCurrentState()` - Returns deep clone of current state
- `dispatch(action)` - Processes action and updates state
- `subscribe(callback)` - Registers subscriber for state changes
- `selectStamps()` - Selector for getting all stamps
- `selectDarkMode()` - Selector for dark mode preference
- `selectZoom()` - Selector for zoom state

**State Handled:**
- PDF document metadata and bytes
- Stamp array
- Current page
- Current stamp selection
- UI state (dark mode, preview mode)
- Zoom/pan state

**Principles:**
- All state updates are immutable
- Reducers return new state objects
- Deep cloning ensures no reference leaks
- Subscribers are called on every state change

---

### 2. StampLayer (stamps.js)

**Responsibility:** Multi-stamp CRUD operations with page range filtering

**Key Classes:**
- `StampLayer` - Manages stamp lifecycle and operations

**Key Methods:**
- `createStamp(options)` - Create new stamp and dispatch ADD_STAMP
- `updateStamp(stampId, updates)` - Modify stamp properties
- `deleteStamp(stampId)` - Remove stamp from state
- `getStampsByPage(pageNumber)` - Get stamps for specific page
- `getStampsForPageRange(range)` - Filter stamps by page range
- `selectStamp(stampId)` - Set current selected stamp

**Stamp Properties:**
- `id` - Unique identifier (stamp-timestamp-counter)
- `type` - 'image' or 'qr'
- `src` - Data URL or QR content
- `x`, `y` - Position ratios (0-1)
- `scale` - Size percentage
- `rotation` - Degrees (-180 to 180)
- `opacity` - Opacity percentage (0-100)
- `pages` - Page range string ('all', 'first', 'last', '1,3,5-8')
- `pageNumber` - Original placement page

**Page Range Format:**
- 'all' - Apply to all pages
- 'first' - Only first page
- 'last' - Only last page
- '1,3,5-8' - Specific pages and ranges

---

### 3. History (history.js)

**Responsibility:** Snapshot-based undo/redo with configurable depth

**Key Classes:**
- `History` - Manages undo/redo stacks

**Key Methods:**
- `recordSnapshot(state)` - Save state snapshot
- `undo()` - Restore previous state
- `redo()` - Restore next state
- `canUndo()` - Check if undo available
- `canRedo()` - Check if redo available
- `clear()` - Reset history

**Configuration:**
- `maxSnapshots` - Maximum history depth (default 50)
- Snapshots automatically trimmed when limit exceeded
- Memory efficient with circular buffer pattern

**How It Works:**
1. Each state change is captured as a snapshot
2. Snapshots stored in undo stack
3. When undo called, current state moved to redo stack
4. Redo restores from redo stack back to undo stack
5. New changes clear the redo stack

---

### 4. CanvasController (canvas.js)

**Responsibility:** PDF canvas zoom/pan interaction with mouse and touch support

**Key Classes:**
- `CanvasController` - Manages canvas interactions

**Key Methods:**
- `zoomIn()` - Increase zoom by 0.1 steps
- `zoomOut()` - Decrease zoom by 0.1 steps
- `setZoom(scale)` - Set specific zoom level
- `pan(deltaX, deltaY)` - Move canvas view
- `resetZoom()` - Reset to 1.0x zoom

**Zoom Constraints:**
- Minimum zoom: 0.5x
- Maximum zoom: 3.0x
- Wheel sensitivity: 0.1 per scroll event

**Interaction Support:**
- Mouse wheel scrolling for zoom
- Shift+drag for panning
- Middle-mouse drag for panning
- Touch pinch-to-zoom (future)
- Touch pan with two-finger drag (future)

**Event Handling:**
- Wheel events captured with preventDefault
- Mouse down/move/up for pan tracking
- Pointer events for cross-device support
- Touch events for mobile devices

---

### 5. TemplateManager (templates.js)

**Responsibility:** Built-in and custom stamp template management

**Key Classes:**
- `TemplateManager` - Manages template library

**Key Methods:**
- `getBuiltInTemplates()` - Get default templates
- `saveCustomTemplate(name, config)` - Create new template
- `loadCustomTemplate(name)` - Retrieve saved template
- `deleteCustomTemplate(name)` - Remove template
- `getAllTemplates()` - Get built-in + custom templates
- `getTemplate(name)` - Get template by name

**Built-in Templates:**
- **Aprobado (Approved)** - Green, bottom-right, -15° rotation
- **Rechazado (Rejected)** - Red, bottom-right, -15° rotation
- **Confidencial (Confidential)** - Blue, center, 0° rotation
- **Urgente (Urgent)** - Orange, top-left, -30° rotation

**Template Format:**
```javascript
{
  name: 'Template Name',
  x: 0.75,              // Position ratio (0-1)
  y: 0.15,              // Position ratio (0-1)
  scale: 100,           // Size percentage
  rotation: -15,        // Rotation degrees
  opacity: 90,          // Opacity percentage
  color: '#10b981'      // Color hex
}
```

**Storage:**
- localStorage key: `qr-stamp:templates`
- JSON serialization
- Auto-loads on initialization
- Survives page refresh

---

### 6. PersistenceManager (persistence.js)

**Responsibility:** Configuration export/import with JSON and localStorage

**Key Classes:**
- `PersistenceManager` - Manages config persistence

**Key Methods:**
- `exportConfiguration(name)` - Generate JSON string
- `importConfiguration(jsonString)` - Load from JSON
- `downloadConfiguration(jsonString, filename)` - Save to file
- `saveToLocalStorage(key, config)` - Quick-save to browser storage
- `loadFromLocalStorage(key)` - Load from browser storage

**Configuration Format:**
```json
{
  "version": "1.0",
  "name": "Configuration Name",
  "timestamp": "2024-08-11T10:30:00.000Z",
  "stamps": [
    {
      "type": "image|qr",
      "src": "data:image/png;base64,...",
      "x": 0.8,
      "y": 0.1,
      "scale": 100,
      "opacity": 90,
      "rotation": 0,
      "pages": "all"
    }
  ]
}
```

**Storage:**
- localStorage keys: `qr-stamp:config-*`
- Up to 10 recent configs stored
- Each config versioned with timestamp
- Full JSON export for sharing/backup

---

### 7. UIManager (ui.js)

**Responsibility:** Dark mode, keyboard shortcuts, and accessibility

**Key Classes:**
- `UIManager` - Manages UI/UX features

**Key Methods:**
- `toggleDarkMode()` - Switch dark/light theme
- `setupKeyboardShortcuts()` - Register keyboard listeners
- `addAccessibilityLabels()` - Enhance semantic HTML
- `createLiveRegion()` - ARIA live region for announcements
- `announce(message, priority)` - Screen reader announcement

**Keyboard Shortcuts:**
- Ctrl+Z / Cmd+Z - Undo
- Ctrl+Shift+Z / Cmd+Shift+Z - Redo
- Tab - Navigate
- Escape - Close modals

**Dark Mode:**
- System preference detection
- Stored in localStorage: `qr-stamp:isDarkMode`
- CSS class: `[data-theme="dark"]`
- Smooth transitions

**Accessibility Features:**
- ARIA labels on all interactive elements
- Live regions for status updates
- Focus indicators on keyboard navigation
- Semantic HTML structure
- Color contrast WCAG AA compliant
- Keyboard navigation for all features

---

### 8. BatchProcessor (batch.js)

**Responsibility:** PDF file queue management for batch processing

**Key Classes:**
- `BatchProcessor` - Manages processing queue

**Key Methods:**
- `addFiles(files)` - Add files to queue
- `getNext()` - Get next unprocessed file
- `markProcessed(filename)` - Mark file as done
- `getQueueSize()` - Queue length
- `getProcessedCount()` - Completed count
- `getStatus()` - Current queue status

**Queue Features:**
- Auto-filters to PDFs only
- Tracks processed files
- FIFO processing order
- Memory efficient
- Duplicate detection

---

### Bonus: TextStampGenerator (textStamp.js)

**Responsibility:** Generate text stamps as PNG images

**Key Classes:**
- `TextStampGenerator` - Creates text stamp images

**Key Methods:**
- `generateTextStamp(text, options)` - Create PNG stamp
- `generateDateStamp(date, format)` - Create dated stamp
- `generateCounterStamp(count, prefix)` - Create counter stamp

**Text Stamp Options:**
```javascript
{
  font: {
    family: 'Arial|Georgia|Courier New|Times New Roman',
    size: 8-72,              // Pixels
    weight: 'normal|bold',
    color: '#hexcolor'       // e.g., '#FF0000'
  },
  border: true|false,        // Draw border
  padding: 20,               // Padding pixels
  backgroundColor: '#ffffff'
}
```

**Output:**
- PNG image as data URL
- Ready to use as stamp source
- Full canvas rendering with text metrics

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         User Actions                        │
├─────────────────────────────────────────────────────────────┤
│ Upload PDF │ Add Stamp │ Move Stamp │ Undo │ Toggle Dark... │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────┐
          │   Event Dispatchers      │
          │  (UI Event Handlers)     │
          └────────┬─────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │     Action Creators              │
    │   createAction(type, payload)    │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │   AppState.dispatch(action)      │
    │  (Reducer processes action)      │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │   New State Generated            │
    │  (Deep clone, immutable)         │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │   History.recordSnapshot()       │
    │  (State saved to undo stack)     │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │   Subscribers Notified           │
    │  (All listeners called)          │
    └────────┬─────────────────────────┘
             │
    ┌────────┴────────┬────────┬────────────┐
    │                 │        │            │
    ▼                 ▼        ▼            ▼
┌──────────┐  ┌──────────┐ ┌────────┐ ┌──────────────┐
│  Canvas  │  │   UI     │ │History │ │Persistence  │
│Re-render │  │Update    │ │Track   │ │Save/Load    │
└──────────┘  └──────────┘ └────────┘ └──────────────┘
```

### Detailed Flow Example: Adding a Stamp

1. **User uploads image** → `stampImageInput.change` event fires
2. **Load image** → Read file, get dimensions, create data URL
3. **Dispatch action** → `dispatch(createAction('ADD_STAMP', stampObj))`
4. **Reducer processes** → AppState adds stamp to array
5. **History captures** → Current state saved to undo stack
6. **Subscribers called** → All listeners receive new state
7. **UI updates** → Canvas re-renders with new stamp
8. **Layout reflows** → Stamp overlay position calculated
9. **Toast shown** → User feedback "Stamp added"

### Undo Flow:

1. **User presses Ctrl+Z** → Keyboard event captured
2. **UIManager handles** → `toggleUndo()` called
3. **History.undo()** → Previous snapshot restored
4. **AppState updated** → Subscribers notified
5. **UI re-renders** → Changes reflected on canvas
6. **Toast shown** → "Undo successful"
7. **Redo stack updated** → For potential redo

---

## State Shape

```javascript
{
  // PDF document information
  pdf: {
    bytes: Uint8Array|null,      // PDF file bytes
    fileName: string,             // Original filename
    numPages: number,             // Total page count
    doc: PDFDocument|null         // pdf.js document instance
  },

  // Array of all stamps in current session
  stamps: [
    {
      id: string,                 // Unique ID: stamp-TIMESTAMP-COUNTER
      type: 'image'|'qr',         // Stamp type
      src: string,                // Data URL for images, text for QR
      x: number,                  // X position ratio (0-1)
      y: number,                  // Y position ratio (0-1)
      scale: number,              // Size percentage (10-200)
      rotation: number,           // Rotation degrees (-180 to 180)
      opacity: number,            // Opacity percentage (0-100)
      pages: string,              // Page range: 'all', 'first', 'last', '1,3,5-8'
      pageNumber: number          // Page where stamp was placed
    }
  ],

  // Currently active page in preview
  currentPage: number,            // 1-indexed page number

  // Currently selected stamp ID
  currentStampId: string|null,    // Selected stamp ID or null

  // UI state
  ui: {
    isDarkMode: boolean,          // Dark mode enabled
    isPreviewMode: boolean        // Preview-only mode
  },

  // Zoom and pan state
  zoom: {
    scale: number,                // Zoom level (0.5 to 3.0)
    panX: number,                 // X pan offset in pixels
    panY: number                  // Y pan offset in pixels
  }
}
```

### State Access Patterns:

```javascript
// Get current state
const state = appState.getCurrentState();

// Subscribe to changes
appState.subscribe((newState) => {
  console.log('State updated:', newState);
});

// Dispatch actions
appState.dispatch(createAction('ADD_STAMP', stampData));
appState.dispatch(createAction('SET_DARK_MODE', true));

// Use selectors
const stamps = appState.selectStamps();
const isDark = appState.selectDarkMode();
const zoom = appState.selectZoom();
```

---

## Testing Strategy

QR-Stamp uses Test-Driven Development (TDD) with Vitest for unit and integration tests.

### Test Organization

```
tests/
├── unit/                    # Isolated module tests
│   ├── state.test.js       # AppState reducer tests
│   ├── stamps.test.js      # StampLayer CRUD operations
│   ├── history.test.js     # Undo/redo functionality
│   ├── canvas.test.js      # Zoom/pan interactions
│   ├── templates.test.js   # Template management
│   ├── persistence.test.js # Config export/import
│   └── batch.test.js       # Batch processing queue
└── integration/             # Multi-module workflows
    └── workflow.test.js    # End-to-end scenarios
```

### Testing Approach

**Unit Tests (isolated module testing):**
- Each module tested independently
- Mock dependencies as needed
- Test public methods thoroughly
- Edge cases and error scenarios
- Immutability verification

**Example (AppState):**
```javascript
describe('AppState', () => {
  it('should initialize with default state', () => {
    const state = new AppState();
    expect(state.getCurrentState().stamps).toEqual([]);
  });

  it('should add stamp via ADD_STAMP action', () => {
    const state = new AppState();
    state.dispatch(createAction('ADD_STAMP', { id: '1' }));
    expect(state.selectStamps()).toHaveLength(1);
  });

  it('should maintain immutability', () => {
    const state = new AppState();
    const before = state.getCurrentState();
    state.dispatch(createAction('ADD_STAMP', { id: '1' }));
    const after = state.getCurrentState();
    expect(before).not.toBe(after);
  });
});
```

**Integration Tests (multi-module workflows):**
- Test realistic usage scenarios
- Verify module interactions
- End-to-end workflows
- Data persistence flow
- Undo/redo with multiple operations

**Example (Workflow):**
```javascript
describe('PDF Stamping Workflow', () => {
  it('should add, modify, and undo stamps', async () => {
    const state = new AppState();
    const history = new History(state);
    const stamps = new StampLayer(state);

    // Create stamp
    stamps.createStamp({ x: 0.5, y: 0.5, src: 'test.png' });
    expect(state.selectStamps()).toHaveLength(1);

    // Modify stamp
    stamps.updateStamp(state.selectStamps()[0].id, { scale: 150 });
    expect(state.selectStamps()[0].scale).toBe(150);

    // Undo
    history.undo();
    expect(state.selectStamps()[0].scale).toBe(100);
  });
});
```

### Test Coverage Goals

- **AppState:** 100% reducer coverage
- **StampLayer:** All CRUD operations, page filtering
- **History:** Undo/redo stacks, depth limits
- **CanvasController:** Zoom calculations, pan boundaries
- **TemplateManager:** Save/load, built-in templates
- **PersistenceManager:** JSON export/import, localStorage
- **UIManager:** Dark mode toggle, keyboard shortcuts
- **BatchProcessor:** Queue operations, filtering

### Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run specific file
npm test stamps.test.js

# Watch mode
npm test -- --watch
```

### Test Metrics

- **349 tests passing** (all unit + integration)
- Average execution time: < 2 seconds
- Coverage target: > 90% for all modules
- No flaky tests (all deterministic)

---

## File Organization

```
QR-Stamp/
├── src/
│   ├── main.js                 # Application entry point
│   ├── style.css               # Global styles, dark mode CSS
│   │
│   ├── modules/                # Core business logic
│   │   ├── state.js           # AppState (1-1) - Redux-style state mgmt
│   │   ├── stamps.js          # StampLayer (1-1) - Multi-stamp CRUD
│   │   ├── history.js         # History (1-1) - Undo/redo stack
│   │   ├── canvas.js          # CanvasController (1-1) - Zoom/pan
│   │   ├── templates.js       # TemplateManager (1-1) - Template library
│   │   ├── persistence.js     # PersistenceManager (1-1) - Config I/O
│   │   ├── ui.js              # UIManager (1-1) - Dark mode & a11y
│   │   ├── batch.js           # BatchProcessor (1-1) - Queue mgmt
│   │   └── textStamp.js       # TextStampGenerator (1-1) - Text stamps
│   │
│   ├── utils/
│   │   └── dom.js             # DOM utility functions (on, setStyle)
│   │
│   └── assets/                 # Images, icons
│       ├── hero.png
│       ├── vite.svg
│       └── javascript.svg
│
├── tests/
│   ├── unit/                   # Isolated module tests
│   │   ├── state.test.js
│   │   ├── stamps.test.js
│   │   ├── history.test.js
│   │   ├── canvas.test.js
│   │   ├── templates.test.js
│   │   ├── persistence.test.js
│   │   └── batch.test.js
│   │
│   └── integration/            # End-to-end workflow tests
│       └── workflow.test.js
│
├── docs/                       # Documentation
│   ├── FEATURES.md            # Feature guide
│   ├── ARCHITECTURE.md        # This file
│   └── [README.md updated]    # Quick start guide
│
├── index.html                 # HTML entry point
├── package.json              # Dependencies & scripts
├── vite.config.js            # Build configuration
└── vitest.config.js          # Test configuration
```

### Module Design Pattern

Each module follows a consistent pattern:

```javascript
/**
 * ModuleName - Brief description of responsibility
 */

export class ModuleName {
  /**
   * Constructor with required dependencies
   * @param {Dependency1} dep1
   * @param {Dependency2} dep2
   */
  constructor(dep1, dep2) {
    this.dep1 = dep1;
    this.dep2 = dep2;
  }

  /**
   * Public method with JSDoc
   * @param {Type} param - Description
   * @returns {ReturnType} Description
   */
  publicMethod(param) {
    // Implementation
  }

  /**
   * Private method (starts with _)
   * @private
   */
  _privateMethod() {
    // Implementation
  }
}
```

---

## Integration Patterns

### Pattern 1: State Updates

```javascript
// In main.js or event handlers
const stampLayer = new StampLayer(appState);

// Dispatch action through StampLayer
stampLayer.createStamp({
  type: 'image',
  src: dataUrl,
  x: 0.8,
  y: 0.1,
  scale: 100,
  rotation: 0,
  opacity: 100,
  pages: 'all'
});

// History automatically captures the new state
// UI subscribers are notified and re-render
```

### Pattern 2: Undo/Redo

```javascript
const history = new History(appState, 50);

// Any state change is captured
appState.subscribe(() => {
  history.recordSnapshot(appState.getCurrentState());
});

// Listen for undo request
document.addEventListener('undo-requested', () => {
  if (history.undo()) {
    showToast('Undone');
  }
});
```

### Pattern 3: Persistence

```javascript
const persistence = new PersistenceManager(appState);

// Export configuration
const jsonStr = persistence.exportConfiguration('MyConfig');

// Later, import configuration
persistence.importConfiguration(jsonStr);
// State is restored with all stamps
```

### Pattern 4: Event Handling

```javascript
// DOM events dispatch custom events
document.addEventListener('delete-stamp', (event) => {
  const { stampId } = event.detail;
  stampLayer.deleteStamp(stampId);
  showToast('Stamp deleted', 'success');
});

// Or dispatch state actions
appState.dispatch(createAction('SET_DARK_MODE', true));
```

---

## Performance Considerations

1. **Immutability:** Deep cloning preserves safety but costs performance
   - Acceptable for current data volumes (< 1000 stamps)
   - Could optimize with Immer.js for large datasets

2. **History Depth:** Default 50 snapshots provides balance
   - Each snapshot = full state clone
   - Memory usage ~ 50 * state size
   - Configurable for different hardware

3. **Subscribers:** Every state change notifies all subscribers
   - Current implementation: O(n) where n = subscriber count
   - Acceptable for < 10 subscribers
   - Could optimize with selector memoization

4. **Rendering:** Canvas re-renders on each state change
   - PDF.js rendering is expensive
   - Throttle/debounce for rapid changes in future

---

## Future Enhancements

1. **Middleware System** - Add logging, analytics
2. **Selector Memoization** - Optimize re-renders
3. **Lazy State Loading** - For very large PDFs
4. **Plugin Architecture** - Custom stamp generators
5. **Collaborative Features** - Multi-user editing
6. **Progressive Web App** - Offline support
7. **Advanced Batch Features** - Conditional stamping
8. **Custom Themes** - User theme customization

---

For feature details, see [FEATURES.md](FEATURES.md).
