# Seguridad de QR-Stamp

## Arquitectura 100% Client-Side (Mejora 9)

**QR-Stamp procesa todos los datos localmente en tu navegador.** Ningún archivo PDF, imagen, o código QR se envía a servidores remotos. Todo el procesamiento sucede en tu máquina.

### ¿Qué significa esto?
- ✅ Tus documentos PDF nunca salen de tu computadora
- ✅ Tus imágenes de firma nunca se suben a internet
- ✅ Tu navegador es la única aplicación que maneja los datos
- ✅ Privacidad garantizada por arquitectura

---

## Mejoras de Seguridad Implementadas

### 1. **Validación de Archivos (Mejoras 2, 3, 4, 7)**
- ✅ Límite de tamaño: máximo 50MB para PDFs, 5MB para imágenes
- ✅ Validación de magic bytes: confirma que es un PDF genuino (bytes `%PDF`)
- ✅ Sanitización de nombres de archivo: previene caracteres maliciosos
- ✅ Validación de formato de imágenes: solo PNG/JPEG en base64

**Ubicación:** `src/main.js` - Funciones `validateFileSize()`, `validatePdfMagicBytes()`, `sanitizeFilename()`, `validateDataUrl()`

### 2. **Protección XSS (Mejora 1)**
- ✅ No se usa `innerHTML` con datos del usuario
- ✅ Uso de `textContent` para nombres de archivo
- ✅ Creación de elementos DOM en lugar de concatenación de HTML

**Ubicación:** `src/main.js` - Función `sanitizeHtmlContent()`

### 3. **Validación de Entrada (Mejora 6)**
- ✅ Límite de páginas máximo: 10,000
- ✅ Validación de rangos de páginas ingresados manualmente
- ✅ Límite de caracteres QR: 2,953 (especificación QR)

**Ubicación:** `src/main.js` - Funciones `validatePageCount()`, `parseTargetPages()`, `validateQrInput()`

### 4. **Rate Limiting (Mejora 10)**
- ✅ Debounce de 2 segundos entre procesamiento de PDFs
- ✅ Previene DoS por generación masiva de documentos

**Ubicación:** `src/main.js` - Variables `isProcessing`, `lastProcessTime`, `PROCESS_DEBOUNCE_MS`

### 5. **Content Security Policy (Mejora 5)**
- ✅ Headers de seguridad HTTP configurados en Vite
- ✅ Previene inyección de scripts maliciosos
- ✅ Restringue conexiones a hosts remotos

**Ubicación:** `vite.config.js`

```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## Límites de Seguridad Configurables

Edita `SECURITY_CONFIG` en `src/main.js` para ajustar:

```javascript
const SECURITY_CONFIG = {
  MAX_PDF_SIZE: 50 * 1024 * 1024,      // 50 MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,     // 5 MB
  MAX_PAGES: 10000,                     // Máximo de páginas
  PROCESS_DEBOUNCE_MS: 2000,           // Milisegundos entre procesos
  MAX_QR_LENGTH: 2953                  // Caracteres QR máx
};
```

---

## Validaciones por Etapa

### Carga de PDF
1. ✅ Valida tamaño (< 50MB)
2. ✅ Verifica magic bytes (`%PDF`)
3. ✅ Valida número de páginas (< 10,000)
4. ✅ Sanitiza nombre de archivo

### Carga de Imagen
1. ✅ Valida tamaño (< 5MB)
2. ✅ Verifica formato (PNG/JPEG)
3. ✅ Carga como data URL segura
4. ✅ Valida que sea imagen genuina

### Generación de Código QR
1. ✅ Valida longitud de entrada (< 2,953 chars)
2. ✅ Verifica que QR sea válido
3. ✅ Valida formato de salida

### Procesamiento de PDF
1. ✅ Rate limiting (máximo 1 vez cada 2s)
2. ✅ Valida selección de páginas
3. ✅ Sanitiza nombre del archivo de salida
4. ✅ Manejo seguro de errores

---

## Buenas Prácticas de Uso

- ✅ Usa en navegadores modernos (Chrome, Firefox, Safari, Edge)
- ✅ Mantén tu navegador actualizado
- ✅ No ejecutes con scripts deshabilitados si esperas descargar
- ✅ Verifica que uses `https://` en producción
- ✅ Revisa los errores en la consola si algo falla

---

## Errores de Seguridad Reportados

Si encuentras un problema de seguridad:
1. No lo publiques públicamente
2. Documenta los pasos para reproducir
3. Contacta al equipo de desarrollo privadamente

---

## Changelog de Seguridad

**v1.0.0** - Implementación inicial de mejoras de seguridad:
- Validación de archivos (magic bytes)
- Sanitización de nombres
- CSP headers
- Rate limiting
- Validación de entrada

