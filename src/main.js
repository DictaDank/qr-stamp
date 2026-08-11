import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import './style.css';

// === SECURITY CONFIGURATION ===
const SECURITY_CONFIG = {
  MAX_PDF_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5 MB
  MAX_PAGES: 10000,
  PDF_MAGIC_BYTES: [0x25, 0x50, 0x44, 0x46], // %PDF
  PROCESS_DEBOUNCE_MS: 2000,
  MAX_QR_LENGTH: 2953, // QR code spec max
  SESSION_TIMEOUT_MS: 15 * 60 * 1000, // 15 min (Mejora 21)
  MAX_ACTIONS_PER_MINUTE: 10, // (Mejora 26)
  IS_PRODUCTION: !import.meta.env.DEV // (Mejora 23)
};

// Mejora 26: Contador de acciones para detectar abuso
const actionTracker = {
  processedPdfs: [],
  generatedQRs: [],
  uploadedImages: []
};

// Mejora 20: Estados válidos de la aplicación
const APP_STATES = {
  UPLOAD: 'upload',
  WORKSPACE: 'workspace'
};

let currentAppState = APP_STATES.UPLOAD;

// Mejora 21: Tracking de actividad
let lastActivityTime = Date.now();

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Elements
const dropzone = document.getElementById('dropzone');
const pdfFileInput = document.getElementById('pdf-file-input');
const stepUpload = document.getElementById('step-upload');
const stepWorkspace = document.getElementById('step-workspace');
const cancelBtn = document.getElementById('cancel-btn');
const processBtn = document.getElementById('process-btn');
const processBtnText = document.getElementById('process-btn-text');
const processSpinner = document.getElementById('process-spinner');

const tabImageBtn = document.getElementById('tab-image-btn');
const tabQrBtn = document.getElementById('tab-qr-btn');
const tabImage = document.getElementById('tab-image');
const tabQr = document.getElementById('tab-qr');

const stampImageInput = document.getElementById('stamp-image-input');
const stampUploadLabel = document.getElementById('stamp-upload-label');
const qrTextInput = document.getElementById('qr-text-input');
const stampScaleSlider = document.getElementById('stamp-scale');
const stampScaleVal = document.getElementById('stamp-scale-val');
const stampOpacitySlider = document.getElementById('stamp-opacity');
const stampOpacityVal = document.getElementById('stamp-opacity-val');
const stampRotationSlider = document.getElementById('stamp-rotation');
const stampRotationVal = document.getElementById('stamp-rotation-val');

const stampPagesSelect = document.getElementById('stamp-pages-select');
const stampPagesRangeGroup = document.getElementById('stamp-pages-range-group');
const stampPagesInput = document.getElementById('stamp-pages-input');

const pdfMetaName = document.getElementById('pdf-meta-name');
const pdfPreviewCanvas = document.getElementById('pdf-preview-canvas');
const stampOverlay = document.getElementById('stamp-overlay');
const stampOverlayContent = document.getElementById('stamp-overlay-content');

const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageNumIndicator = document.getElementById('page-num-indicator');
const presetButtons = document.querySelectorAll('.preset-btn');
const toastContainer = document.getElementById('toast-container');

// State
let pdfDoc = null;
let pdfBytes = null;
let pdfFileName = '';
let currentPage = 1;
let totalPages = 1;

let stampType = 'image'; // 'image' or 'qr'
let stampImageSrc = ''; // Data URL of the stamp (uploaded image or generated QR)
let aspectRatio = 1.0; // width / height of stamp
let stampRotation = 0; // rotation in degrees (-180 to 180)

// Normalized positions (0.0 to 1.0 relative to canvas size)
let xRatio = 0.8;
let yRatio = 0.8;

// Dragging State
let isDragging = false;
let startX = 0;
let startY = 0;
let stampLeft = 0;
let stampTop = 0;

// Rate limiting for process button
let lastProcessTime = 0;
let isProcessing = false;

// === SECURITY FUNCTIONS ===

function validatePdfMagicBytes(buffer) {
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer, 0, 4);
  return view[0] === SECURITY_CONFIG.PDF_MAGIC_BYTES[0] &&
         view[1] === SECURITY_CONFIG.PDF_MAGIC_BYTES[1] &&
         view[2] === SECURITY_CONFIG.PDF_MAGIC_BYTES[2] &&
         view[3] === SECURITY_CONFIG.PDF_MAGIC_BYTES[3];
}

function validateFileSize(file, maxSize) {
  if (file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    throw new Error(`Archivo demasiado grande. Máximo: ${sizeMB}MB`);
  }
}

function validateDataUrl(dataUrl) {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Data URL inválida: debe ser una imagen');
  }
  const validMimes = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/jpg;base64,'];
  return validMimes.some(mime => dataUrl.startsWith(mime));
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
}

function validatePageCount(count) {
  if (count > SECURITY_CONFIG.MAX_PAGES) {
    throw new Error(`Documento muy grande: máximo ${SECURITY_CONFIG.MAX_PAGES} páginas`);
  }
}

function validateQrInput(text) {
  if (text.length > SECURITY_CONFIG.MAX_QR_LENGTH) {
    throw new Error(`Contenido QR demasiado largo: máximo ${SECURITY_CONFIG.MAX_QR_LENGTH} caracteres`);
  }
}

function sanitizeHtmlContent(element, text) {
  element.textContent = text;
}

// === MEJORA 11: Limpiar datos sensibles de memoria ===
function clearSensitiveData() {
  pdfBytes = null;
  pdfDoc = null;
  stampImageSrc = '';
  pdfFileName = '';
  // Notificar que los datos fueron limpiados
  logSecurityEvent('Sensitive data cleared', 'info');
}

// === MEJORA 16: Validar estructura interna del PDF ===
async function validatePdfStructure(bytes) {
  try {
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    if (!pages || pages.length === 0) {
      throw new Error('PDF structure invalid: no pages found');
    }
    return true;
  } catch (err) {
    throw new Error('PDF structure validation failed');
  }
}

// === MEJORA 20: Validar transiciones de estado ===
function transitionState(newState) {
  const validTransitions = {
    [APP_STATES.UPLOAD]: [APP_STATES.WORKSPACE],
    [APP_STATES.WORKSPACE]: [APP_STATES.UPLOAD]
  };

  if (!validTransitions[currentAppState]?.includes(newState)) {
    logSecurityEvent(`Invalid state transition: ${currentAppState} -> ${newState}`, 'warning');
    throw new Error('Invalid state transition');
  }

  currentAppState = newState;
  logSecurityEvent(`State transition: ${newState}`, 'info');
}

// === MEJORA 21: Timeout automático para sesiones ===
function updateActivityTime() {
  lastActivityTime = Date.now();
}

function checkSessionTimeout() {
  const elapsed = Date.now() - lastActivityTime;
  if (elapsed > SECURITY_CONFIG.SESSION_TIMEOUT_MS) {
    clearSensitiveData();
    showToast('Sesión expirada por inactividad. Datos limpiados.', 'error');
    logSecurityEvent('Session timeout triggered', 'warning');
  }
}

// === MEJORA 23: No revelar stack traces en producción ===
function handleSecureError(err, userMessage = 'Ha ocurrido un error') {
  if (SECURITY_CONFIG.IS_PRODUCTION) {
    // En producción: no loguear detalles
    console.error('[Security] Error occurred');
    logSecurityEvent('Error occurred (details hidden in production)', 'warning');
  } else {
    // En desarrollo: mostrar detalles para debugging
    console.error('[Debug] Error:', err.message);
  }
  showToast(userMessage, 'error');
}

// === MEJORA 26: Detectar patrones de abuso ===
function trackAction(actionType) {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  if (actionType === 'pdf') {
    actionTracker.processedPdfs = actionTracker.processedPdfs.filter(t => t > oneMinuteAgo);
    actionTracker.processedPdfs.push(now);

    if (actionTracker.processedPdfs.length > SECURITY_CONFIG.MAX_ACTIONS_PER_MINUTE) {
      logSecurityEvent(`Rate limit exceeded: PDFs (${actionTracker.processedPdfs.length}/min)`, 'warning');
      throw new Error('Demasiadas operaciones. Por favor espera.');
    }
  } else if (actionType === 'qr') {
    actionTracker.generatedQRs = actionTracker.generatedQRs.filter(t => t > oneMinuteAgo);
    actionTracker.generatedQRs.push(now);

    if (actionTracker.generatedQRs.length > SECURITY_CONFIG.MAX_ACTIONS_PER_MINUTE * 2) {
      logSecurityEvent(`Rate limit exceeded: QRs (${actionTracker.generatedQRs.length}/min)`, 'warning');
      throw new Error('Demasiados códigos QR. Por favor espera.');
    }
  } else if (actionType === 'image') {
    actionTracker.uploadedImages = actionTracker.uploadedImages.filter(t => t > oneMinuteAgo);
    actionTracker.uploadedImages.push(now);

    if (actionTracker.uploadedImages.length > SECURITY_CONFIG.MAX_ACTIONS_PER_MINUTE) {
      logSecurityEvent(`Rate limit exceeded: Images (${actionTracker.uploadedImages.length}/min)`, 'warning');
      throw new Error('Demasiadas imágenes. Por favor espera.');
    }
  }
}

// === Logging de eventos de seguridad ===
function logSecurityEvent(event, severity = 'info') {
  const log = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    state: currentAppState
  };

  try {
    const logs = JSON.parse(sessionStorage.getItem('securityLogs') || '[]');
    logs.push(log);
    // Mantener solo los últimos 100 eventos
    sessionStorage.setItem('securityLogs', JSON.stringify(logs.slice(-100)));
  } catch (e) {
    // Si sessionStorage falla, ignorar silenciosamente
  }
}

// === Iniciar monitoreo de sesión ===
setInterval(checkSessionTimeout, 60000); // Verificar cada minuto

// Actualizar actividad en cualquier interacción del usuario
document.addEventListener('click', updateActivityTime);
document.addEventListener('keydown', updateActivityTime);
document.addEventListener('mousemove', updateActivityTime);

// Initialize QR code on load
initDefaultQR();

// --- Initialization ---

async function initDefaultQR() {
  try {
    updateActivityTime();
    trackAction('qr');
    const defaultText = qrTextInput.value || 'https://example.com';
    validateQrInput(defaultText);
    const qrDataUrl = await QRCode.toDataURL(defaultText, {
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    if (!validateDataUrl(qrDataUrl)) {
      throw new Error('QR inválido generado');
    }
    stampImageSrc = qrDataUrl;
    aspectRatio = 1.0;

    const img = document.createElement('img');
    img.src = stampImageSrc;
    img.className = 'stamp-overlay-img';
    img.alt = 'Sello Preview';
    stampOverlayContent.innerHTML = '';
    stampOverlayContent.appendChild(img);
    logSecurityEvent('Default QR initialized', 'info');
  } catch (err) {
    handleSecureError(err, 'Error al generar código QR.');
  }
}

// --- Drag & Drop PDF Upload ---

// Trigger file input click on dropzone click
dropzone.addEventListener('click', () => pdfFileInput.click());

// Drag events
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  }, false);
});

// Drop file
dropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0 && files[0].type === 'application/pdf') {
    handlePdfFile(files[0]);
  } else {
    showToast('Por favor, selecciona un archivo PDF válido.', 'error');
  }
});

// File input change
pdfFileInput.addEventListener('change', (e) => {
  const files = e.target.files;
  if (files.length > 0) {
    handlePdfFile(files[0]);
  }
});

// Load PDF Document
async function handlePdfFile(file) {
  try {
    updateActivityTime();
    trackAction('pdf');
    validateFileSize(file, SECURITY_CONFIG.MAX_PDF_SIZE);

    pdfFileName = sanitizeFilename(file.name);
    sanitizeHtmlContent(pdfMetaName, pdfFileName);

    showToast('Cargando PDF...', 'success');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        pdfBytes = e.target.result;

        if (!validatePdfMagicBytes(pdfBytes)) {
          throw new Error('Archivo inválido: no es un PDF válido');
        }

        // Mejora 16: Validar estructura del PDF
        await validatePdfStructure(pdfBytes);

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
        pdfDoc = await loadingTask.promise;
        validatePageCount(pdfDoc.numPages);
        totalPages = pdfDoc.numPages;
        currentPage = 1;

        stepUpload.classList.add('hidden');
        stepWorkspace.classList.remove('hidden');

        // Mejora 20: Transición de estado
        transitionState(APP_STATES.WORKSPACE);

        await renderPreviewPage(currentPage);
        applyPreset('bottom-right');

        showToast('Documento cargado correctamente.', 'success');
        logSecurityEvent('PDF loaded successfully', 'info');
      } catch (err) {
        // Mejora 23: No revelar detalles en producción
        handleSecureError(err, 'Error al procesar el archivo PDF.');
        pdfBytes = null;
        pdfDoc = null;
      }
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    handleSecureError(err, err.message);
  }
}

// --- Render PDF Page ---

async function renderPreviewPage(pageNum) {
  if (!pdfDoc) return;
  
  try {
    const page = await pdfDoc.getPage(pageNum);
    
    // Calculate appropriate preview scale based on viewport width
    const viewportWidth = Math.min(650, window.innerWidth - 40);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = viewportWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });
    
    pdfPreviewCanvas.width = viewport.width;
    pdfPreviewCanvas.height = viewport.height;
    
    const context = pdfPreviewCanvas.getContext('2d');
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Update navigation controls
    pageNumIndicator.textContent = `Página ${pageNum} de ${totalPages}`;
    prevPageBtn.disabled = pageNum <= 1;
    nextPageBtn.disabled = pageNum >= totalPages;
    
    // Position stamp overlay based on ratios
    updateStampSizeAndPosition();
  } catch (err) {
    console.error('Error rendering page:', err);
    showToast('Error al previsualizar la página del PDF.', 'error');
  }
}

// Page Navigation
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderPreviewPage(currentPage);
  }
});

nextPageBtn.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage++;
    renderPreviewPage(currentPage);
  }
});

// --- Tabs (Image vs QR) ---

tabImageBtn.addEventListener('click', () => {
  tabImageBtn.classList.add('active');
  tabQrBtn.classList.remove('active');
  tabImage.classList.add('active');
  tabQr.classList.remove('active');
  stampType = 'image';
  
  // Revert back to uploaded image if available, else clear
  const file = stampImageInput.files[0];
  if (file && stampImageSrc.startsWith('data:image')) {
    // Already has loaded image
    updateStampSizeAndPosition();
  } else {
    // Default placeholder
    stampOverlayContent.innerHTML = '<div class="stamp-overlay-placeholder">Sube una firma/imagen</div>';
    aspectRatio = 1.5; // generic rectangle
    updateStampSizeAndPosition();
  }
});

tabQrBtn.addEventListener('click', () => {
  tabQrBtn.classList.add('active');
  tabImageBtn.classList.remove('active');
  tabQr.classList.add('active');
  tabImage.classList.remove('active');
  stampType = 'qr';
  aspectRatio = 1.0;
  generateQRFromInput();
});

// Handle custom image file upload
stampImageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    updateActivityTime();
    trackAction('image');
    validateFileSize(file, SECURITY_CONFIG.MAX_IMAGE_SIZE);
    sanitizeHtmlContent(stampUploadLabel, file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dataUrl = event.target.result;
        if (!validateDataUrl(dataUrl)) {
          throw new Error('Formato de imagen inválido');
        }

        const img = new Image();
        img.onload = () => {
          aspectRatio = img.naturalWidth / img.naturalHeight;
          stampImageSrc = dataUrl;

          const imgEl = document.createElement('img');
          imgEl.src = stampImageSrc;
          imgEl.className = 'stamp-overlay-img';
          imgEl.alt = 'Sello Imagen';
          stampOverlayContent.innerHTML = '';
          stampOverlayContent.appendChild(imgEl);
          updateStampSizeAndPosition();
          logSecurityEvent('Image uploaded successfully', 'info');
        };
        img.onerror = () => {
          handleSecureError(new Error('Image load error'), 'Error al cargar la imagen');
        };
        img.src = dataUrl;
      } catch (err) {
        handleSecureError(err, err.message);
      }
    };
    reader.readAsDataURL(file);
  } catch (err) {
    handleSecureError(err, err.message);
  }
});

// Generate QR Code dynamically
qrTextInput.addEventListener('input', () => {
  if (stampType === 'qr') {
    generateQRFromInput();
  }
});

async function generateQRFromInput() {
  const text = qrTextInput.value.trim();
  if (!text) return;

  try {
    updateActivityTime();
    trackAction('qr');
    validateQrInput(text);
    const qrDataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    if (!validateDataUrl(qrDataUrl)) {
      throw new Error('QR inválido');
    }
    stampImageSrc = qrDataUrl;
    aspectRatio = 1.0;

    const img = document.createElement('img');
    img.src = stampImageSrc;
    img.className = 'stamp-overlay-img';
    img.alt = 'QR Preview';
    stampOverlayContent.innerHTML = '';
    stampOverlayContent.appendChild(img);
    updateStampSizeAndPosition();
    logSecurityEvent('QR generated from input', 'info');
  } catch (err) {
    handleSecureError(err, 'Error al generar código QR');
  }
}

// --- Sliders (Scale, Opacity) ---

stampScaleSlider.addEventListener('input', (e) => {
  stampScaleVal.textContent = `${e.target.value}%`;
  updateStampSizeAndPosition();
});

stampOpacitySlider.addEventListener('input', (e) => {
  stampOpacityVal.textContent = `${e.target.value}%`;
  updateStampSizeAndPosition();
});

stampRotationSlider.addEventListener('input', (e) => {
  stampRotation = parseInt(e.target.value, 10);
  stampRotationVal.textContent = `${stampRotation}°`;
  updateStampSizeAndPosition();
});

// --- Page Selection settings ---

stampPagesSelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    stampPagesRangeGroup.classList.remove('hidden');
  } else {
    stampPagesRangeGroup.classList.add('hidden');
  }
});

// --- Stamp Size and Dragging Position ---

function updateStampSizeAndPosition() {
  if (!pdfPreviewCanvas.width) return;
  
  const canvasWidth = pdfPreviewCanvas.width;
  const canvasHeight = pdfPreviewCanvas.height;
  
  // Calculate stamp pixels size based on slider (100% scale = 120px base width)
  const baseWidth = 120;
  const scaleFactor = parseInt(stampScaleSlider.value, 10) / 100;
  const stampWidth = baseWidth * scaleFactor;
  const stampHeight = stampWidth / aspectRatio;
  
  // Update styles
  stampOverlay.style.width = `${stampWidth}px`;
  stampOverlay.style.height = `${stampHeight}px`;
  stampOverlay.style.opacity = parseInt(stampOpacitySlider.value, 10) / 100;
  
  // Clamp ratios so the stamp is fully within canvas boundaries
  const maxRatioX = 1 - (stampWidth / canvasWidth);
  const maxRatioY = 1 - (stampHeight / canvasHeight);
  
  xRatio = Math.max(0, Math.min(xRatio, maxRatioX));
  yRatio = Math.max(0, Math.min(yRatio, maxRatioY));
  
  // Convert ratios back to absolute pixels
  stampLeft = xRatio * canvasWidth;
  stampTop = yRatio * canvasHeight;
  
  stampOverlay.style.left = `${stampLeft}px`;
  stampOverlay.style.top = `${stampTop}px`;
  stampOverlay.style.transform = `rotate(${stampRotation}deg)`;
}

// Draggable using Pointer Events (touch/mouse friendly)
stampOverlay.addEventListener('pointerdown', (e) => {
  isDragging = true;
  startX = e.clientX - stampLeft;
  startY = e.clientY - stampTop;
  
  // Highlight preset button state
  presetButtons.forEach(btn => btn.classList.remove('active'));
  
  stampOverlay.setPointerCapture(e.pointerId);
  e.preventDefault();
});

stampOverlay.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  
  const canvasWidth = pdfPreviewCanvas.width;
  const canvasHeight = pdfPreviewCanvas.height;
  const stampWidth = stampOverlay.offsetWidth;
  const stampHeight = stampOverlay.offsetHeight;
  
  let x = e.clientX - startX;
  let y = e.clientY - startY;
  
  // Boundaries
  const maxX = canvasWidth - stampWidth;
  const maxY = canvasHeight - stampHeight;
  
  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));
  
  stampLeft = x;
  stampTop = y;
  
  // Update Ratios
  xRatio = stampLeft / canvasWidth;
  yRatio = stampTop / canvasHeight;
  
  stampOverlay.style.left = `${stampLeft}px`;
  stampOverlay.style.top = `${stampTop}px`;
});

stampOverlay.addEventListener('pointerup', (e) => {
  if (isDragging) {
    isDragging = false;
    stampOverlay.releasePointerCapture(e.pointerId);
  }
});

// Resize window handler to keep proportions
window.addEventListener('resize', () => {
  updateStampSizeAndPosition();
});

// --- Presets ---

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyPreset(btn.dataset.position);
  });
});

function applyPreset(preset) {
  if (!pdfPreviewCanvas.width) return;
  
  const canvasWidth = pdfPreviewCanvas.width;
  const canvasHeight = pdfPreviewCanvas.height;
  const stampWidth = stampOverlay.offsetWidth;
  const stampHeight = stampOverlay.offsetHeight;
  
  const maxXRatio = 1 - (stampWidth / canvasWidth);
  const maxYRatio = 1 - (stampHeight / canvasHeight);
  
  switch (preset) {
    case 'top-left':
      xRatio = 0;
      yRatio = 0;
      break;
    case 'top-right':
      xRatio = maxXRatio;
      yRatio = 0;
      break;
    case 'bottom-left':
      xRatio = 0;
      yRatio = maxYRatio;
      break;
    case 'bottom-right':
      xRatio = maxXRatio;
      yRatio = maxYRatio;
      break;
    case 'center':
      xRatio = maxXRatio / 2;
      yRatio = maxYRatio / 2;
      break;
  }
  
  updateStampSizeAndPosition();
}

// --- Cancel Button ---

cancelBtn.addEventListener('click', () => {
  try {
    updateActivityTime();
    // Mejora 11: Limpiar datos sensibles
    clearSensitiveData();
    pdfFileInput.value = '';
    stampImageInput.value = '';
    stampUploadLabel.textContent = 'Seleccionar imagen (PNG, JPG)';

    stepWorkspace.classList.add('hidden');
    stepUpload.classList.remove('hidden');

    // Mejora 20: Transición de estado
    transitionState(APP_STATES.UPLOAD);

    showToast('Datos limpiados. Cargando nueva sesión.', 'success');
  } catch (err) {
    handleSecureError(err, 'Error al limpiar datos');
  }
});

// --- PDF Stamping Core (pdf-lib) ---

processBtn.addEventListener('click', async () => {
  try {
    updateActivityTime();
    trackAction('pdf');

    const now = Date.now();
    if (isProcessing || (now - lastProcessTime) < SECURITY_CONFIG.PROCESS_DEBOUNCE_MS) {
      showToast('Por favor espera antes de procesar otro documento.', 'error');
      return;
    }

    if (!pdfBytes) return;

    if (stampType === 'image' && !stampImageSrc.startsWith('data:image')) {
      showToast('Sube una imagen de firma o selecciona Código QR primero.', 'error');
      return;
    }

    isProcessing = true;
    lastProcessTime = now;
    processBtn.disabled = true;
    processSpinner.classList.remove('hidden');
    processBtnText.textContent = 'Procesando...';

    const pageIndices = parseTargetPages();
    if (pageIndices.length === 0) {
      showToast('Las páginas especificadas no corresponden al PDF cargado.', 'error');
      return;
    }

    const pdfLibDoc = await PDFDocument.load(pdfBytes);

    let embeddedImg;
    if (stampImageSrc.startsWith('data:image/png;base64,')) {
      embeddedImg = await pdfLibDoc.embedPng(stampImageSrc);
    } else if (stampImageSrc.startsWith('data:image/jpeg;base64,') || stampImageSrc.startsWith('data:image/jpg;base64,')) {
      embeddedImg = await pdfLibDoc.embedJpg(stampImageSrc);
    } else {
      embeddedImg = await pdfLibDoc.embedPng(stampImageSrc);
    }

    const scaleFactor = parseInt(stampScaleSlider.value, 10) / 100;
    const opacityFactor = parseInt(stampOpacitySlider.value, 10) / 100;

    const libPages = pdfLibDoc.getPages();

    for (const pageIdx of pageIndices) {
      const page = libPages[pageIdx];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      const canvasWidth = pdfPreviewCanvas.width;
      const canvasHeight = pdfPreviewCanvas.height;

      const stampWidthInCanvas = 120 * scaleFactor;
      const stampHeightInCanvas = stampWidthInCanvas / aspectRatio;

      const pdfStampWidth = (stampWidthInCanvas / canvasWidth) * pageWidth;
      const pdfStampHeight = (stampHeightInCanvas / canvasHeight) * pageHeight;

      const pdfX = xRatio * pageWidth;
      const pdfY = (1 - yRatio - (stampHeightInCanvas / canvasHeight)) * pageHeight;

      page.drawImage(embeddedImg, {
        x: pdfX,
        y: pdfY,
        width: pdfStampWidth,
        height: pdfStampHeight,
        opacity: opacityFactor,
        degrees: -stampRotation
      });
    }

    const modifiedPdfBytes = await pdfLibDoc.save();

    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    const dotIdx = pdfFileName.lastIndexOf('.');
    const nameWithoutExt = dotIdx !== -1 ? pdfFileName.substring(0, dotIdx) : pdfFileName;
    const filename = sanitizeFilename(`${nameWithoutExt}_sellado.pdf`);

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Documento PDF',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('PDF guardado con éxito.', 'success');
        logSecurityEvent('PDF processed and saved', 'info');
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          showToast('Guardado cancelado.', 'error');
          return;
        }
      }
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    showToast('PDF generado y descargado con éxito.', 'success');
    logSecurityEvent('PDF processed and downloaded', 'info');
  } catch (err) {
    handleSecureError(err, 'Hubo un error al estampar el PDF.');
  } finally {
    isProcessing = false;
    processBtn.disabled = false;
    processSpinner.classList.add('hidden');
    processBtnText.textContent = 'Generar y Descargar';
  }
});

// Helper: Parse target page indices
function parseTargetPages() {
  const selection = stampPagesSelect.value;

  if (selection === 'first') {
    return [0];
  }
  if (selection === 'last') {
    return [totalPages - 1];
  }
  if (selection === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const rangeStr = stampPagesInput.value.trim();
  if (!rangeStr) return [0];

  const pages = new Set();
  const parts = rangeStr.split(',');

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        if (min <= max) {
          for (let i = min; i <= max; i++) {
            pages.add(i - 1);
          }
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p - 1);
      }
    }
  }

  if (pages.size > SECURITY_CONFIG.MAX_PAGES) {
    throw new Error(`Demasiadas páginas seleccionadas: máximo ${SECURITY_CONFIG.MAX_PAGES}`);
  }

  return Array.from(pages).sort((a, b) => a - b);
}

// --- Toast Notifications Helper ---

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = document.createElement('div');
  if (type === 'success') {
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 20px; height: 20px; color: #10b981;">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    `;
  } else {
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 20px; height: 20px; color: #ef4444;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    `;
  }
  
  const text = document.createElement('span');
  text.textContent = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  toastContainer.appendChild(toast);
  
  // Auto remove after 3s
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- Testing hook: auto-load sample PDF if ?test=true is in URL ---
// This is for local development only. All processing happens client-side.
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('test')) {
  fetch('/sample.pdf')
    .then(res => {
      if (!res.ok) throw new Error('No se pudo descargar el PDF de muestra.');
      return res.arrayBuffer();
    })
    .then(buffer => {
      if (!validatePdfMagicBytes(buffer)) {
        throw new Error('Invalid PDF format');
      }
      // Mejora 16: Validar estructura
      return validatePdfStructure(buffer).then(() => buffer);
    })
    .then(buffer => {
      pdfBytes = buffer;
      pdfFileName = sanitizeFilename('sample.pdf');
      sanitizeHtmlContent(pdfMetaName, pdfFileName);
      return pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
    })
    .then(doc => {
      validatePageCount(doc.numPages);
      pdfDoc = doc;
      totalPages = pdfDoc.numPages;
      currentPage = 1;

      stepUpload.classList.add('hidden');
      stepWorkspace.classList.remove('hidden');

      // Mejora 20: Transición de estado
      currentAppState = APP_STATES.WORKSPACE;

      renderPreviewPage(1);
      applyPreset('bottom-right');
      showToast('PDF de prueba cargado automáticamente.', 'success');
      logSecurityEvent('Test PDF loaded', 'info');
    })
    .catch(() => {
      showToast('Error al auto-cargar el PDF de prueba.', 'error');
      logSecurityEvent('Test PDF load failed', 'warning');
    });
}

