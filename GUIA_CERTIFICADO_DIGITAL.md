# 📋 Guía de Certificado Digital - QR-Stamp v1.3.0

## 🎯 ¿Qué es la Firma Digital?

Una firma digital es un mecanismo criptográfico que:
- ✅ Prueba la **identidad del firmante**
- ✅ Garantiza la **integridad del documento** (no puede ser modificado)
- ✅ Proporciona **no-repudio** (no puede negar haberlo firmado)
- ✅ Tiene **validez legal** en España y UE (eIDAS)

---

## 🇪🇸 Certificados Españoles Soportados

### FNMT (Fábrica Nacional de Moneda y Timbre)
- **Certificado de Firma Electrónica Avanzada**
- **Precio:** Gratis
- **Validez:** 3 años
- **Obtención:** https://www.sede.fnmt.gob.es/
- **Formato:** .p12 o .pfx

### DNI Electrónico
- **Certificado integrado en el chip del DNI**
- **Precio:** Incluido con DNI
- **Disponibilidad:** v2.0 (próxima versión)
- **Ventajas:** Máxima seguridad

### Otros Certificados Cualificados
- Certificados de otras CAs reconocidas por la AEPD
- Deben ser validos en la cadena de confianza FNMT

---

## 📖 Cómo Obtener un Certificado FNMT

### Paso 1: Acceder a FNMT
1. Ir a https://www.sede.fnmt.gob.es/
2. Hacer clic en "Certificados"
3. Seleccionar "Certificado de Firma Electrónica Avanzada"

### Paso 2: Solicitar Certificado
1. Llenar formulario con datos personales
2. Seleccionar autenticación (presencial o por vídeo)
3. Pagar si es necesario (algunos son gratis)

### Paso 3: Descargar Certificado
1. Recibir correo con instrucciones de descarga
2. Descargar archivo .p12 o .pfx
3. Guardar en lugar seguro
4. Memorizar/guardar la contraseña

---

## 🔐 Usar Certificado Digital en QR-Stamp

### Paso 1: Cargar Certificado
1. Abrir QR-Stamp
2. Cargar PDF como de costumbre
3. En el panel "Firma Digital", hacer clic en "🔐 Cargar Certificado"
4. Seleccionar "📁 Subir Archivo (.p12, .pfx)"
5. Elegir tu certificado
6. Ingresar contraseña si se solicita

### Paso 2: Verificar Certificado
Se mostrará la siguiente información:
```
✅ Titular: Tu Nombre Completo
✅ Emisor: FNMT AC Nacional
✅ Válido hasta: 01/01/2027
✅ Tipo: FNMT o User Certificate
```

Si algún dato parece incorrecto, NO continúes.

### Paso 3: Habilitar Firma
1. Marcar el checkbox: "Firmar PDF con certificado digital"
2. Preparar el PDF normalmente (agregar sello, QR, etc.)
3. Hacer clic en "Generar y Descargar"

### Paso 4: Descargar PDF Firmado
- El PDF se descargará automáticamente con firma digital
- Nombre: `documento_sellado.pdf`
- **Ya es válido legalmente** ✅

---

## ✅ Verificar Firma Digital

### En Adobe Reader
1. Abrir PDF con Adobe Reader
2. Ver panel de firmas (lado derecho)
3. Hacer clic en la firma
4. Ver detalles y validez

### En navegador
1. Abrir PDF en navegador
2. Algunos navegadores muestran indicador de firma
3. Firefox: Botón de firma en la barra de herramientas

### Con OpenSSL (línea de comandos)
```bash
openssl pkcs7 -in documento_sellado.pdf -text -noout
```

---

## 🔒 Seguridad & Privacidad

### ✅ Está 100% Seguro
- ✅ La firma se realiza **solo en tu navegador**
- ✅ Tu certificado **NO se envía a ningún servidor**
- ✅ Tu contraseña **NO se guarda**
- ✅ La clave privada **NUNCA sale de tu PC**

### ⚠️ Recomendaciones
1. **Guarda tu certificado (.p12) en lugar seguro**
   - No lo compartas
   - Haz backup en pendrive encriptado
2. **Memoriza/anota tu contraseña**
   - No la guardes en archivos
   - Si la olvidas, pide nuevo certificado a FNMT
3. **Verifica el certificado antes de firmar**
   - Comprueba fechas de validez
   - Verifica que el titular sea correcto

---

## 💼 Casos de Uso

### ✅ Ideal Para
- Contratos digitales
- Documentos administrativos
- Acuerdos comerciales
- Facturas electrónicas
- Archivos de auditoría
- Notarización de documentos

### ❌ No Recomendado Para
- Documentos muy sensibles (mejor usar certificados HSM)
- Requisitos de cumplimiento muy estrictos
- Datos de alta clasificación (mejor servidor con HSM)

---

## 🐛 Solucionar Problemas

### Problema: "Certificado revocado"
**Solución:**
1. El certificado fue anulado por FNMT
2. Solicita un nuevo certificado en https://www.sede.fnmt.gob.es/
3. Después de recibirlo, podrás firmar de nuevo

### Problema: "Contraseña incorrecta"
**Solución:**
1. Verifica que escribes la contraseña correctamente
2. Si la olvidaste, solicita uno nuevo en FNMT
3. Ten cuidado con mayúsculas/minúsculas

### Problema: "Certificado no válido aún"
**Solución:**
1. La fecha actual es anterior a la fecha de inicio
2. Espera a que se active el certificado
3. O comprueba que la fecha de tu PC sea correcta

### Problema: "Certificado expirado"
**Solución:**
1. Solicita un nuevo certificado en FNMT
2. Los certificados FNMT duran típicamente 3 años
3. Recibirás recordatorio 60 días antes de expirar

### Problema: "Firma no se genera"
**Solución:**
1. Comprueba que el navegador sea reciente (Chrome, Firefox, Edge)
2. Abre la consola (F12) y busca errores
3. Intenta con un PDF diferente
4. Limpia caché del navegador

---

## 📊 Información Técnica

### Formato de Firma
- **Estándar:** PKCS#7 / XAdES
- **Algoritmo:** SHA-256-RSA
- **Timestamp:** FNMT TSA (opcional)
- **Validez:** Permanente (no expira)

### Cadena de Confianza
```
Raíz FNMT
    ↓
CA Intermedia FNMT
    ↓
Tu Certificado Personal
    ↓
Tu Firma Digital
```

### Compatibilidad
```
✅ Adobe Reader
✅ Firefox
✅ Chrome
✅ Edge
✅ Safari (macOS)
✅ Navegadores móviles
```

---

## 📞 Soporte

### FNMT
- Web: https://www.sede.fnmt.gob.es/
- Teléfono: +34 91 285 3370
- Email: soporte@sede.fnmt.gob.es

### QR-Stamp Issues
- GitHub: https://github.com/
- Reporta bugs o solicita features
- Email: soporte@qr-stamp.com (cuando sea disponible)

---

## 🎓 Referencias

- [Regulación eIDAS (UE)](https://www.eid.as/)
- [FNMT - Certificados Digitales](https://www.sede.fnmt.gob.es/)
- [AEPD - Guía de Firma Electrónica](https://www.aepd.es/)
- [Adobe - Firma Digital PDF](https://www.adobe.com/es/sign/)
- [RFC 2315 - PKCS#7](https://tools.ietf.org/html/rfc2315)

---

## ✨ Próximas Características (v2.0)

- 🔐 Lectura de DNI Electrónico
- 🔄 Validación de firmas anteriores
- 📜 Historial de firmas
- 🌐 Integración con servidor (opcional)
- 🔑 Gestión de múltiples certificados
- 📱 Soporte para certificados móviles

---

**Versión:** 1.3.0  
**Última actualización:** 2026-08-11  
**Estado:** ✅ Producción

---

## ¿Tienes preguntas?

Lee la [SECURITY.md](SECURITY.md) para más detalles de seguridad.  
Consulta [CERTIFICADO_DIGITAL.md](CERTIFICADO_DIGITAL.md) para aspectos técnicos.
