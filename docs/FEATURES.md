# QR-Stamp Features Guide

QR-Stamp is a powerful PDF stamping application that runs 100% in your browser with complete privacy. All processing happens locally on your device—no files are uploaded to servers.

## 1. Multiple Stamps per Page

Add multiple stamps, signatures, logos, or QR codes to any page in your PDF document.

**Key Features:**
- Add unlimited stamps to a single PDF page
- Manage each stamp independently with unique properties
- Delete stamps individually
- Position stamps anywhere on the page
- Each stamp maintains its own position, size, rotation, and opacity

**Usage:**
1. Upload a PDF file
2. Select your first stamp (image or QR code)
3. Customize the stamp (size, opacity, rotation)
4. Click the preset position buttons or drag the stamp to position it
5. The stamp is automatically added to your layout
6. Repeat for additional stamps—each maintains independent properties

**Example:**
You can place an "APPROVED" stamp in the top right, a company logo in the bottom right, and a QR code linking to verification details in the center of the same page.

---

## 2. Text Stamp Editor

Generate custom text stamps with full typographic control and rendering as images.

**Key Features:**
- Create text stamps with customizable fonts (Arial, Georgia, Courier New, Times New Roman)
- Adjust font sizes from 8px to 72px
- Choose between normal and bold font weights
- Select custom text colors (hex color codes)
- Add optional borders around text
- Custom padding control
- Text rendered as PNG images for universal PDF compatibility
- Supports special formatting: dates, counters, custom text

**Usage:**
1. Navigate to the text stamp generator (available in UI controls)
2. Enter your text (e.g., "APPROVED", "2024-08-11", custom message)
3. Choose font family and size
4. Select font color (hex picker or preset colors)
5. Enable border if desired
6. Generate stamp as PNG image
7. Use generated stamp as your PDF stamp

**Example:**
Generate a red "REJECTED" stamp with 36px Arial Bold, add it as your PDF stamp, position it on pages that need rejection marking.

---

## 3. Undo/Redo History

Navigate through your changes with a comprehensive undo/redo system supporting up to 50 snapshots.

**Key Features:**
- Snapshot-based undo/redo tracking all state changes
- Configurable history depth (default 50 snapshots)
- Undo/redo stamp operations (add, delete, modify)
- Undo/redo position and property changes
- Undo/redo stamp selection
- Full state restoration on each undo/redo
- Keyboard shortcuts support

**Usage:**
- **Undo:** Press `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac)
- **Redo:** Press `Ctrl+Shift+Z` (Windows/Linux) or `Cmd+Shift+Z` (Mac)
- Each undo/redo action shows a toast notification
- History automatically captures snapshots before major operations

**Example:**
Position a stamp incorrectly, undo with Ctrl+Z to restore the previous position, then redo with Ctrl+Shift+Z if needed.

---

## 4. Zoom & Pan

Examine PDFs in detail with mouse wheel zoom and dragging to pan across the canvas.

**Key Features:**
- Mouse wheel zoom (0.5x to 3.0x magnification)
- Pan with middle-mouse button or Shift+drag
- Touch support for pinch-to-zoom on touchscreen devices
- Smooth zoom transitions
- Pan constraints to prevent getting lost
- Real-time zoom/pan state tracking

**Keyboard Shortcuts:**
- **Scroll wheel:** Zoom in/out
- **Shift + Drag:** Pan the canvas
- **Middle mouse button + Drag:** Alternative pan method

**Usage:**
1. Hover over the PDF preview canvas
2. Scroll mouse wheel up to zoom in, down to zoom out
3. Hold Shift and drag to pan around the zoomed view
4. Use zoom to verify stamp placement precisely
5. Pan to view different areas of the PDF at magnification

**Example:**
Zoom in 2x to verify stamp position in a corner, then pan to check the full page, zoom back out to 1x for final verification.

---

## 5. Stamp Templates

Use built-in templates for common stamping scenarios or create and save custom templates.

**Key Features:**
- Built-in templates: "Aprobado" (Approved), "Rechazado" (Rejected), "Confidencial" (Confidential), "Urgente" (Urgent)
- Pre-configured positions (angles, scales, colors)
- Custom template creation
- Save personal templates to localStorage
- Template library with quick-apply buttons
- Template editing and deletion
- Clone templates for variations

**Usage:**
1. Look for preset template buttons in the UI
2. Click any template button to instantly apply that configuration
3. Create custom templates from current stamp configuration
4. Save template with a descriptive name
5. Load saved templates from the template library
6. Delete templates you no longer need

**Built-in Templates:**
- **Aprobado (Approved):** Green stamp, bottom-right angle, 90% opacity
- **Rechazado (Rejected):** Red stamp, top-right angle, 90% opacity
- **Confidencial (Confidential):** Blue stamp, centered, 80% opacity
- **Urgente (Urgent):** Orange stamp, top-left angle, 90% opacity

**Example:**
Click the "Aprobado" preset to apply approved stamp styling in one click, then customize if needed.

---

## 6. Batch Processing

Process multiple PDF files sequentially with the same stamp configuration applied to all.

**Key Features:**
- Add multiple PDF files to a processing queue
- Apply single stamp configuration to all PDFs
- Track which files have been processed
- Get queue status (pending, processed count)
- Filters to PDFs only (auto-filters non-PDF files)
- Process files one at a time or in sequence
- Download stamped PDFs individually

**Usage:**
1. Enable batch processing mode
2. Add multiple PDF files to the queue (drag-and-drop or file picker)
3. Configure your stamp (image, QR code, position, size, rotation)
4. Click "Process All" or "Process Next"
5. Each file gets stamped with same configuration
6. Download each completed PDF or all at once

**Example:**
Batch process 10 invoices with company logo stamp in bottom-right corner—all stamped identically in seconds.

---

## 7. Configuration Persistence

Save and load stamp configurations as JSON files for reuse and sharing.

**Key Features:**
- Export current configuration as JSON file
- Import previously saved configurations
- Preserve all stamp properties: position, size, rotation, opacity, type
- Versioned configurations for future compatibility
- Timestamp tracking on all exports
- Configuration naming for organization
- Download and share configurations with team members
- localStorage support for auto-save of recent configs

**Configuration File Format:**
```json
{
  "version": "1.0",
  "name": "Company Logo Stamp",
  "timestamp": "2024-08-11T10:30:00.000Z",
  "stamps": [
    {
      "type": "image",
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

**Usage:**
1. Configure your stamp exactly as needed
2. Click "Export Configuration" button
3. Save the JSON file to your computer
4. To reuse: Click "Import Configuration"
5. Select the JSON file
6. Configuration loads with all properties restored
7. Apply to any PDF with one click

**Example:**
Export your company's standard logo stamp configuration, share it with team members, they import it for consistent branding.

---

## 8. Dark Mode & Accessibility

Professional dark mode theme and accessibility features for comfortable use in any lighting.

**Key Features:**
- Toggle dark mode for reduced eye strain
- System preference detection (follows OS dark mode setting)
- Persistent dark mode preference in localStorage
- High contrast text and UI elements
- Keyboard navigation support for all controls
- ARIA labels for screen readers
- Live regions for status announcements
- Semantic HTML structure
- Focus indicators for keyboard navigation
- Color contrast compliance

**Keyboard Shortcuts:**
- **Tab:** Navigate between form controls
- **Enter/Space:** Activate buttons and controls
- **Ctrl+Z / Cmd+Z:** Undo
- **Ctrl+Shift+Z / Cmd+Shift+Z:** Redo
- **Escape:** Close dialogs

**Usage:**
1. Click the dark mode toggle in the header
2. Dark mode preference saves automatically
3. Switch back to light mode anytime
4. Keyboard users: Use Tab to navigate, Enter to activate
5. Screen reader users: All controls properly labeled

**Accessibility Features:**
- High contrast text (WCAG AA compliant)
- Readable font sizes (minimum 14px)
- Color not sole indicator of status
- Form labels associated with inputs
- Error messages announced via live regions
- Focus trap in dialogs
- Logical tab order
- Skip links to main content

**Example:**
Working in dim lighting? Toggle dark mode for comfortable eye strain-free viewing. Need keyboard-only navigation? All features fully keyboard accessible.

---

## Keyboard Shortcuts Reference

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |
| Zoom In | Scroll Up | Scroll Up |
| Zoom Out | Scroll Down | Scroll Down |
| Pan Canvas | Shift+Drag | Shift+Drag |
| Navigate Controls | Tab | Tab |
| Activate Button | Enter/Space | Enter/Space |
| Close Dialog | Escape | Escape |

---

## Quick Start Examples

### Example 1: Add Company Logo to All Pages
1. Upload PDF
2. Click tab "Imagen / Logo" (Image)
3. Upload your company logo
4. Set scale to 80%
5. Click "bottom-right" preset
6. Select "Todas las páginas" (All pages)
7. Click "Generar y Descargar" (Process)

### Example 2: Add Approval QR Code
1. Upload PDF
2. Click tab "Código QR" (QR Code)
3. Enter verification URL: `https://verify.company.com/doc-12345`
4. Adjust size to 100%
5. Click "center" preset
6. Process on "Primera página" (First page only)
7. Download stamped PDF

### Example 3: Batch Process Invoices
1. Enable batch mode
2. Add 10 invoice PDFs
3. Upload invoice stamp image
4. Configure position (bottom-right)
5. Set to "Todas las páginas" (All pages)
6. Click "Process All"
7. Download all stamped invoices

---

## Tips & Tricks

- **Stamp Positioning:** Use preset buttons for quick placement, then fine-tune by dragging
- **Opacity Control:** Lower opacity (60-70%) for watermark effects, higher (90-100%) for strong marks
- **QR Codes:** Keep to 1:1 aspect ratio, test before mass-applying
- **Text Stamps:** Use size 28-36 for good visibility, bold for important stamps
- **Performance:** Zoom in to 100% for precise positioning verification
- **Batch Processing:** Group similar documents for efficient processing
- **Templates:** Save templates for repeated tasks to save configuration time
- **Dark Mode:** Switch if processing PDFs causes eye strain

---

## Troubleshooting

**Stamp appears blurry:**
- Ensure aspect ratio is correct
- Try different zoom levels for better visibility
- Check image quality before uploading

**QR code won't scan:**
- Verify URL is valid and complete
- Ensure QR size isn't too small (use 80% minimum)
- Check opacity isn't too low

**Configuration won't import:**
- Verify JSON file format is valid
- Check file hasn't been corrupted
- Ensure version compatibility

**Keyboard shortcuts not working:**
- Verify focus is on the webpage (not address bar)
- Check for conflicting browser extensions
- Try in different browser if issue persists

---

For more technical details, see [ARCHITECTURE.md](ARCHITECTURE.md).
