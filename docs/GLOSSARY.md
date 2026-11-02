# Glosario Técnico Sin Jerga

> Términos oficiales de arquitectura y criptografía de Humanity Ledger.

---

### Account Abstraction (Abstracción de Cuenta)
Mecanismo que permite a los contratos inteligentes actuar como billeteras de usuarios, habilitando transacciones sin gas para el usuario final mediante patrocinadores (paymasters) y multifirma programable.

### Argon2id
Algoritmo ganador del Password Hashing Competition (PHC), optimizado contra ataques con GPUs y ASICs mediante memoria intensiva y resistencia a ataques de canal lateral. Empleado en Humanity Ledger para el bloqueo de pantalla con PIN.

### Aztec Network
Red de Capa 2 (L2) de privacidad sobre Ethereum que permite la ejecución de contratos inteligentes privados mediante pruebas de conocimiento cero (ZK-SNARKs UltraHonk) y un modelo de notas UTXO cifradas.

### Double Ratchet (Doble Trinquete)
Protocolo criptográfico que proporciona Secreto Hacia Adelante (Forward Secrecy) y Seguridad Post-Compromiso (Break-in Recovery) en cada mensaje enviado.

### E2EE (End-to-End Encryption / Cifrado de Extremo a Extremo)
Esquema de comunicación donde solo los extremos legítimos (dispositivos de los participantes) tienen las claves para cifrar y descifrar el contenido. Los intermediarios (servidores, redes) solo transportan paquetes cifrados opacos.

### LiveKit
Plataforma de infraestructura de audio y video en tiempo real de código abierto que utiliza SFUs (Selective Forwarding Units) y simulcast de múltiples capas para conferencias grupales y llamadas cifradas.

### MLS (Messaging Layer Security - RFC 9420)
Estándar del IETF para mensajería de grupo eficiente y segura con cifrado de extremo a extremo, diseñado para escalar a grupos de cientos de participantes manteniendo el secreto hacia adelante en altas y bajas de miembros.

### Nonce
Número arbitrario que solo se usa una vez en una operación criptográfica. En Sign-In with Ethereum (SIWE), previene ataques de repetición asegurando que una firma antigua no pueda ser reutilizada para autenticarse de nuevo.

### PXE (Private eXecution Environment)
Componente de software de Aztec que se ejecuta localmente en el dispositivo del usuario (en el navegador o en la app móvil). Mantiene las viewing keys del usuario, desencripta sus notas privadas y genera las pruebas de conocimiento cero sin revelar datos al secuenciador.

### Rate Limiting (Límite de Peticiones)
Mecanismo de protección que restringe el número de peticiones que un cliente puede emitir en una ventana temporal para salvaguardar la disponibilidad del sistema y prevenir ataques de denegación de servicio o fuerza bruta.

### SIWE (Sign-In with Ethereum - EIP-4361)
Estándar de autenticación que permite a los usuarios acceder a aplicaciones descentralizadas firmando un mensaje estructurado con su billetera criptográfica, sin contraseñas ni intermediarios centralizados.

### STRIDE
Metodología de modelado de amenazas desarrollada por Microsoft que categoriza los riesgos en: Spoofing (Suplantación), Tampering (Manipulación), Repudiation (Repudio), Information Disclosure (Fuga de información), Denial of Service (Denegación de servicio) y Elevation of Privilege (Elevación de privilegios).

### UltraHonk
Sistema de pruebas de conocimiento cero de última generación desarrollado por Aztec/Barretenberg, sucesor de Plonk, que elimina la fase de configuración confiable por circuito y optimiza la generación de pruebas en clientes ligeros.

### XMTP (Extensible Message Transport Protocol)
Protocolo y red de comunicación descentralizada para mensajería cifrada entre carteras web3.
