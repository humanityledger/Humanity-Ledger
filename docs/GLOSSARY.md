# Glosario Técnico Sin Jerga

> Términos oficiales de arquitectura y criptografía de Humanity Ledger.

Estado: vigente · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: este archivo (lo lee `scripts/docs/check-consistency.mjs`)

## Términos canónicos

Se usan siempre igual en código, web, documentación y registros.

| Término | Qué es | No decir |
| --- | --- | --- |
| Aztec Network | La red de capa 2 de privacidad que liquida en Ethereum | «la blockchain de Aztec Labs» |
| Alpha (Aztec Alpha) | La red principal de Aztec en fase alpha (v6.0.0), con valor real | «mainnet estable» |
| HLC Test Token | El token de prueba de la alpha cerrada, sin valor monetario (PA-1) | «token de Ledger Chat», «moneda» |
| cUSDC (Clean USDC, de human.tech) | El activo previsto para pagos reales, emitido por human.tech con su puente Shield; apagado hasta cumplir `CUSDC_GATES` | «nuestro stablecoin» |
| Fee Juice | AZTEC depositado en Aztec; solo paga comisiones de red y no se puede transferir | «gas gratis» |
| Revisión interna de seguridad | La revisión de `docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md`; no es una auditoría | «auditado» |
| No custodial | El usuario firma siempre; Ledger Chat nunca tiene sus claves ni sus fondos | «custodia segura» |
| Alpha cerrada | La prueba por invitación con 50 testers como máximo (OD-4) | «lanzamiento» |
| Tester | Persona con nombre, invitada por Stefan, que aceptó las condiciones | «usuario beta anónimo» |

## Términos prohibidos

Cada término tiene un uso permitido como mucho, escrito en `allow` (por ejemplo, una negación: «not audited»). Lo comprueba `test/unit/docs/consistency.test.ts` en `app/`, `components/`, `lib/` y `docs/`. Se excluyen los registros históricos, los prompts y los borradores legales sin firmar (`skip`).

<!-- forbidden-terms:start -->
```json{
  "rules": [
    {
      "term": "Humanity Ledger Corp",
      "pattern": "Humanity Ledger Corp(oration)?\\b|HUMANITY LEDGER CORP",
      "flags": "i",
      "allow": "(named|name is|Name|nombre|se llama|called) [\\\"«]Humanity Ledger Corp"
    },
    {
      "term": "ledgeralert.corp",
      "pattern": "ledgeralert\\.corp",
      "flags": "i"
    },
    {
      "term": "Corporation",
      "pattern": "\\bCorporation\\b",
      "flags": "",
      "allow": "Railway Corporation"
    },
    {
      "term": "Real ETH",
      "pattern": "\\bReal ETH\\b",
      "flags": "",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b|no longer"
    },
    {
      "term": "audited",
      "pattern": "\\baudited\\b",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b[^.\\n]{0,60}audited|unaudited|audited[^.\\n]{0,15}\\byet\\b|\\\"Audited\\\"|any claim (of|that)[^.\\n]{0,40}audited|no external audit|\\bdescribed\\b"
    },
    {
      "term": "partner",
      "pattern": "(Aztec|Ethereum|human\\.tech|Shield)[^.\\n]{0,40}\\bpartner|\\bpartner[^.\\n]{0,40}(Aztec|Ethereum|human\\.tech|Shield)",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    },
    {
      "term": "official",
      "pattern": "\\bofficial\\b[^.\\n]{0,30}(Aztec|Ethereum|human\\.tech|partner)|(Aztec|Ethereum|human\\.tech)[^.\\n]{0,20}\\bofficial\\b",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b|official (Aztec |Ethereum )?(and Ethereum )?(docs?|documentation|brand|wordmark|marks?|files?|repo|repository|portal|site|website|media kit|logo|diamond|sdk|node|bridge|explorer|guide|release|image|package)"
    },
    {
      "term": "backed by",
      "pattern": "backed by (Aztec|Ethereum|human\\.tech|Shield)",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    },
    {
      "term": "untraceable",
      "pattern": "untraceable|imposible de rastrear",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    },
    {
      "term": "anonymous",
      "pattern": "anonymous (payments?|transactions?|transfers?|money)|pagos? an[oó]nimos?",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    },
    {
      "term": "DPO",
      "pattern": "\\bDPO\\b|Data Protection Officer|delegado de protecci[oó]n de datos",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b",
      "only": [
        "docs/legal/"
      ]
    },
    {
      "term": "consultoría externa",
      "pattern": "consultor[ií]a (criptogr[aá]fica )?externa|external consultancy",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    },
    {
      "term": "HLC sale words",
      "pattern": "HLC[^.\\n]{0,80}\\b(airdrop|presale|pre-sale|buyback|buy-back|staking|vesting|fair launch)|\\b(airdrop|presale|pre-sale|buyback|buy-back|fair launch)[^.\\n]{0,80}HLC",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    },
    {
      "term": "HLC burn",
      "pattern": "HLC[^.\\n]{0,40}\\bburn|\\bburn[^.\\n]{0,40}HLC",
      "flags": "i",
      "allow": "\\b(not|never|no|nor|nothing|without|isn't|aren't|hasn't|haven't|un|none|withdrawn|removed|retired|refuses|nunca|sin|ningún|ninguna|ni)\\b"
    }
  ],
  "skip": [
    "docs/archive/",
    "docs/inventory/",
    "docs/security/",
    "docs/audit/",
    "docs/plan/prompts/",
    "docs/ADR/historical/",
    "docs/legal/drafts/",
    "docs/legal/NOTA_PRELIMINAR_2026-11-19.md",
    "docs/UPGRADE_LOG.md",
    "docs/GLOSSARY.md",
    "lib/blockchain/abi/",
    "lib/docs/pages/legal.ts",
    "lib/docs/pages/protocol.ts",
    "docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md",
    "docs/INTEGRATION_MAP.md"
  ]
}
```
<!-- forbidden-terms:end -->

`lib/docs/pages/legal.ts` y `protocol.ts` no se editan por decisión del proyecto; si contienen un término prohibido, se anota en `docs/INTEGRATION_MAP.md` como pendiente de Stefan.

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
