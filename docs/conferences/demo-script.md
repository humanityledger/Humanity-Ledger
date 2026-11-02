# Guion Demo Grabada de Respaldo (< 5 minutos)

> **Destino:** Video demostrativo alojado y reproducible en caso de contingencia de red durante la conferencia.

---

## Minuto 0:00 - 0:45 | Introducción y Verificación de Identidad
1. **Acción en pantalla:** Abrir navegador en modo incógnito hacia `http://localhost:3000/connect`.
2. **Locución:** "Humanity Ledger opera bajo un principio estricto de no custodia. Al conectar la cartera con Sign-In with Ethereum (SIWE), se emite un nonce criptográfico de un solo uso en Redis con TTL de 10 minutos."
3. **Comprobación visible:** Mostrar en las herramientas de desarrollo la cookie HttpOnly `hl_session` con banderas `Secure` y `SameSite=Strict`.

---

## Minuto 0:45 - 2:00 | Mensajería Cifrada de Extremo a Extremo (XMTP)
1. **Acción en pantalla:** Abrir dos ventanas lado a lado (Alice y Bob). Alice envía un mensaje directo a Bob.
2. **Locución:** "La entrega ocurre exclusivamente mediante el stream en tiempo real de XMTP. Observen la pestaña Network: hay cero peticiones al servidor central `/api/chat/direct` para enviar o recibir el contenido del mensaje."
3. **Demostración de resiliencia:** Simular corte de red (offline en devtools). El mensaje queda encolado en IndexedDB (`hl_outbox`). Al restaurar la conexión, se drena y se entrega automáticamente.

---

## Minuto 2:00 - 3:45 | Pagos Privados con Aztec L2
1. **Acción en pantalla:** Navegar al panel de pagos ZK. Conectar cartera Aztec en testnet local.
2. **Locución:** "El balance se calcula de forma soberana consultando las notas privadas mediante el PXE en el navegador, sin que el servidor conozca el saldo ni los receptores."
3. **Transferencia:** Alice transfiere 10 tokens a Bob.
4. **Verificación:** Bob sincroniza su PXE, el balance se actualiza en pantalla, y en la consola del servidor se comprueba que solo se registra el hash de la transacción L2, sin revelar la cuantía.

---

## Minuto 3:45 - 4:45 | Comunidades Soberanas y Roles
1. **Acción en pantalla:** Demostración de canales públicos y privados. Acceso condicionado por token y permisos por rol.
2. **Conclusión:** "Seguridad real, cero simulaciones, código auditado y listo para producción."
