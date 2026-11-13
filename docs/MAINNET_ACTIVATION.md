# Activar Aztec Alpha en Railway (mainnet real)

> **Estado:** El código está 100% listo. Solo faltan estas acciones externas.

---

## PASO 1 — Variables de entorno en Railway (5 minutos)

Entra en Railway → tu proyecto → pestaña **Variables** y añade:

```
NEXT_PUBLIC_AZTEC_NETWORK=alpha
NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true
```

> **Sin estas dos variables** el wallet conecta al testnet de Aztec.
> Con ellas, conecta a Aztec Alpha (Ethereum mainnet).

**Variables adicionales que debes configurar para Alpha:**

```
# URL del nodo Aztec Alpha público (ya incluido en networks.ts, pero puedes sobreescribir)
NEXT_PUBLIC_AZTEC_NODE_URL=https://api.aztec.network/aztec-alpha/node

# El número de bloque L1 desde el que buscar tus depósitos de Fee Juice
# Pon el bloque actual de Ethereum mainnet cuando despliegues por primera vez
NEXT_PUBLIC_AZTEC_L1_FROM_BLOCK=<bloque_actual_ethereum_mainnet>

# Modo de valor — mantener en exits-only hasta auditoría, luego pasar a open
NEXT_PUBLIC_AZTEC_VALUE_MODE=exits-only

# Explorer de Aztec Alpha
NEXT_PUBLIC_AZTEC_EXPLORER=https://aztecscan.xyz
```

---

## PASO 2 — Fee Juice: fondos reales para fees (5-10 minutos)

Cuando Aztec Alpha esté activado, cada usuario necesita Fee Juice para pagar fees.
Fee Juice = AZTEC ERC-20 bridgeado desde Ethereum mainnet.

**Flujo para el usuario (ya implementado en la UI):**

1. Abrir wallet → pestaña "Network fees"
2. Conectar wallet Ethereum con AZTEC en mainnet
3. Aprobar y depositar → el UI de `ZkBridgePortal`/`FeeJuiceStation` hace el resto
4. Esperar confirmación L1→L2 (unos minutos)
5. La cuenta Aztec se despliega automáticamente en la primera tx

**Para bootstrap inicial (como operador):**
- Consigue AZTEC en Ethereum mainnet (Uniswap, etc.)
- Usa el flujo de Fee Juice en la propia app

---

## PASO 3 — Caps de valor (máxima seguridad, pre-auditoría)

Mientras el protocolo no tenga auditoría externa (G8), mantén caps bajos.
Los caps se configuran así en Railway:

```
# Cap por token: JSON con address aztec → importe en base units
# Ejemplo: cap de 10 USDC (6 decimales = 10_000_000)
NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS={"0x<aztec_token_address>":"10000000"}
```

> Con `NEXT_PUBLIC_AZTEC_VALUE_MODE=exits-only` nadie puede iniciar pagos nuevos.
> Cambia a `open` solo cuando tengas la auditoría o caps confirmados.

---

## PASO 4 — Tokens privados (USDC, DAI, ETH)

En Alpha, los tokens deben estar desplegados en la red Aztec Alpha.
Cuando estén disponibles, configura:

```
NEXT_PUBLIC_AZTEC_TOKENS={"USDC":{"address":"0x<aztec_usdc_address>","symbol":"USDC","decimals":6},"DAI":{"address":"0x<aztec_dai_address>","symbol":"DAI","decimals":18}}
```

> Sin esta variable, solo Fee Juice está disponible (suficiente para fees, no para pagos privados).

---

## Estado de los Gates para mainnet completo

| Gate | Descripción | Estado |
|------|-------------|--------|
| G1 | XMTP + SIWE auth | ✅ Producción |
| G2 | Fee Juice bridging | ✅ Código listo — falta activar Alpha en Railway |
| G3 | Testnet public node | ✅ Configurado |
| G4 | OPFS cifrado + integridad manifest | ✅ Implementado |
| G5 | COOP/COEP headers para WASM | ✅ Implementado |
| G6 | Sesión E2E two-browser real | 🔶 Pendiente prueba manual |
| G7 | Peer binding (G7 badge) | ✅ Código + UI lista |
| G8 | Auditoría externa | ⬜ **Bloqueante para mainnet público** |

---

## Lo que ya está 100% en el código (no hace falta nada más)

- ✅ `ZkBridgePortal` / `FeeJuiceStation` — UI completa de bridging de Fee Juice
- ✅ `AlphaNetworkBanner` — banner "Aztec Alpha · real funds · unaudited" en el chat
- ✅ `AlphaInfoBox` — caja de info dentro del wallet panel
- ✅ `networkLabel()` — devuelve "Aztec Alpha" o "Aztec test network" dinámicamente
- ✅ `assertNetworkAllowed()` — rechaza nodos en la red equivocada
- ✅ `assertNodeFeeJuiceMatchesPins()` — verifica contratos L1 contra pins
- ✅ `currentValueMode()` — control de exits-only desde servidor sin redeploy
- ✅ Gate de doble variable (`NETWORK=alpha` + `ALPHA_ENABLED=true`) — protección contra error tipográfico
- ✅ Build limpio, 1195 tests pasados, TypeScript sin errores

---

## Recomendación de secuencia

```
Hoy:  Poner variables Railway + testear Fee Juice con 0.001 ETH real
      → si funciona, ya puedes decir "estamos en Aztec Alpha"
      
Esta semana: Grabar sesión G6 two-browser en Alpha
      
Antes de publicidad masiva: Contratar auditoría G8 (Zellic, Trail of Bits, OtterSec)
      → con auditoría puedes quitar el aviso "unaudited"
```
