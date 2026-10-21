# Evaluación de Impacto de Protección de Datos (DPIA)
## Conforme al Artículo 35 del RGPD (Reglamento UE 2016/679)

**Responsable del Tratamiento:** Humanity Ledger  
**Fecha:** Octubre 2026 | **Versión:** 2.0  
**Evaluadores:** DPO / Consultoría Criptográfica Externa  

---

## 1. Descripción Sistemática de las Operaciones de Tratamiento
Humanity Ledger procesa interacciones entre usuarios en dos ámbitos sensibles:
1. **Mensajería Instantánea Descentralizada:** Utiliza XMTP v3 con arquitectura MLS (Messaging Layer Security). Las comunicaciones 1:1 y grupales privadas están cifradas de extremo a extremo (E2EE). Los servidores de Humanity Ledger actúan como meros enlaces de interfaz sin almacenar mensajes ni poseer claves de descifrado.
2. **Transferencias Financieras Privadas:** Emplea Aztec L2 sobre Ethereum. El cómputo de conocimiento cero (UltraHonk) se ejecuta en el navegador (PXE en WebAssembly). El servidor de Humanity Ledger no procesa cuantías, saldos ni identidades de contrapartes, registrando exclusivamente el hash de transacción de Capa 2 para confirmaciones de estado.

---

## 2. Necesidad y Proporcionalidad
- **Minimización de Datos (Art. 5.1.c RGPD):** Se aplica privacidad por diseño y por defecto. No se recogen nombres reales, números telefónicos ni documentos de identidad gubernamentales salvo mandato legal específico.
- **Limitación del Plazo de Conservación (Art. 5.1.e RGPD):** Los registros técnicos del servidor se depuran automáticamente cada 30 días o menos.

---

## 3. Evaluación de Riesgos para los Derechos y Libertades
| Riesgo Identificado | Probabilidad | Gravedad | Medida de Mitigación Implementada |
| :--- | :--- | :--- | :--- |
| **Acceso no autorizado a conversaciones** | Muy Baja | Crítica | Cifrado E2EE con XMTP MLS; claves en IndexedDB con trinquete post-compromiso. |
| **Trazabilidad de pagos en cadena** | Baja | Alta | zk-SNARKs UltraHonk ocultan remitente, destinatario y balance en Aztec L2. |
| **Suplantación de identidad de cartera** | Muy Baja | Alta | Firma criptográfica SIWE (EIP-4361) con nonces de un solo uso en Redis. |
| **Ataque de fuerza bruta contra PIN** | Muy Baja | Media | Argon2id con sal aleatoria de 16 bytes y bloqueo tras 8 intentos fallidos. |

---

## 4. Conclusión del DPO
El tratamiento de datos es **conforme al RGPD** y presenta un nivel de riesgo residual bajo gracias a la arquitectura soberana y no custodia de la plataforma.
