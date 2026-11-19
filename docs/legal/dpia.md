# Evaluación de impacto relativa a la protección de datos (EIPD), alpha cerrada

Estado: borrador interno, no vigente hasta la firma del abogado (OD-8) · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: los textos vigentes son las páginas de /docs (`lib/docs/pages/legal.ts`)

> Borrador preparado con Claude, pendiente de revisión por un abogado colegiado. Sustituye la versión anterior, que nombraba un DPO y una consultoría externa que no existen.

## 1. Quién la hace y cuándo

- **Responsable del tratamiento:** Stefan Antonio Cirisanu, persona física, hasta que exista la S.L. (`lib/constants/legalEntity.ts`). «Humanity Ledger» es un nombre comercial, no una entidad.
- **Autor de este borrador:** preparado con Claude el 19/11/2026, pendiente de revisión por el abogado. No hay delegado de protección de datos: la ley no lo exige para este tamaño y actividad [verificar]. Hay un contacto de privacidad, el del aviso legal.

## 2. Por qué hace falta (art. 35 RGPD)

Tecnología nueva (pruebas de conocimiento cero en el dispositivo), registros en cadena que no se pueden borrar, pagos y comunicaciones. El CEPD recomienda evaluar el impacto antes de tratar datos con blockchain (Directrices 02/2025, v2.0, 7/7/2026).

## 3. Tratamientos

| Dato | Finalidad | Base jurídica | Plazo |
| --- | --- | --- | --- |
| Dirección de wallet y sesión (SIWE) | Dar acceso a la cuenta | Contrato (art. 6.1.b RGPD) | Mientras la cuenta exista |
| Nombre de usuario | Que otras personas te encuentren | Contrato | Mientras la cuenta exista; se libera al borrarla |
| Nombre y contacto del tester | Gestionar la alpha | Contrato de tester | 8 semanas de alpha + 6 meses |
| Aceptación de las condiciones (fecha y hash del texto) y comprobación de sanciones y edad (solo el resultado) | Demostrar la admisión en la alpha | Obligación y interés legítimo, a confirmar por el abogado | Hasta 6 meses después del fin de la alpha (`scripts/alpha/purge.mjs`) |
| Publicaciones de comunidades (servidor, Railway) | Prestar la función de comunidades | Contrato | Hasta que el autor o la comunidad las borre |
| Informes de entrega con identificadores recortados | Diagnosticar fallos de entrega | Interés legítimo (art. 6.1.f), con ponderación escrita pendiente | 30 días |
| Registros técnicos y de seguridad | Proteger el servicio | Interés legítimo | 90 días |
| Registro de entregas de Fee Juice | Documentar las entregas para Hacienda | Obligación legal | Plazo fiscal, a confirmar |
| Mensajes directos | Ledger Chat no los ve: cifrados con MLS en el dispositivo | Sin tratamiento del contenido; metadatos en la red XMTP | Según XMTP |

## 4. Riesgos y medidas

| Riesgo | Medida | Riesgo residual |
| --- | --- | --- |
| Una dirección de wallet se vincula a una persona (tester con nombre, nombre de usuario) | Nada identificativo se escribe en Aztec ni en Ethereum; los nombres de usuario viven en el servidor | Medio |
| Lo que está en cadena no se puede suprimir | Se avisa antes de actuar (condiciones y política); el diseño evita escribir datos personales en cadena | Medio |
| Las publicaciones de comunidades no están cifradas de extremo a extremo | Se dice así en la política; acceso limitado al servidor | Medio |
| Metadatos en la red XMTP (direcciones, momentos) | Explicarlo en la política; calificación de los operadores de nodos pendiente del abogado | Medio |
| Transferencia a EE. UU. (Railway) | Acuerdo de encargo y base de la transferencia pendientes; valorar región UE (D-6) | Medio hasta firmar |
| Almacenamiento en el navegador | Solo el necesario para funcionar; el contador de visitas ya no guarda nada (PR #176) | Bajo |

## 5. Conclusión

Pendiente de la revisión del abogado. Este borrador no concluye que el riesgo sea aceptable.
