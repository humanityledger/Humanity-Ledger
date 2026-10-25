# Arranque local, sin Railway

Todo corre en tu máquina. Postgres y Redis salen de `docker-compose.yml`, que ya está en el repositorio. No hace falta ninguna cuenta de pago.

## 1. Base de datos y caché

```bash
docker compose up -d postgres redis
```

Solo esos dos servicios. El servicio `app` del compose construye el `Dockerfile` entero, que no necesitas para desarrollar, y `aztec-sandbox` descarga una imagen grande que solo hace falta si vas a tocar contratos.

Levanta Postgres en `localhost:5432` (usuario `postgres`, contraseña `postgres`, base `humanity_ledger`) y Redis en `localhost:6379`.

## 2. Variables de entorno

Crea `.env.local` en la raíz:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/humanity_ledger"
REDIS_URL="redis://localhost:6379"

# Obligatoria: middleware.ts lanza al arrancar si falta.
# Genera una: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET="<pega aquí los 96 caracteres>"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Deja el guard de texto plano en modo informe mientras los clientes
# no sellen el cuerpo del mensaje. Ponlo a true solo cuando lo hagan.
CHAT_REQUIRE_SEALED_ENVELOPE="false"
```

Si usas un puerto distinto del 3000, añade `APP_ALLOWED_ORIGINS="http://localhost:PUERTO"` o las mutaciones responderán 403: el CSRF del middleware ahora falla cerrado.

Las claves de terceros (WalletConnect, Moralis, Stripe) no hacen falta para que arranque. `next.config.js` rellena `MORALIS_API_KEY` con un valor de relleno si no existe. Las pantallas que dependan de esos servicios fallarán por su cuenta, no al arrancar.

## 3. Esquema

```bash
npx prisma generate
npx prisma db push
```

`db push` sobre una base local vacía es lo correcto. En producción no: ahí va `prisma migrate deploy`.

## 4. Arrancar

```bash
npm install
npm run dev
```

Queda en **http://localhost:3000**. Ledger Chat está en **http://localhost:3000/chat**.

## 5. Comprobar lo que se cambió

```bash
npx vitest run test/unit/security      # perímetro y guard de texto plano
npx tsc --noEmit                       # tipos (no se ha ejecutado aún)
npx playwright test e2e/shielded-balance-privacy.spec.ts
```

Los tests e2e levantan el servidor solos: `playwright.config.ts` tiene `webServer` apuntando a `npm run dev`.

## Dos cosas que te van a morder

**El geobloqueo.** `middleware.ts` devuelve 451 a las rutas protegidas si la cabecera `x-vercel-ip-country` o `cf-ipcountry` trae US, CU, IR, KP, SY, RU o BY. En local no llega ninguna de las dos, así que no te afecta — pero si pruebas detrás de un proxy que las inyecte, lo vas a ver.

**La página `/chat` es pública.** Está en `PUBLIC_PATHS` con el comentario de que gestiona su propia autenticación. La página carga sin sesión; las rutas de API que usa, no.

## Lo que todavía no está comprobado

Esta guía se escribió leyendo `docker-compose.yml`, `package.json` y `middleware.ts`, no ejecutándolos. No se ha arrancado la aplicación ni una sola vez desde la sesión que la escribió.

## Community apps (optional)

The Apps tab of a community works without any extra setup for the four ready-made apps (poll, sign-up, shared list, "when can we meet"). Writing an app from a description needs a language model on the server, set in `.env.local`:

```
ANTHROPIC_API_KEY=...            # Anthropic Messages API (default model: claude-sonnet-5-5)
# or any OpenAI-compatible server, including a local one:
OPENAI_API_KEY=...
OPENAI_BASE_URL=http://localhost:11434/v1
COMMUNITY_APPS_MODEL=...         # required with OPENAI_API_KEY; overrides the Anthropic default otherwise
```

Only the member's description (and, when revising, the app's current code) is sent to the provider. The tables are `CommunityApp` and `CommunityAppEntry` (migration `20261023190000_community_apps`). How the sandbox works: `lib/community-apps/framePolicy.ts`.
