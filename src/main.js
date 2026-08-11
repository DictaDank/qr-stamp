import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import './style.css';

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
const canvasWrapper = document.getElementById('canvas-wrapper');
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

// Initialize QR code on load
initDefaultQR();

// --- Initialization ---

async function initDefaultQR() {
  try {
    const defaultText = qrTextInput.value || 'https://example.com';
    const qrDataUrl = await QRCode.toDataURL(defaultText, {
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    stampImageSrc = qrDataUrl;
    aspectRatio = 1.0;
    
    // Set preview
    stampOverlayContent.innerHTML = `<img src="${stampImageSrc}" class="stamp-overlay-img" alt="Sello Preview" />`;
  } catch (err) {
    console.error('Error generating default QR:', err);
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
  pdfFileName = file.name;
  pdfMetaName.textContent = file.name;
  
  showToast('Cargando PDF...', 'success');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      pdfBytes = e.target.result;
      
      // Load with PDF.js for preview
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      
      // Show workspace, hide upload
      stepUpload.classList.add('hidden');
      stepWorkspace.classList.remove('hidden');
      
      // Render first page
      await renderPreviewPage(currentPage);
      
      // Apply default bottom-right layout
      applyPreset('bottom-right');
      
      showToast('Documento cargado correctamente.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al procesar el archivo PDF.', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
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
  
  stampUploadLabel.textContent = file.name;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      aspectRatio = img.naturalWidth / img.naturalHeight;
      stampImageSrc = event.target.result;
      stampOverlayContent.innerHTML = `<img src="${stampImageSrc}" class="stamp-overlay-img" alt="Sello Imagen" />`;
      updateStampSizeAndPosition();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
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
    const qrDataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    stampImageSrc = qrDataUrl;
    aspectRatio = 1.0;
    stampOverlayContent.innerHTML = `<img src="${stampImageSrc}" class="stamp-overlay-img" alt="QR Preview" />`;
    updateStampSizeAndPosition();
  } catch (err) {
    console.error('Error generating QR:', err);
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
  btn.addEventListener('click', (e) => {
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
  // Clear file inputs & state
  pdfBytes = null;
  pdfDoc = null;
  pdfFileName = '';
  pdfFileInput.value = '';
  stampImageInput.value = '';
  stampUploadLabel.textContent = 'Seleccionar imagen (PNG, JPG)';
  
  // Hide workspace, show upload
  stepWorkspace.classList.add('hidden');
  stepUpload.classList.remove('hidden');
});

// --- PDF Stamping Core (pdf-lib) ---

processBtn.addEventListener('click', async () => {
  if (!pdfBytes) return;
  
  if (stampType === 'image' && !stampImageSrc.startsWith('data:image')) {
    showToast('Sube una imagen de firma o selecciona Código QR primero.', 'error');
    return;
  }
  
  // Set processing state
  processBtn.disabled = true;
  processSpinner.classList.remove('hidden');
  processBtnText.textContent = 'Procesando...';
  
  try {
    // 1. Get page indices to stamp
    const pageIndices = parseTargetPages();
    if (pageIndices.length === 0) {
      showToast('Las páginas especificadas no corresponden al PDF cargado.', 'error');
      processBtn.disabled = false;
      processSpinner.classList.add('hidden');
      processBtnText.textContent = 'Generar y Descargar';
      return;
    }
    
    // 2. Load PDF into pdf-lib
    const pdfLibDoc = await PDFDocument.load(pdfBytes);
    
    // 3. Embed image
    let embeddedImg;
    if (stampImageSrc.startsWith('data:image/png;base64,')) {
      embeddedImg = await pdfLibDoc.embedPng(stampImageSrc);
    } else if (stampImageSrc.startsWith('data:image/jpeg;base64,') || stampImageSrc.startsWith('data:image/jpg;base64,')) {
      embeddedImg = await pdfLibDoc.embedJpg(stampImageSrc);
    } else {
      // Fallback for custom QR codes or formats (QR Code library generates PNG base64 URL)
      embeddedImg = await pdfLibDoc.embedPng(stampImageSrc);
    }
    
    const scaleFactor = parseInt(stampScaleSlider.value, 10) / 100;
    const opacityFactor = parseInt(stampOpacitySlider.value, 10) / 100;
    
    // 4. Draw on each target page
    const libPages = pdfLibDoc.getPages();
    
    for (const pageIdx of pageIndices) {
      const page = libPages[pageIdx];
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      // Calculate stamp size in actual PDF points
      // In preview, 100% scale maps to a 120px base width
      // Scale is proportioned relative to the canvas size
      const canvasWidth = pdfPreviewCanvas.width;
      const canvasHeight = pdfPreviewCanvas.height;
      
      const stampWidthInCanvas = 120 * scaleFactor;
      const stampHeightInCanvas = stampWidthInCanvas / aspectRatio;
      
      const pdfStampWidth = (stampWidthInCanvas / canvasWidth) * pageWidth;
      const pdfStampHeight = (stampHeightInCanvas / canvasHeight) * pageHeight;
      
      // Calculate coordinates in PDF points (Origin is bottom-left)
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
    
    // 5. Save and trigger download
    const modifiedPdfBytes = await pdfLibDoc.save();
    
    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    const dotIdx = pdfFileName.lastIndexOf('.');
    const nameWithoutExt = dotIdx !== -1 ? pdfFileName.substring(0, dotIdx) : pdfFileName;
    const filename = `${nameWithoutExt}_sellado.pdf`;
    
    // Attempt modern File System Access API first for desktop security/sandbox support
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
        return;
      } catch (err) {
        // If user cancelled, abort download flow
        if (err.name === 'AbortError') {
          showToast('Guardado cancelado.', 'error');
          return;
        }
        console.warn('showSaveFilePicker error, falling back to anchor download:', err);
      }
    }
    
    // Fallback: standard anchor tag download
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    showToast('PDF generado y descargado con éxito.', 'success');
  } catch (err) {
    console.error('Error stamping PDF:', err);
    showToast('Hubo un error al estampar el PDF.', 'error');
  } finally {
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
  
  // Custom parsing
  const rangeStr = stampPagesInput.value.trim();
  if (!rangeStr) return [0]; // default to first page
  
  const pages = new Set();
  const parts = rangeStr.split(',');
  
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          pages.add(i - 1);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p - 1);
      }
    }
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

// --- Local testing hook: auto-load sample PDF if ?test=true is in URL ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('test')) {
  fetch('/sample.pdf')
    .then(res => {
      if (!res.ok) throw new Error('No se pudo descargar el PDF de muestra.');
      return res.arrayBuffer();
    })
    .then(buffer => {
      pdfBytes = buffer;
      pdfFileName = 'sample.pdf';
      pdfMetaName.textContent = pdfFileName;
      return pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
    })
    .then(doc => {
      pdfDoc = doc;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      
      stepUpload.classList.add('hidden');
      stepWorkspace.classList.remove('hidden');
      
      renderPreviewPage(1);
      applyPreset('bottom-right');
      showToast('PDF de prueba cargado automáticamente.', 'success');
    })
    .catch(err => {
      console.error('Error loading test PDF:', err);
      showToast('Error al auto-cargar el PDF de prueba.', 'error');
    });
}

