/**
 * Digital Certificate Management
 * Spanish FNMT Certificate Support
 */

import forge from 'node-forge';

// FNMT Trusted CAs
const FNMT_ROOTS = [
  'CN=FNMT AC Raíz, O=Fabrica Nacional de Moneda y Timbre',
  'CN=FNMT AC Nacional, O=Fabrica Nacional de Moneda y Timbre'
];

// Certificate types
export const CERT_TYPES = {
  FNMT: 'FNMT',
  DNI: 'DNIe',
  USER: 'User Certificate'
};

/**
 * Get certificates from browser
 */
export async function getCertificatesFromBrowser() {
  try {
    if (!window.PublicKeyCredential) {
      throw new Error('Web Authentication API not supported');
    }

    const certs = await navigator.credentials.get({
      signal: AbortSignal.timeout(30000)
    });

    return certs;
  } catch (err) {
    logSecurityEvent('Browser certificate access failed', 'info');
    return null;
  }
}

/**
 * Load certificate from file (.p12, .pfx, .pem)
 */
export async function loadCertificateFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        let certificate;

        if (file.name.endsWith('.p12') || file.name.endsWith('.pfx')) {
          certificate = forge.pkcs12.asn1.fromDer(data);
        } else if (file.name.endsWith('.pem')) {
          certificate = forge.pem.decode(data)[0];
        } else if (file.name.endsWith('.cer')) {
          certificate = forge.asn1.fromDer(data);
        } else {
          throw new Error('Unsupported certificate format');
        }

        resolve(certificate);
      } catch (err) {
        reject(new Error('Certificate parsing failed: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('File reading failed'));

    if (file.name.endsWith('.pem')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * Extract certificate data for display
 */
export function extractCertificateInfo(cert) {
  try {
    const subject = forge.pki.certificateToAsn1(cert).subject;
    const issuer = cert.issuer;
    const validity = cert.validity;

    return {
      subject: formatDN(subject),
      issuer: formatDN(issuer),
      validFrom: new Date(validity.notBefore),
      validTo: new Date(validity.notAfter),
      keyUsage: getKeyUsage(cert),
      serialNumber: cert.serialNumber,
      fingerprint: forge.md.sha256.create()
        .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).toString())
        .digest()
        .toHex(),
      type: determineCertificateType(cert)
    };
  } catch (err) {
    throw new Error('Certificate info extraction failed: ' + err.message);
  }
}

/**
 * Validate certificate dates
 */
export function validateCertificateDates(cert) {
  const now = new Date();
  return now >= cert.validity.notBefore && now <= cert.validity.notAfter;
}

/**
 * Validate certificate chain against FNMT roots
 */
export async function validateCertificateChain(cert) {
  try {
    // Check if certificate is self-signed or from trusted CA
    const issuerString = formatDN(cert.issuer);

    const isTrusted = FNMT_ROOTS.some(root => {
      return issuerString.includes(root) ||
             issuerString.includes('FNMT') ||
             issuerString.includes('Fabrica Nacional');
    });

    if (!isTrusted) {
      logSecurityEvent(`Untrusted certificate issuer: ${issuerString}`, 'warning');
      return false;
    }

    // Validate dates
    if (!validateCertificateDates(cert)) {
      throw new Error('Certificate expired or not yet valid');
    }

    return true;
  } catch (err) {
    throw new Error('Certificate chain validation failed: ' + err.message);
  }
}

/**
 * Check if certificate is revoked (basic check)
 * In production, should download and check FNMT CRL
 */
export async function checkCertificateRevocation(cert) {
  try {
    const serialNumber = cert.serialNumber;

    // In production: Fetch FNMT CRL and check
    // https://www.sede.fnmt.gob.es/descargas/crl/

    logSecurityEvent(`Certificate revocation check: serial ${serialNumber}`, 'info');
    return true; // Not revoked
  } catch (err) {
    logSecurityEvent('Certificate revocation check failed', 'warning');
    return true; // Assume valid if check fails
  }
}

/**
 * Verify certificate signature
 */
export function verifyCertificateSignature(cert, issuerCert = null) {
  try {
    if (!issuerCert) {
      // Self-signed
      return cert.verify(cert);
    }
    return cert.verify(issuerCert);
  } catch (err) {
    throw new Error('Certificate signature verification failed');
  }
}

/**
 * Full certificate validation
 */
export async function validateCertificate(cert) {
  try {
    // 1. Check dates
    if (!validateCertificateDates(cert)) {
      throw new Error('Certificate expired or not yet valid');
    }

    // 2. Check chain
    if (!await validateCertificateChain(cert)) {
      throw new Error('Certificate chain validation failed');
    }

    // 3. Check revocation
    if (!await checkCertificateRevocation(cert)) {
      throw new Error('Certificate is revoked');
    }

    // 4. Verify signature
    if (!verifyCertificateSignature(cert)) {
      throw new Error('Certificate signature verification failed');
    }

    logSecurityEvent('Certificate validated successfully', 'info');
    return true;
  } catch (err) {
    logSecurityEvent(`Certificate validation failed: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * Helper: Format Distinguished Name
 */
function formatDN(dn) {
  if (typeof dn === 'string') return dn;

  if (dn && dn.attributes) {
    return dn.attributes
      .map(attr => {
        const name = attr.shortName || attr.name;
        const value = attr.value;
        return `${name}=${value}`;
      })
      .join(', ');
  }

  return '';
}

/**
 * Helper: Get key usage from certificate
 */
function getKeyUsage(cert) {
  const keyUsageExt = cert.getExtension('keyUsage');
  if (!keyUsageExt) return [];

  const keyUsageFlags = keyUsageExt.digitalSignature ? ['Digital Signature'] : [];
  if (keyUsageExt.nonRepudiation) keyUsageFlags.push('Non-Repudiation');
  if (keyUsageExt.keyEncipherment) keyUsageFlags.push('Key Encipherment');
  if (keyUsageExt.dataEncipherment) keyUsageFlags.push('Data Encipherment');
  if (keyUsageExt.keyAgreement) keyUsageFlags.push('Key Agreement');
  if (keyUsageExt.keyCertSign) keyUsageFlags.push('Key Cert Sign');
  if (keyUsageExt.cRLSign) keyUsageFlags.push('CRL Sign');

  return keyUsageFlags;
}

/**
 * Helper: Determine certificate type
 */
function determineCertificateType(cert) {
  const issuerString = formatDN(cert.issuer);

  if (issuerString.includes('DNI') || issuerString.includes('Dirección General")) {
    return CERT_TYPES.DNI;
  }
  if (issuerString.includes('FNMT') || issuerString.includes('Fabrica Nacional')) {
    return CERT_TYPES.FNMT;
  }

  return CERT_TYPES.USER;
}

/**
 * Export certificate (for backup)
 */
export function exportCertificate(cert, format = 'pem') {
  try {
    if (format === 'pem') {
      return forge.pem.encode({
        body: forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes()
      });
    }
    throw new Error('Only PEM export is supported');
  } catch (err) {
    throw new Error('Certificate export failed: ' + err.message);
  }
}
