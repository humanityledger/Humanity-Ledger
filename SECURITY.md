# SECURITY & THREAT MODEL (Humanity Ledger)

Este documento define el mapa de fronteras de seguridad y las invariantes críticas del protocolo Humanity Ledger, según lo dictado por el `PROTOCOL_SPEC.md` (Prioridad P0 #14).

## 1. INVARIANTES DE SEGURIDAD (Security Invariants)
Bajo ninguna circunstancia (ni por error humano, ni por actualización) el código en producción puede romper las siguientes reglas lógicas:

1. **Nunca firmar dos veces la misma operación**: Prevención estricta de *replay attacks*. Toda operación que modifique el estado debe consumir un nonce válido o usar una idempotency key.
2. **Nunca reutilizar un nonce de la misma clave**.
3. **Aislamiento de sesiones revocadas**: Una sesión revocada o caducada nunca puede ser cruzada, reactivada ni usada para acceder a datos cacheados.
4. **Cifrado E2E sin backdoors operativos**: La clave privada o los materiales simétricos de desencriptación *nunca* abandonan el cliente, ni se logean, ni se transmiten al servidor del protocolo. El backend no debe tener capacidad de desencriptar contenido.
5. **Separación de claves ZK (Aztec)**: Las claves de *nullifier* y de *viewing* están estrictamente separadas. 
6. **No hay secrets en el bundle cliente**: Todo secret, token o API key distribuido dentro del código fuente de iOS, Android o Web (frontend) se considera material público.
7. **Privacidad de metadatos**: Las notificaciones Push (APNs / FCM) no contienen el payload del mensaje en texto claro.

## 2. SECURITY BOUNDARY MAP

Documentación de qué sucede si se compromete cada componente del sistema:

- **Compromiso de la API (Next.js/Node)**: 
  - *Impacto*: Denegación de servicio (DDoS), filtración de identidades públicas, intercepción de peticiones RPC de lectura.
  - *Mitigación*: El backend no posee claves privadas de usuarios. Los mensajes en tránsito usan HTTPS y los payloads de chat van cifrados (XMTP). No hay acceso a fondos de usuarios (Account Abstraction previene esto sin firmas del cliente).
- **Compromiso de Base de Datos (PostgreSQL)**:
  - *Impacto*: Filtración de metadatos (quién habla con quién, timestamps), configuración de perfiles, nombres de usuarios.
  - *Mitigación*: No hay mensajes en texto claro en DB. Las contraseñas (en caso de existir para auth legacy) están hasheadas (Argon2/bcrypt). La DB es un *Indexador*, no la fuente única de verdad para el asentamiento final.
- **Compromiso de Redis**:
  - *Impacto*: Bypass temporal de rate limits, manipulación de colas de eventos (workers).
  - *Mitigación*: No usar Redis como única fuente de almacenamiento de datos críticos o validación final.
- **Compromiso del Object Storage (S3/CDN)**:
  - *Impacto*: Acceso a blobs cifrados (imágenes, documentos adjuntos).
  - *Mitigación*: El cliente encripta los adjuntos *antes* de la subida. Un atacante solo obtendrá blobs ofuscados.
- **Compromiso de un Dispositivo Cliente (iOS/Web)**:
  - *Impacto*: Exposición de los datos decodificados en *ese* dispositivo. Posible robo de identidad local (Session hijacking).
  - *Mitigación*: Enclave seguro (Secure Enclave / PIN de la bóveda local) para proteger las llaves de desencriptación. Rotación de dispositivos a través de la Identidad Canónica (revocar el dispositivo comprometido).
- **Compromiso del Secuenciador Aztec / RPC Node**:
  - *Impacto*: Censura de transacciones, front-running, negación de ejecución.
  - *Mitigación*: La arquitectura es modular (redundancia RPC). Los usuarios pueden enviar transacciones a través de *fallbacks* o relayers alternativos.

---
*Este modelo debe revisarse trimestralmente (Scalability Kill List) incorporando prácticas STRIDE y Threat Modeling.*
