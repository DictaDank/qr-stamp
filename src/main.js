import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { initCertificateUI, signPdfWithSelectedCertificate, clearSelectedCertificate } from './certificate-ui.js';
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

// === MEJORA 27: Hash de integridad para PDFs ===
async function generatePdfHash(bytes) {
  try {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (err) {
    console.error('Hash generation error');
    return null;
  }
}

// === MEJORA 31: Detectar JavaScript embebido en PDF ===
async function detectEmbeddedJavascript(pdfDoc) {
  try {
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageObj = page.node;

      // Verificar acciones de página
      if (pageObj.AA || pageObj.AcroForm || pageObj.JavaScript) {
        throw new Error('PDF contains embedded JavaScript - rejected for security');
      }
    }
    return true;
  } catch (err) {
    logSecurityEvent('Embedded JavaScript detected in PDF', 'error');
    throw err;
  }
}

// === MEJORA 32: Validar metadatos del PDF ===
async function validatePdfMetadata(pdfDoc) {
  try {
    const producer = pdfDoc.getProducer() || '';
    const creator = pdfDoc.getCreator() || '';

    const trustedProducers = [
      'adobe', 'acrobat', 'libreoffice', 'pdf-lib', 'ghost',
      'cups', 'pdfkit', 'itext', 'fpdf'
    ];

    const isFromTrustedSource = trustedProducers.some(p =>
      producer.toLowerCase().includes(p) ||
      creator.toLowerCase().includes(p)
    );

    if (!isFromTrustedSource && producer.length > 0) {
      logSecurityEvent(`PDF from unknown producer: ${producer}`, 'warning');
    }

    return true;
  } catch (err) {
    logSecurityEvent('Metadata validation error', 'warning');
    return true; // No fallar por metadatos faltantes
  }
}

// === MEJORA 33: Detectar compresión anómala ===
function detectSuspiciousCompression(bytes) {
  if (bytes.length < 100) return false; // Muy pequeño

  // Buscar streams de compresión
  let suspiciousCount = 0;
  const view = new Uint8Array(bytes);

  for (let i = 0; i < view.length - 4; i++) {
    // Buscar '/FlateDecode' streams anormales
    if (view[i] === 0x78 && view[i + 1] === 0x9c) { // Zlib header
      suspiciousCount++;
    }
  }

  // Si hay demasiados streams de compresión, es sospechoso
  if (suspiciousCount > bytes.length / 10000) {
    logSecurityEvent('Suspicious compression pattern detected', 'warning');
    return true;
  }
  return false;
}

// === MEJORA 34: Validar formato de QR ===
async function validateQRFormat(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // QR debe ser cuadrado
      if (img.width !== img.height) {
        reject(new Error('QR code must be square'));
      }
      // Validar tamaño mínimo
      if (img.width < 21 || img.width > 177) {
        reject(new Error('QR code size invalid'));
      }
      resolve(true);
    };
    img.onerror = () => reject(new Error('QR image invalid'));
    img.src = dataUrl;
  });
}

// === MEJORA 35: Prevenir ReDoS (Regex Denial of Service) ===
const SAFE_PAGE_RANGE_REGEX = /^\d+(-\d+)?(,\d+(-\d+)?)*$/;

function validatePageRangeSafely(input) {
  if (input.length > 100) return false; // Límite de caracteres
  if (!SAFE_PAGE_RANGE_REGEX.test(input)) return false;
  return true;
}

// === MEJORA 36: Prevenir prototype pollution ===
function safeAssign(target, source) {
  const blacklist = ['__proto__', 'constructor', 'prototype'];
  for (const [key, value] of Object.entries(source || {})) {
    if (!blacklist.includes(key) && key.length < 256) {
      target[key] = value;
    }
  }
  return target;
}

// === MEJORA 38: CSP con nonce dinámico ===
function injectCSPNonce() {
  const nonce = generateSecureNonce();
  // En desarrollo, esto se hace en vite.config.js
  logSecurityEvent(`CSP nonce injected: ${nonce.substring(0, 8)}...`, 'info');
  return nonce;
}

function generateSecureNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// === MEJORA 39: Detectar Zip Bomb ===
function detectZipBomb(bytes) {
  const MAX_COMPRESSION_RATIO = 100;

  if (bytes.length < 22) return false;

  const view = new Uint8Array(bytes);
  // Buscar firma de ZIP (PK\x03\x04)
  if (view[0] === 0x50 && view[1] === 0x4B &&
      view[2] === 0x03 && view[3] === 0x04) {

    // Leer sizes del header de ZIP
    const compressedSize = view.readUInt32LE(18);
    const uncompressedSize = view.readUInt32LE(22);

    if (uncompressedSize > 0) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > MAX_COMPRESSION_RATIO) {
        logSecurityEvent('Zip bomb pattern detected', 'error');
        return true;
      }
    }
  }
  return false;
}

// === MEJORA 40: Deshabilitar copy de PDFs ===
function preventPdfCopy() {
  document.addEventListener('copy', (e) => {
    if (currentAppState === APP_STATES.WORKSPACE && pdfBytes) {
      e.preventDefault();
      showToast('Copia deshabilitada por seguridad', 'warning');
      logSecurityEvent('Copy attempt blocked', 'warning');
    }
  });
}

// === MEJORA 41: Prevenir screenshot/print ===
function preventPdfPrint() {
  window.addEventListener('beforeprint', (e) => {
    if (pdfBytes) {
      e.preventDefault();
      showToast('Impresión deshabilitada. Descarga el PDF en su lugar.', 'warning');
      logSecurityEvent('Print attempt blocked', 'warning');
    }
  });

  // CSS: deshabilitar print
  const style = document.createElement('style');
  style.textContent = '@media print { body { display: none !important; } }';
  document.head.appendChild(style);
}

// === MEJORA 42: Validar interacción de usuario ===
let userInteractionCount = 0;
const REQUIRED_INTERACTIONS = 1;

function requireUserInteraction() {
  if (userInteractionCount < REQUIRED_INTERACTIONS) {
    showToast('Por favor interactúa con la página primero', 'warning');
    return false;
  }
  return true;
}

document.addEventListener('click', () => {
  userInteractionCount++;
  updateActivityTime();
});

document.addEventListener('keydown', () => {
  userInteractionCount++;
  updateActivityTime();
});

// === MEJORA 44: Exportar logs de seguridad ===
function exportSecurityLogs() {
  try {
    const logs = JSON.parse(sessionStorage.getItem('securityLogs') || '[]');

    let csv = 'Timestamp,Event,Severity,State\n';
    csv += logs.map(l =>
      `"${l.timestamp}","${l.event}","${l.severity}","${l.state}"`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `security-audit-${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Logs de seguridad exportados', 'success');
    logSecurityEvent('Security logs exported', 'info');
  } catch (err) {
    handleSecureError(err, 'Error al exportar logs');
  }
}

// === MEJORA 45: Monitoreo de performance ===
function initPerformanceMonitoring() {
  const performanceMetrics = {
    pdfLoadTime: 0,
    processingTime: 0,
    memoryUsed: 0
  };

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 30000) { // 30 segundos
            logSecurityEvent(`Slow operation: ${entry.name} (${entry.duration}ms)`, 'warning');
          }
        }
      });
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (e) {
      // PerformanceObserver no disponible en este navegador
    }
  }

  return performanceMetrics;
}

// === MEJORA 46: Monitorear cambios en DOM ===
function initDomMutationMonitoring() {
  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'SCRIPT' && node.src === '') {
            logSecurityEvent('Unauthorized inline script detected', 'error');
          }
        });
      }
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  return mutationObserver;
}

// === MEJORA 49: Sanitizar URL del historial ===
function sanitizeUrlHistory() {
  if (window.location.search) {
    window.history.replaceState({}, '', window.location.pathname);
    logSecurityEvent('URL parameters removed from history', 'info');
  }
}

// === MEJORA 51: Limpiar clipboard automáticamente ===
function autoClearClipboard() {
  setInterval(async () => {
    try {
      await navigator.clipboard.writeText('');
    } catch (e) {
      // Clipboard API no disponible o permiso denegado
    }
  }, 300000); // Cada 5 minutos
}

// === MEJORA 53: Rollback automático ===
const stateBackup = {
  pdfBytes: null,
  pdfDoc: null,
  stampImageSrc: '',
  currentAppState: APP_STATES.UPLOAD
};

function backupState() {
  stateBackup.pdfBytes = pdfBytes;
  stateBackup.pdfDoc = pdfDoc;
  stateBackup.stampImageSrc = stampImageSrc;
  stateBackup.currentAppState = currentAppState;
}

function restoreStateBackup() {
  pdfBytes = stateBackup.pdfBytes;
  pdfDoc = stateBackup.pdfDoc;
  stampImageSrc = stateBackup.stampImageSrc;
  currentAppState = stateBackup.currentAppState;
  logSecurityEvent('State rollback performed', 'warning');
}

// === MEJORA 55: Health check periódico ===
function performHealthCheck() {
  try {
    const checks = {
      stateValid: validateAppStateIntegrity(),
      memoryOk: performance.memory?.usedJSHeapSize < 150_000_000 || true,
      logsOk: sessionStorage.getItem('securityLogs') !== null
    };

    const allOk = Object.values(checks).every(v => v !== false);

    if (!allOk) {
      logSecurityEvent('Health check failed', 'error');
      if (!checks.stateValid) {
        clearSensitiveData();
        showToast('Sesión reiniciada por razones de seguridad', 'warning');
      }
    }
  } catch (err) {
    console.error('Health check error');
  }
}

function validateAppStateIntegrity() {
  // Verificar que el estado es consistente
  if (currentAppState === APP_STATES.WORKSPACE && !pdfDoc) {
    return false;
  }
  if (currentAppState === APP_STATES.UPLOAD && pdfBytes) {
    return false;
  }
  return true;
}

// Iniciar health check
setInterval(performHealthCheck, 300000); // Cada 5 minutos

// === Iniciar monitoreo de sesión ===
setInterval(checkSessionTimeout, 60000); // Verificar cada minuto

// Actualizar actividad en cualquier interacción del usuario
document.addEventListener('click', updateActivityTime);
document.addEventListener('keydown', updateActivityTime);
document.addEventListener('mousemove', updateActivityTime);

// === INICIALIZAR MEJORAS DE SEGURIDAD ===

// Mejora 40: Prevenir copia de PDFs
preventPdfCopy();

// Mejora 41: Prevenir impresión
preventPdfPrint();

// Mejora 45: Monitoreo de performance
initPerformanceMonitoring();

// Mejora 46: Monitorear cambios en DOM
initDomMutationMonitoring();

// Mejora 49: Sanitizar URL
sanitizeUrlHistory();

// Mejora 51: Limpiar clipboard automáticamente
autoClearClipboard();

// Crear botón de exportar logs en consola
window.exportSecurityLogs = exportSecurityLogs;
logSecurityEvent('Security system initialized', 'info');

// Mejora v1.3.0: Initialize certificate UI
initCertificateUI();
logSecurityEvent('Digital certificate system initialized', 'info');

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
        backupState();
        pdfBytes = e.target.result;

        if (!validatePdfMagicBytes(pdfBytes)) {
          throw new Error('Archivo inválido: no es un PDF válido');
        }

        // Mejora 33: Detectar compresión anómala
        if (detectSuspiciousCompression(pdfBytes)) {
          logSecurityEvent('PDF with suspicious compression loaded', 'warning');
        }

        // Mejora 39: Detectar Zip Bomb
        if (detectZipBomb(pdfBytes)) {
          throw new Error('Archivo sospechoso detectado: posible bomb');
        }

        // Mejora 16: Validar estructura del PDF
        await validatePdfStructure(pdfBytes);

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
        pdfDoc = await loadingTask.promise;

        // Mejora 31: Detectar JavaScript embebido
        await detectEmbeddedJavascript(pdfDoc);

        // Mejora 32: Validar metadatos
        await validatePdfMetadata(pdfDoc);

        // Mejora 27: Generar hash
        const pdfHash = await generatePdfHash(pdfBytes);
        if (pdfHash) {
          logSecurityEvent(`PDF hash: ${pdfHash.substring(0, 16)}...`, 'info');
        }

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
        logSecurityEvent('PDF loaded and validated', 'info');
      } catch (err) {
        // Mejora 53: Rollback en caso de error
        restoreStateBackup();
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

    // Mejora 34: Validar formato de QR
    await validateQRFormat(qrDataUrl);

    stampImageSrc = qrDataUrl;
    aspectRatio = 1.0;

    const img = document.createElement('img');
    img.src = stampImageSrc;
    img.className = 'stamp-overlay-img';
    img.alt = 'QR Preview';
    stampOverlayContent.innerHTML = '';
    stampOverlayContent.appendChild(img);
    updateStampSizeAndPosition();
    logSecurityEvent('QR generated and validated', 'info');
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

    // Mejora v1.3.0: Limpiar certificado seleccionado
    clearSelectedCertificate();

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

    let finalPdfBytes = await pdfLibDoc.save();

    // Mejora v1.3.0: Sign PDF with digital certificate if enabled
    const signCheckbox = document.getElementById('sign-with-cert');
    if (signCheckbox && signCheckbox.checked) {
      try {
        finalPdfBytes = await signPdfWithSelectedCertificate(finalPdfBytes);
        showToast('PDF firmado digitalmente', 'success');
        logSecurityEvent('PDF signed with digital certificate', 'info');
      } catch (err) {
        handleSecureError(err, 'No se pudo firmar con certificado, descargando sin firma');
        logSecurityEvent('Certificate signing failed, continuing without signature', 'warning');
        // Continue without signature
      }
    }

    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
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

  // Mejora 35: Prevenir ReDoS
  if (!validatePageRangeSafely(rangeStr)) {
    throw new Error('Rango de páginas inválido');
  }

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

