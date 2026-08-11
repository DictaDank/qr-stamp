/**
 * Certificate UI Management
 */

import {
  loadCertificateFromFile,
  extractCertificateInfo,
  validateCertificate
} from './security/certificates.js';

import { signPdfWithCertificate } from './security/digital-signature.js';

let selectedCertificate = null;
let certificatePrivateKey = null;

/**
 * Initialize certificate UI
 */
export function initCertificateUI() {
  const selectBtn = document.getElementById('select-certificate-btn');
  const signCheckbox = document.getElementById('sign-with-cert');

  if (selectBtn) {
    selectBtn.addEventListener('click', handleSelectCertificate);
  }

  if (signCheckbox) {
    signCheckbox.addEventListener('change', (e) => {
      if (e.target.checked && !selectedCertificate) {
        e.target.checked = false;
        showToast('Primero carga un certificado', 'warning');
      }
    });
  }
}

/**
 * Handle certificate selection
 */
async function handleSelectCertificate() {
  try {
    updateActivityTime();

    // Show options dialog
    const option = await showCertificateOptions();

    if (!option) {
      return;
    }

    let cert = null;
    let privKey = null;

    if (option === 'upload') {
      const result = await uploadCertificateFile();
      cert = result.certificate;
      privKey = result.privateKey;
    } else if (option === 'browser') {
      showToast('Certificados del navegador aún no disponible', 'info');
      return;
    } else if (option === 'dni') {
      showToast('Lectura de DNI electrónico en v2.0', 'info');
      return;
    }

    if (!cert) {
      return;
    }

    // Validate certificate
    try {
      await validateCertificate(cert);
    } catch (err) {
      showToast(`Certificado no válido: ${err.message}`, 'error');
      logSecurityEvent(`Certificate validation failed: ${err.message}`, 'error');
      return;
    }

    // Store certificate
    selectedCertificate = cert;
    certificatePrivateKey = privKey;

    // Display info
    displayCertificateInfo(cert);

    showToast('Certificado digital cargado correctamente', 'success');
    logSecurityEvent('Digital certificate loaded successfully', 'info');
  } catch (err) {
    handleSecureError(err, 'Error al cargar certificado');
  }
}

/**
 * Show certificate options modal
 */
async function showCertificateOptions() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    `;

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 2rem;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;

    content.innerHTML = `
      <h3 style="font-size: 1.25rem; margin-bottom: 1.5rem; color: var(--text-main);">
        Seleccionar Certificado Digital
      </h3>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button class="btn btn-secondary cert-option-btn" data-option="upload" style="width: 100%;">
          📁 Subir Archivo (.p12, .pfx)
        </button>
        <button class="btn btn-secondary cert-option-btn" data-option="browser" style="width: 100%;" disabled>
          🔐 Certificado del Navegador (v1.4.0)
        </button>
        <button class="btn btn-secondary cert-option-btn" data-option="dni" style="width: 100%;" disabled>
          🎫 Leer del DNI Electrónico (v2.0)
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="width: 100%;">
          ❌ Cancelar
        </button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add event listeners
    content.querySelectorAll('.cert-option-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.remove();
        resolve(btn.dataset.option);
      });
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    });
  });
}

/**
 * Upload certificate file
 */
async function uploadCertificateFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.p12,.pfx,.pem,.cer';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const certData = await loadCertificateFromFile(file);

        // Ask for password if needed
        let password = '';
        if (file.name.endsWith('.p12') || file.name.endsWith('.pfx')) {
          password = await requestPassword();
        }

        // Parse PKCS#12
        let certificate = null;
        let privateKey = null;

        if (file.name.endsWith('.p12') || file.name.endsWith('.pfx')) {
          try {
            const p12 = forge.pkcs12.asn1.fromDer(certData);
            const bags = forge.pkcs12.getBags(p12, { password });

            // Extract certificate
            if (bags.certBags) {
              const certBag = bags.certBags[0];
              certificate = certBag.cert;
            }

            // Extract private key
            if (bags.keyBags) {
              const keyBag = bags.keyBags[0];
              privateKey = keyBag.key;
            }
          } catch (err) {
            throw new Error('Invalid PKCS#12 file or wrong password');
          }
        } else {
          certificate = certData;
        }

        resolve({ certificate, privateKey });
      } catch (err) {
        reject(err);
      }
    });

    input.click();
  });
}

/**
 * Request password for encrypted certificate
 */
async function requestPassword() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 2rem;
      max-width: 350px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;

    content.innerHTML = `
      <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: var(--text-main);">
        Contraseña del Certificado
      </h3>
      <input type="password" id="cert-password-input" class="text-input"
             placeholder="Ingresa la contraseña" style="width: 100%; margin-bottom: 1rem;" />
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary" style="flex: 1;" id="cert-password-ok">OK</button>
        <button class="btn btn-secondary" style="flex: 1;" id="cert-password-cancel">Cancelar</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    const input = content.querySelector('#cert-password-input');
    const okBtn = content.querySelector('#cert-password-ok');
    const cancelBtn = content.querySelector('#cert-password-cancel');

    okBtn.addEventListener('click', () => {
      modal.remove();
      resolve(input.value);
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve('');
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        okBtn.click();
      }
    });

    input.focus();
  });
}

/**
 * Display certificate information
 */
function displayCertificateInfo(cert) {
  try {
    const info = extractCertificateInfo(cert);

    const certInfo = document.getElementById('certificate-info');
    const statusBadge = document.querySelector('.status-badge');
    const passwordGroup = document.getElementById('password-group');
    const signCheckbox = document.getElementById('sign-with-cert');

    if (certInfo) {
      document.getElementById('cert-subject').textContent = info.subject;
      document.getElementById('cert-issuer').textContent = info.issuer;
      document.getElementById('cert-expiry').textContent =
        info.validTo.toLocaleDateString('es-ES');
      document.getElementById('cert-type').textContent = info.type;

      certInfo.classList.remove('hidden');
    }

    if (statusBadge) {
      const cn = info.subject.split(',')[0].trim();
      statusBadge.textContent = cn;
      statusBadge.className = 'status-badge valid';
    }

    if (passwordGroup) {
      passwordGroup.style.display = 'none';
    }

    if (signCheckbox) {
      signCheckbox.disabled = false;
    }
  } catch (err) {
    handleSecureError(err, 'Error al mostrar información del certificado');
  }
}

/**
 * Sign PDF with selected certificate
 */
export async function signPdfWithSelectedCertificate(pdfBytes, password = '') {
  if (!selectedCertificate) {
    throw new Error('No certificate selected');
  }

  try {
    updateActivityTime();
    trackAction('pdf');

    const password_val = password ||
      (await new Promise(r => setTimeout(() => r(''), 100)));

    const signedPdf = await signPdfWithCertificate(
      pdfBytes,
      selectedCertificate,
      certificatePrivateKey,
      password_val
    );

    return signedPdf;
  } catch (err) {
    handleSecureError(err, 'Error al firmar PDF');
    throw err;
  }
}

/**
 * Clear selected certificate
 */
export function clearSelectedCertificate() {
  selectedCertificate = null;
  certificatePrivateKey = null;

  const certInfo = document.getElementById('certificate-info');
  const statusBadge = document.querySelector('.status-badge');
  const signCheckbox = document.getElementById('sign-with-cert');

  if (certInfo) {
    certInfo.classList.add('hidden');
  }

  if (statusBadge) {
    statusBadge.textContent = 'Sin certificado';
    statusBadge.className = 'status-badge';
  }

  if (signCheckbox) {
    signCheckbox.checked = false;
    signCheckbox.disabled = true;
  }
}

// Import forge for certificate handling
import forge from 'node-forge';
