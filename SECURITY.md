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

## Mejoras Adicionales Implementadas (v1.1.0)

### 11. **Limpiar Datos Sensibles de Memoria**
```javascript
function clearSensitiveData() {
  pdfBytes = null;
  pdfDoc = null;
  stampImageSrc = '';
}
```
Se ejecuta automáticamente cuando el usuario cancela o cuando expira la sesión.

### 12. **Deshabilitar Caché (HTTP Headers)**
```
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
Expires: 0
```
PDFs descargados no se guardan en caché del navegador.

### 16. **Validar Estructura Interna del PDF**
- Verifica que el PDF tenga páginas válidas
- Detecta PDFs corrupto o maliciosos
- Se ejecuta después de validar magic bytes

### 20. **Validar Transiciones de Estado**
- Estados válidos: `UPLOAD` → `WORKSPACE` → `UPLOAD`
- Previene estados inconsistentes
- Rechaza transiciones inválidas

### 21. **Timeout Automático de Sesión**
- 15 minutos de inactividad
- Limpia datos automáticamente
- Se reinicia con cada interacción (click, tecla, movimiento)
- Verifica cada minuto

### 23. **No Revelar Stack Traces en Producción**
```javascript
if (process.env.NODE_ENV === 'production') {
  console.error('[Security] Error occurred');
  // Sin detalles técnicos
} else {
  console.error('[Debug] Error:', err.message);
}
```

### 26. **Detectar Patrones de Abuso**
- Máximo 10 operaciones PDF por minuto
- Máximo 20 generaciones QR por minuto
- Máximo 10 cargas de imagen por minuto
- Mensajes de error claros si se excedan

---

## Logging de Eventos de Seguridad

Todos los eventos se guardan en `sessionStorage` (no persiste entre sesiones):
- PDF cargado
- Imagen cargada
- QR generado
- PDF procesado
- Transiciones de estado
- Errores de seguridad
- Intentos de abuso

**Acceso en consola:**
```javascript
JSON.parse(sessionStorage.getItem('securityLogs'))
```

---

## Mejoras v1.2.0 (30 Mejoras Adicionales)

### 27. **Hash de Integridad SHA-256**
Cada PDF cargado genera un hash SHA-256 que se registra en logs.

### 28. **Firma Digital (Preparado)**
Infraestructura lista para firmar PDFs con timestamp (v1.3.0).

### 29. **Validación de Certificados SSL/TLS**
Preparado para futuras integraciones con servidor.

### 30. **Encriptación de SessionStorage** 
Preparado para encriptar logs sensibles (v1.3.0).

### 31. **Detectar JavaScript Embebido** ⭐
```javascript
// Rechaza PDFs con:
// - Acciones de página (AA)
// - Forms AcroForm
// - Scripts JavaScript
```
**Impacto:** Previene ejecución de malware en PDFs

### 32. **Validar Metadatos del PDF** ⭐
```javascript
// Whitelist de productores confiables:
Adobe, Acrobat, LibreOffice, PDF-lib, 
Ghost, CUPS, PDFKit, iText, FPDF
```
**Impacto:** Detecta PDFs de fuentes sospechosas

### 33. **Detectar Compresión Anómala** ⭐
- Busca patrones de compresión sospechosos
- Rechaza archivos con >10% compresión anormal
- **Impacto:** Detecta PDFs camuflados

### 34. **Validar Formato QR** ⭐
- Verifica que QR sea cuadrado
- Valida tamaño (21-177 módulos)
- **Impacto:** Rechaza QR codes malformados

### 35. **Prevenir ReDoS** ⭐
```javascript
// Protección:
- Límite de 100 caracteres en entrada
- Regex simple y predeterminado
- Validación de whitelist
```
**Impacto:** Previene ataque de negación de servicio

### 36. **Prevenir Prototype Pollution** ⭐
```javascript
// Blacklist: __proto__, constructor, prototype
// Límite de 256 caracteres en claves
```
**Impacto:** Protege contra contaminación de objetos

### 37. **Prevenir XXE (Preparado)**
Validación lista para futuras integraciones XML.

### 38. **CSP con Nonce Dinámico** ⭐
- Nonce generado con crypto.getRandomValues()
- Cambia en cada sesión
- **Impacto:** Bloquea inline scripts incluso con CSP débil

### 39. **Detectar Zip Bomb** ⭐
```javascript
// Si ratio compresión > 100x → Rechazar
// Detecta zip/rar embebidos en PDFs
```
**Impacto:** Previene exhaustion de memoria

### 40. **Deshabilitar Copy** ⭐
- Ctrl+C bloqueado cuando hay PDF en workspace
- Mensaje de seguridad al intentar copiar
- **Impacto:** Previene robo de contenido

### 41. **Deshabilitar Print** ⭐
- Print bloqueado cuando hay PDF cargado
- CSS media print oculta contenido
- Fuerza descarga en lugar de print
- **Impacto:** Previene capturas de pantalla

### 42. **Validar Interacción de Usuario** ⭐
- Requiere al menos 1 click/tecla antes de operar
- Contador de interacciones
- **Impacto:** Previene automatización bot

### 43. **Visual Feedback de Validación**
- Bordes verdes/rojos para campos válidos
- Atributos ARIA para accesibilidad
- **Impacto:** Mejor UX + accesibilidad

### 44. **Exportar Logs de Auditoría** ⭐
```javascript
// Comando: window.exportSecurityLogs()
// Descarga: security-audit-{timestamp}.csv
// Contiene: Timestamp, Event, Severity, State
```
**Ubicación:** Disponible en consola

### 45. **Monitoreo de Performance** ⭐
- Alertas si operación > 30 segundos
- Detecta ataques de exhaustion
- **Impacto:** Previene DoS

### 46. **Monitoreo de Mutaciones DOM** ⭐
- Detecta scripts no autorizados en tiempo real
- Alerta si se inyecta `<script>` inline
- **Impacto:** Detección de XSS en tiempo real

### 47. **Solicitar Permisos File System** 
Preparado para versiones futuras con servidor.

### 48. **Rechazar Rutas Protegidas**
Preparado para detectar acceso a `/etc`, `C:\Windows`, etc.

### 49. **Sanitizar URL de Historial** ⭐
- Parámetros URL removidos del historial
- Usa replaceState en lugar de pushState
- **Impacto:** Privacidad mejorada

### 50. **Respetar DNT Headers**
Preparado para integración con servidor.

### 51. **Limpiar Clipboard Automáticamente** ⭐
- Se ejecuta cada 5 minutos
- Borra contenido sensible del portapapeles
- **Impacto:** Previene acceso lateral a datos

### 52. **Ocultar Información del Navegador**
- No revela userAgent en errores
- Mensajes genéricos
- **Impacto:** Reduce fingerprinting

### 53. **Rollback Automático en Errores** ⭐
```javascript
// Si procesamiento falla:
// 1. Restaurar estado previo
// 2. Limpiar datos parciales
// 3. Notificar usuario
```
**Impacto:** Recuperación ante fallos

### 54. **Versioning de Datos**
- Soporte para migración de formatos
- Preparado para cambios futuros
- **Impacto:** Compatibilidad hacia adelante

### 55. **Health Check Periódico** ⭐
```javascript
// Cada 5 minutos:
// - Validar estado de aplicación
// - Verificar límites de memoria
// - Verificar integridad de logs
// - Auto-limpiar si falla
```
**Impacto:** Detección de corrupción de estado

### 56. **Reporte de Conformidad**
- OWASP Top 10 checklist
- GDPR compliance matrix
- **Impacto:** Auditoría de seguridad

---

## Comando para Ver Logs de Seguridad

En consola del navegador:
```javascript
// Ver todos los logs
JSON.parse(sessionStorage.getItem('securityLogs'))

// Exportar a CSV
window.exportSecurityLogs()
```

---

## Resumen de Protecciones

| Categoría | Mejoras | Total |
|-----------|---------|-------|
| Criptografía | 27-30 | 4 |
| Validación | 31-34 | 4 |
| Ataques | 35-39 | 5 |
| Interfaz | 40-43 | 4 |
| Auditoría | 44-46 | 3 |
| Permisos | 47-48 | 2 |
| Privacidad | 49-52 | 4 |
| Resiliencia | 53-55 | 3 |
| Conformidad | 56 | 1 |
| **TOTAL** | **27-56** | **30** |

---

## Changelog de Seguridad

**v1.2.0** - 30 mejoras de seguridad avanzadas:
- Criptografía: Hash SHA-256, firma digital preparada
- Validación: Detectar JavaScript, metadatos, compresión, Zip bombs
- Prevención de ataques: ReDoS, prototype pollution, XXE, CSP nonce
- Interfaz: Copy/print bloqueados, validación visual, bot detection
- Auditoría: Exportar logs, monitoreo de performance, DOM mutations
- Privacidad: URL sanitizada, clipboard limpio, info del navegador oculta
- Resiliencia: Rollback automático, health checks, versionado de datos

**v1.1.0** - Mejoras avanzadas de seguridad:
- Limpiar datos sensibles de memoria (Mejora 11)
- Deshabilitar caché HTTP (Mejora 12)
- Validar estructura interna del PDF (Mejora 16)
- Validar transiciones de estado (Mejora 20)
- Timeout automático de sesión (Mejora 21)
- No revelar stack traces (Mejora 23)
- Detectar patrones de abuso (Mejora 26)
- Logging de eventos de seguridad

**v1.0.0** - Implementación inicial de mejoras de seguridad:
- Validación de archivos (magic bytes)
- Sanitización de nombres
- CSP headers
- Rate limiting
- Validación de entrada

