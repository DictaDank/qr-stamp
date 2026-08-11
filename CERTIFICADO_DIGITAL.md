# 🔐 Integración de Certificado Digital Español

## Opciones Disponibles

### Opción 1: **Certificado Digital para Firma de PDFs** ⭐ (RECOMENDADO)
- Firmar PDFs con certificados españoles (FNMT, DNIe)
- Agregar timestamp de autoridad certificadora
- Validar no-repudio
- **Dificultad:** Media
- **Tiempo:** 2-3 semanas
- **Costo:** Gratis (open source)

### Opción 2: **Validación de Certificados de Usuario**
- Validar que el usuario tiene certificado válido
- Leer datos del certificado
- Vincular operaciones al certificado
- **Dificultad:** Alta
- **Tiempo:** 3-4 semanas
- **Costo:** Servidor necesario

### Opción 3: **Firma de PDFs con DNIe**
- Integrar lector de DNI electrónico
- Firmar directamente con chip del DNI
- Máxima seguridad
- **Dificultad:** Muy Alta
- **Tiempo:** 4-6 semanas
- **Costo:** Librería especializada ($)

---

## 🏆 Propuesta: Opción 1 + Opción 2 Integradas

### Arquitectura

```
QR-Stamp (Client-Side)
    ↓
Certificado Digital UI
    ↓
Genera firma digital (PKCS#7)
    ↓
Incrusta en PDF
    ↓
Valida contra FNMT OCList
    ↓
Descarga PDF firmado
```

---

## 📋 Implementación Paso a Paso

### **Paso 1: Detectar Certificados en el Navegador**

```javascript
// src/security/certificates.js

async function getCertificatesFromBrowser() {
  try {
    // WebAuthn / FIDO2 detection
    if (!window.PublicKeyCredential) {
      throw new Error('Web Authentication API not supported');
    }

    // Intentar obtener certificados del navegador
    const certs = await navigator.credentials.get({
      signal: AbortSignal.timeout(30000)
    });

    return certs;
  } catch (err) {
    console.error('No certificates found');
    return null;
  }
}

// Alternativa: Solicitar acceso manual
async function requestCertificateUpload() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.p12,.pfx,.pem,.cer';
    input.onchange = (e) => {
      const file = e.target.files[0];
      resolve(file);
    };
    input.click();
  });
}
```

---

### **Paso 2: Validar Certificado contra FNMT**

```javascript
// src/security/fnmt-validation.js

// Lista de revocación de FNMT (descargable)
// https://www.sede.fnmt.gob.es/descargas/crl/

const FNMT_CRL_URL = 'https://www.sede.fnmt.gob.es/descargas/crl/';

async function validateCertificateAgainstFNMT(certificate) {
  try {
    // Extraer serial del certificado
    const serial = certificate.getSerialNumber();

    // Descargar CRL (Certificate Revocation List) de FNMT
    const crl = await downloadFNMTCRL();

    // Verificar si está en la lista de revocación
    if (isCertificateRevoked(serial, crl)) {
      throw new Error('Certificado revocado por FNMT');
    }

    // Validar dates
    if (!validateCertificateDates(certificate)) {
      throw new Error('Certificado expirado o no válido aún');
    }

    // Validar cadena de confianza
    const isValid = await validateCertificateChain(certificate, FNMT_ROOTS);

    if (!isValid) {
      throw new Error('Cadena de confianza inválida');
    }

    logSecurityEvent('Certificate validated against FNMT', 'info');
    return true;
  } catch (err) {
    logSecurityEvent(`Certificate validation failed: ${err.message}`, 'error');
    throw err;
  }
}

function validateCertificateDates(cert) {
  const now = new Date();
  const notBefore = cert.getNotBefore();
  const notAfter = cert.getNotAfter();

  return now >= notBefore && now <= notAfter;
}
```

---

### **Paso 3: Crear Firma Digital (PKCS#7/XAdES)**

```javascript
// src/security/digital-signature.js

/**
 * Firma un PDF con certificado digital español
 * Utiliza XAdES (XML Advanced Electronic Signatures) estándar
 */
async function signPdfWithCertificate(pdfBytes, certificate, password = '') {
  try {
    // 1. Cargar librería de firma
    const signatureLib = await import('pkcs7-signature'); // o similar

    // 2. Extraer private key del certificado
    const privateKey = extractPrivateKey(certificate, password);

    // 3. Generar hash del PDF
    const pdfHash = await crypto.subtle.digest('SHA-256', pdfBytes);

    // 4. Crear firma digital
    const signature = await signatureLib.sign(pdfHash, privateKey);

    // 5. Obtener timestamp de autoridad certificadora
    const timestamp = await getTimestampFromTSA();

    // 6. Construir estructura PKCS#7/XAdES
    const signedData = {
      pdf: pdfBytes,
      signature: signature,
      certificate: certificate,
      timestamp: timestamp,
      signatureAlgorithm: 'SHA-256-RSA',
      metadata: {
        signedBy: certificate.getSubject(),
        signedAt: new Date().toISOString(),
        organization: certificate.getOrganization(),
        country: certificate.getCountry()
      }
    };

    // 7. Incrustrar firma en PDF
    const signedPdf = await embedSignatureInPDF(pdfBytes, signedData);

    logSecurityEvent('PDF signed with digital certificate', 'info');
    return signedPdf;
  } catch (err) {
    handleSecureError(err, 'Error al firmar con certificado digital');
    throw err;
  }
}

// Obtener timestamp de autoridad certificadora española
async function getTimestampFromTSA() {
  const TSA_URL = 'https://www.sede.fnmt.gob.es/tsa/'; // TSA de FNMT

  try {
    const response = await fetch(TSA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query'
      },
      body: generateTimeStampRequest()
    });

    if (!response.ok) {
      throw new Error('TSA error');
    }

    const timestamp = await response.arrayBuffer();
    return new Uint8Array(timestamp);
  } catch (err) {
    console.error('TSA error, continuing without timestamp');
    return null;
  }
}
```

---

### **Paso 4: UI para Certificado Digital**

```html
<!-- Agregar a index.html en step-workspace -->

<div id="certificate-panel" class="glass-panel hidden">
  <div class="section-title">
    <svg><!-- Ícono de certificado --></svg>
    <span>Firma Digital</span>
  </div>

  <div id="certificate-status" class="certificate-status">
    <span class="status-badge">Sin certificado</span>
  </div>

  <!-- Seleccionar certificado -->
  <div class="form-group">
    <label class="form-label">Certificado Digital</label>
    <button id="select-certificate-btn" class="btn btn-secondary" style="width: 100%;">
      Seleccionar Certificado
    </button>
  </div>

  <!-- Mostrar certificado seleccionado -->
  <div id="certificate-info" class="certificate-info hidden">
    <div class="cert-field">
      <span class="label">Titular:</span>
      <span id="cert-subject" class="value"></span>
    </div>
    <div class="cert-field">
      <span class="label">Emisor:</span>
      <span id="cert-issuer" class="value"></span>
    </div>
    <div class="cert-field">
      <span class="label">Válido hasta:</span>
      <span id="cert-expiry" class="value"></span>
    </div>
    <div class="cert-field">
      <span class="label">Tipo:</span>
      <span id="cert-type" class="value"></span>
    </div>
  </div>

  <!-- Contraseña del certificado -->
  <div class="form-group" id="password-group" style="display: none;">
    <label class="form-label">Contraseña del Certificado</label>
    <input type="password" id="cert-password" class="text-input" 
           placeholder="Contraseña para acceder a la clave privada" />
  </div>

  <!-- Checkbox para firmar -->
  <div class="form-group">
    <label>
      <input type="checkbox" id="sign-with-cert" />
      Firmar PDF con certificado digital
    </label>
    <p class="small-text">La firma será válida legalmente en España</p>
  </div>
</div>
```

---

### **Paso 5: JavaScript del Panel**

```javascript
// src/certificate-ui.js

let selectedCertificate = null;

document.getElementById('select-certificate-btn').addEventListener('click', async () => {
  try {
    updateActivityTime();

    // Mostrar opciones
    const option = await showCertificateOptions();

    if (option === 'browser') {
      selectedCertificate = await getCertificatesFromBrowser();
    } else if (option === 'upload') {
      const file = await requestCertificateUpload();
      selectedCertificate = await loadCertificateFromFile(file);
    } else if (option === 'dni') {
      selectedCertificate = await readFromDNIeReader();
    }

    if (selectedCertificate) {
      // Validar certificado
      await validateCertificateAgainstFNMT(selectedCertificate);

      // Mostrar información
      displayCertificateInfo(selectedCertificate);

      // Habilitar firma
      document.getElementById('sign-with-cert').disabled = false;

      showToast('Certificado digital cargado correctamente', 'success');
      logSecurityEvent('Digital certificate loaded', 'info');
    }
  } catch (err) {
    handleSecureError(err, 'Error al cargar certificado');
  }
});

function displayCertificateInfo(cert) {
  const certInfo = document.getElementById('certificate-info');
  const statusBadge = document.querySelector('.status-badge');

  document.getElementById('cert-subject').textContent = cert.getSubject();
  document.getElementById('cert-issuer').textContent = cert.getIssuer();
  document.getElementById('cert-expiry').textContent = 
    new Date(cert.getNotAfter()).toLocaleDateString('es-ES');
  document.getElementById('cert-type').textContent = cert.getKeyUsage().join(', ');

  statusBadge.textContent = cert.getSubject().split(',')[0].trim();
  statusBadge.className = 'status-badge valid';

  certInfo.classList.remove('hidden');

  // Mostrar campo de contraseña si es necesario
  if (cert.isEncrypted()) {
    document.getElementById('password-group').style.display = 'block';
  }
}

async function showCertificateOptions() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Seleccionar Certificado Digital</h3>
        <button class="btn btn-secondary" onclick="this.closest('.modal').resolve('browser')">
          Certificado del Navegador
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').resolve('upload')">
          Subir Archivo (.p12, .pfx)
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').resolve('dni')">
          Leer del DNI Electrónico
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').resolve(null)">
          Cancelar
        </button>
      </div>
    `;

    modal.resolve = (value) => {
      modal.remove();
      resolve(value);
    };

    document.body.appendChild(modal);
  });
}
```

---

### **Paso 6: Integrar con Process Button**

```javascript
// Modificar processBtn event listener

processBtn.addEventListener('click', async () => {
  try {
    updateActivityTime();
    trackAction('pdf');

    // ... validaciones existentes ...

    // Nueva: Verificar si se debe firmar
    const shouldSign = document.getElementById('sign-with-cert')?.checked;

    if (shouldSign && selectedCertificate) {
      const password = document.getElementById('cert-password')?.value;

      modifiedPdfBytes = await signPdfWithCertificate(
        modifiedPdfBytes,
        selectedCertificate,
        password
      );

      logSecurityEvent('PDF digitally signed', 'info');
    }

    // ... resto del código ...
  } catch (err) {
    handleSecureError(err, 'Error al procesar PDF');
  }
});
```

---

## 🔧 Dependencias Necesarias

```json
{
  "node-forge": "^1.3.0",
  "jsrsasign": "^10.5.25",
  "pkijs": "^2.2.11",
  "asn1js": "^3.0.5"
}
```

Instalar:
```bash
npm install --save node-forge jsrsasign pkijs asn1js
```

---

## 📊 Tabla Comparativa

| Aspecto | Opción 1 (Firma) | Opción 2 (Validar Usuario) | Opción 3 (DNIe) |
|--------|------------------|--------------------------|-----------------|
| Implementación | Media | Alta | Muy Alta |
| Seguridad | Alta | Muy Alta | Máxima |
| Experiencia UX | Buena | Excelente | Perfecta |
| Costo | Gratis | Gratis | $500-2000 |
| Servidor necesario | No | Sí | Sí |
| Tiempo | 2-3 sem | 3-4 sem | 4-6 sem |
| Validez legal | ✅ Sí | ✅ Sí | ✅ Sí |

---

## ✅ Beneficios con Certificado Digital

```
ANTES:
PDF sin firmar
    ↓
Cualquiera puede modificarlo
    ↓
No hay prueba de origen
    ↓
No válido legalmente

DESPUÉS:
PDF firmado digitalmente
    ↓
Imposible modificar sin romper firma
    ↓
Prueba de quién lo firmó y cuándo
    ↓
✅ VÁLIDO LEGALMENTE EN ESPAÑA
✅ VÁLIDO LEGALMENTE EN UE (eIDAS)
✅ NO-REPUDIO garantizado
```

---

## 🔒 Seguridad de la Firma

```javascript
// Validar firma de PDF
async function verifyPdfSignature(pdfBytes) {
  try {
    // 1. Extraer firma del PDF
    const signature = extractSignatureFromPDF(pdfBytes);

    // 2. Validar timestamp
    if (signature.timestamp) {
      const tsaValid = await validateTimestampFromTSA(signature.timestamp);
      if (!tsaValid) {
        throw new Error('Timestamp inválido');
      }
    }

    // 3. Validar certificado
    const certValid = await validateCertificateAgainstFNMT(signature.certificate);
    if (!certValid) {
      throw new Error('Certificado no válido');
    }

    // 4. Validar integridad del PDF
    const pdfHash = await crypto.subtle.digest('SHA-256', pdfBytes);
    const signatureValid = verifySignature(pdfHash, signature.signature);

    if (!signatureValid) {
      throw new Error('Firma no válida - PDF modificado');
    }

    return {
      valid: true,
      signedBy: signature.certificate.getSubject(),
      signedAt: signature.metadata.signedAt,
      timestamp: signature.timestamp ? 'verified' : 'no-timestamp',
      noRepudiation: true
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
```

---

## 📋 Roadmap de Implementación

### **v1.3.0** (2-3 semanas)
- [x] Integración de certificado digital
- [x] Firma PKCS#7/XAdES
- [x] Validación contra FNMT CRL
- [x] UI para seleccionar certificado
- [x] Timestamp de TSA

### **v1.4.0** (3-4 semanas)
- [ ] Validación de usuario con certificado
- [ ] Servidor backend para verificación
- [ ] Auditoría de firmas
- [ ] Revocación de firmas

### **v2.0.0** (4-6 semanas)
- [ ] Integración con DNI electrónico
- [ ] Lector de tarjetas inteligentes
- [ ] Sistema de certificados HSM

---

## 🎯 Recomendación

**Implementar Opción 1 (Firma Digital) en v1.3.0:**
- ✅ Máximo beneficio legal
- ✅ Mínima complejidad
- ✅ Sin servidor requerido
- ✅ Experiencia UX limpia
- ✅ Costo: $0
- ✅ Tiempo: 2-3 semanas

---

## 📞 Recursos Útiles

- [FNMT - Certificados Digitales](https://www.sede.fnmt.gob.es/)
- [eIDAS - Regulación UE](https://www.eid.as/)
- [PKCS#7 Specification](https://tools.ietf.org/html/rfc2315)
- [XAdES Signature Format](https://uri.etsi.org/01903/)
- [PDF Signature Guide](https://www.adobe.com/content/dam/acom/en/open/pdfs/OpenStandardsforSignatures.pdf)

---

**¿Quieres que implemente la Opción 1 (Firma Digital) en v1.3.0?**
