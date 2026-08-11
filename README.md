# QR-Stamp

[![Deploy to GitHub Pages](https://github.com/DictaDank/qr-stamp/actions/workflows/deploy.yml/badge.svg)](https://github.com/DictaDank/qr-stamp/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-gold.svg)](https://dictadank.github.io/qr-stamp/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success.svg)](#)
[![Tests](https://img.shields.io/badge/Tests-349%20Passing-emerald.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#)

A powerful PDF stamping application that runs 100% in your browser. Add signatures, logos, QR codes, and text stamps to PDFs with complete privacy—all processing happens locally on your device.

**Features:**
- ✅ Multiple stamps per page with independent controls
- ✅ Text stamp generator with custom fonts and colors
- ✅ Full undo/redo history (50 snapshots)
- ✅ Zoom & pan with mouse wheel and drag
- ✅ Stamp templates (built-in + custom)
- ✅ Batch processing for multiple PDFs
- ✅ Configuration persistence (export/import JSON)
- ✅ Dark mode with accessibility features
- ✅ 100% local processing—no uploads, no servers
- ✅ 349+ unit and integration tests

---

## Quick Start

### Installation

```bash
# Clone repository
git clone <repo-url>
cd QR-stamp

# Install dependencies
npm install
```

### Development

```bash
# Start dev server (http://localhost:5173)
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview build locally
npm run preview
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Watch mode
npm test -- --watch
```

---

## Usage

### Basic Workflow

1. **Upload PDF** - Drag and drop or click to select PDF file
2. **Choose Stamp** - Upload image/logo or enter QR code content
3. **Customize** - Adjust size, rotation, opacity, position
4. **Select Pages** - Apply to all pages or specific range
5. **Download** - Process and download stamped PDF

### Stamping a PDF with Company Logo

```
1. Open QR-Stamp in browser
2. Drag company logo PDF to dropzone
3. Click "Imagen / Logo" tab
4. Upload logo.png
5. Set scale to 80%, click "bottom-right" preset
6. Select "Todas las páginas" (All pages)
7. Click "Generar y Descargar"
8. Stamped PDF downloads automatically
```

### Adding QR Code Stamp

```
1. Upload PDF
2. Click "Código QR" tab
3. Enter verification URL: https://verify.company.com/doc-12345
4. Adjust size (100% for 1:1 aspect ratio)
5. Choose position preset
6. Select target pages
7. Click "Generar y Descargar"
```

### Using Templates

```
1. Configure stamp exactly as needed
2. Click template button (e.g., "Aprobado" preset)
3. Or save current config as custom template
4. Later, load template for quick reuse
```

---

## Features

For detailed feature documentation, see **[FEATURES.md](docs/FEATURES.md)**

| Feature | Description |
|---------|-------------|
| **Multiple Stamps** | Add unlimited stamps to single page |
| **Text Stamps** | Generate custom text with fonts, colors, sizes |
| **Undo/Redo** | 50-snapshot history for all operations |
| **Zoom & Pan** | Mouse wheel zoom (0.5x-3.0x) with Shift+drag pan |
| **Templates** | 4 built-in templates + custom template library |
| **Batch Processing** | Process multiple PDFs with same stamp |
| **Config Persistence** | Export/import stamp configs as JSON files |
| **Dark Mode** | Full dark/light theme with system preference detection |
| **Accessibility** | Keyboard navigation, ARIA labels, high contrast |
| **Keyboard Shortcuts** | Ctrl+Z (undo), Ctrl+Shift+Z (redo), Tab navigation |

---

## Architecture

For detailed architecture documentation, see **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**

### Module Structure

```
AppState (Redux-style state management)
    ↓
    ├── StampLayer (Multi-stamp CRUD)
    ├── History (Undo/redo snapshots)
    ├── CanvasController (Zoom/pan interaction)
    ├── TemplateManager (Template library)
    ├── PersistenceManager (Config export/import)
    ├── UIManager (Dark mode + accessibility)
    ├── BatchProcessor (Queue management)
    └── TextStampGenerator (Text stamp images)
```

### Data Flow

1. **User Action** → Event handler fires
2. **Dispatch Action** → Action creator packages data
3. **State Update** → Reducer processes action
4. **History Capture** → Snapshot saved to undo stack
5. **Subscribers Notify** → All listeners called
6. **UI Re-render** → Canvas and controls update
7. **User Feedback** → Toast notification shown

### Key Technologies

- **pdf-lib** - PDF manipulation (create/embed content)
- **pdfjs-dist** - PDF rendering (display preview)
- **qrcode** - QR code generation
- **Vite** - Build tool and dev server
- **Vitest** - Unit and integration testing

---

## Testing

QR-Stamp uses Test-Driven Development with Vitest.

### Test Structure

```
tests/
├── unit/
│   ├── state.test.js      - AppState reducer tests
│   ├── stamps.test.js     - StampLayer CRUD tests
│   ├── history.test.js    - Undo/redo tests
│   ├── canvas.test.js     - Zoom/pan tests
│   ├── templates.test.js  - Template management tests
│   ├── persistence.test.js - Config I/O tests
│   └── batch.test.js      - Batch queue tests
│
└── integration/
    └── workflow.test.js   - End-to-end workflow tests
```

### Run Tests

```bash
# Run all 349+ tests
npm test

# Interactive UI
npm run test:ui

# Watch mode for development
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Test Examples

**Unit Test (AppState):**
```javascript
it('should add stamp via ADD_STAMP action', () => {
  const state = new AppState();
  state.dispatch(createAction('ADD_STAMP', { id: '1', x: 0.5, y: 0.5 }));
  expect(state.selectStamps()).toHaveLength(1);
});
```

**Integration Test (Workflow):**
```javascript
it('should undo stamp creation', () => {
  const state = new AppState();
  const history = new History(state);
  const stamps = new StampLayer(state);

  stamps.createStamp({ x: 0.5, y: 0.5, src: 'test.png' });
  expect(state.selectStamps()).toHaveLength(1);

  history.undo();
  expect(state.selectStamps()).toHaveLength(0);
});
```

---

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |
| Zoom In | Scroll Up | Scroll Up |
| Zoom Out | Scroll Down | Scroll Down |
| Pan | Shift+Drag | Shift+Drag |
| Navigate | Tab | Tab |
| Activate | Enter/Space | Enter/Space |
| Close | Escape | Escape |

---

## Accessibility

QR-Stamp is built with accessibility as a core principle:

- **Keyboard Navigation** - All features accessible via keyboard
- **Screen Reader Support** - Semantic HTML with ARIA labels
- **Dark Mode** - Reduces eye strain, follows OS preference
- **High Contrast** - WCAG AA compliant color contrast
- **Focus Indicators** - Clear visual focus for keyboard users
- **Live Regions** - Status announcements for assistive tech
- **Readable Fonts** - Minimum 14px font sizes
- **Semantic HTML** - Proper heading hierarchy and labels

---

## Configuration Files

### Environment

No environment variables required. QR-Stamp is fully self-contained.

### Build Configuration

**vite.config.js** - Vite build configuration
- Entry point: `index.html`
- Output: `dist/`
- Modules: ES modules with dynamic imports

**vitest.config.js** - Test runner configuration
- Environment: jsdom
- Globals: true
- Coverage: enabled

**package.json** - Dependencies and scripts
- Core: `pdf-lib`, `pdfjs-dist`, `qrcode`
- Build: `vite`
- Test: `vitest`

---

## File Structure

```
QR-stamp/
├── src/
│   ├── main.js              # App entry point
│   ├── style.css            # Global styles + dark mode
│   ├── modules/             # Core business logic (8 modules)
│   │   ├── state.js
│   │   ├── stamps.js
│   │   ├── history.js
│   │   ├── canvas.js
│   │   ├── templates.js
│   │   ├── persistence.js
│   │   ├── ui.js
│   │   └── batch.js
│   ├── utils/
│   │   └── dom.js           # DOM helpers
│   └── assets/              # Images and icons
│
├── tests/
│   ├── unit/               # Module tests (8 files)
│   └── integration/        # Workflow tests (1 file)
│
├── docs/
│   ├── FEATURES.md         # Feature guide
│   ├── ARCHITECTURE.md     # Architecture overview
│   └── [README.md]         # This file
│
├── index.html              # HTML entry point
├── package.json            # Dependencies & scripts
├── vite.config.js          # Build config
├── vitest.config.js        # Test config
└── .gitignore              # Git exclusions
```

---

## Browser Support

QR-Stamp works in all modern browsers:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Requires:
- ES2020+ JavaScript support
- File API for uploads
- Canvas API for rendering
- localStorage for persistence

---

## Performance

- **Fast:** Zoom/pan canvas in real-time
- **Responsive:** Sub-100ms state updates
- **Memory Efficient:** 50-snapshot undo history
- **Large Files:** Handles PDFs up to 100MB+
- **Batch Mode:** Process 100+ files efficiently

---

## Privacy & Security

🔒 **100% Local Processing**

- All processing happens in your browser
- No server uploads or network requests
- No cookies or tracking
- No analytics or telemetry
- No login required
- No personal data stored outside your device (except localStorage for preferences)

localStorage only stores:
- Dark mode preference
- Custom template library
- Recent configuration exports
- No PDF content or personal data

---

## Troubleshooting

### Stamp appears blurry
- Check image resolution (use high-quality source)
- Verify aspect ratio matches original
- Try different zoom levels

### QR code won't scan
- Ensure URL is valid and complete
- Keep QR size at 80%+ of intended scale
- Check opacity isn't too low (< 50%)

### Configuration import fails
- Verify JSON file isn't corrupted
- Check file format matches version 1.0
- Try exporting fresh config to compare

### Dark mode not persisting
- Check browser allows localStorage
- Clear browser storage and toggle dark mode again
- Check for localStorage quota errors in console

### Undo/redo not working
- Verify focus is on webpage (not address bar)
- Check for conflicting browser extensions
- Try in incognito/private mode

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Code Style

- Use ES6+ module syntax
- One class per file in `src/modules/`
- JSDoc comments for public methods
- camelCase for variables and methods
- UPPER_CASE for constants

### Testing

- Write tests for all new features
- Maintain > 90% code coverage
- Test both happy path and edge cases
- Use descriptive test names

### Commits

- Use conventional commits: `feat:`, `fix:`, `test:`, `docs:`
- Reference issues: `Fixes #123`
- Keep commits atomic (one feature per commit)

### Pull Requests

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Write tests and code
4. Run tests: `npm test`
5. Build: `npm run build`
6. Commit with conventional message
7. Push and open PR with description

---

## License

MIT License - see LICENSE file for details

This project is provided as-is for personal and commercial use with appropriate attribution.

---

## Support

For issues, questions, or suggestions:
1. Check [FEATURES.md](docs/FEATURES.md) for usage help
2. Review [ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
3. Open an issue on GitHub with:
   - Detailed description
   - Steps to reproduce
   - Browser and OS version
   - Screenshot/video if applicable

---

## Changelog

### Version 1.0.0 (2024-08-11)
- ✨ Initial release
- ✨ 8 core features implemented
- ✨ 349+ passing tests
- ✨ Full dark mode support
- ✨ Accessibility features complete
- ✨ Comprehensive documentation

### Roadmap
- [ ] Progressive Web App (PWA) support
- [ ] Advanced batch processing (conditional stamping)
- [ ] Plugin architecture for custom stamp generators
- [ ] Collaborative editing features
- [ ] Advanced theme customization
- [ ] Mobile app version

---

## Credits

Built with:
- [pdf-lib](https://pdfme.js.org/) - PDF manipulation
- [pdf.js](https://mozilla.github.io/pdf.js/) - PDF rendering
- [QRCode.js](https://davidshimjs.github.io/qrcodejs/) - QR code generation
- [Vite](https://vitejs.dev/) - Build tool
- [Vitest](https://vitest.dev/) - Test runner

---

**Made with ❤️ for PDF professionals and developers**

Start stamping: [Open QR-Stamp](https://qr-stamp.example.com)
