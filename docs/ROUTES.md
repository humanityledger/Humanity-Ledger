# Humanity Ledger — Routing Index
*Rewritten: 2026-11-11 from `app/**/page.tsx`. The earlier index described routes of products that were removed (hub, terminal, portfolio, ledger, passport).*

Ledger Chat is the only product. This list is regenerated from the files in `app/`; if a page is added or removed, update it in the same change.

## Pages that exist

| Route | Purpose |
|---|---|
| `/` | Home page |
| `/connect` | Sign in with an EVM wallet (EIP-4361) |
| `/chat` | Ledger Chat: XMTP direct messages, private payments and agreements (Aztec test network) |
| `/communities`, `/communities/[slug]` | Communities (stored by the server, readable by it) |
| `/join/[code]` | Join a community with an invite code |
| `/scan` | QR scanner |
| `/settings`, `/settings/notifications` | Settings |
| `/studio` | Community app generator |
| `/docs`, `/docs/[slug]`, `/docs/audits`, `/docs/whitepaper` | Documentation (pages defined in `lib/docs/pages/`) |
| `/legal/{terms,privacy,cookies,retention,dmca,ownership}`, `/terms`, `/privacy` | Legal pages |

## Pages that were removed

Old links are redirected by `middleware.ts` using `lib/security/retiredRoutes.ts` (`RETIRED_PAGES`): `/hub`, `/terminal`, `/dashboard`, `/portfolio`, `/markets`, `/ledger`, `/forum` (to `/communities`) and the rest of that list go to `/chat`, `/` or a documentation page.

## API routes

- Routes that nothing in the repository calls are answered with 410 at the edge before any handler runs (`RETIRED_API_ROUTES`). The 2026-11-11 audit added 55 more (terminal, forum, market, network, wallet and academy products).
- Cron, webhook, admin, public-API (`/api/v1`) and privacy routes are never retired by this audit because they are called from outside the repository.
- `GET /api/aztec/value-mode` is public and returns only `{ "mode": "open" | "exits-only" }`.
- A second pass the same day retired 21 more routes with no caller and no planned UI: calls (`/api/call/*`), community invite tokens and token gates, `/api/auth/{me,check-email,kyc-qr-poll,studio,qr-sync-seed}`, `/api/identity/token`, `/api/aztec/{anchor,deploy-token,migrate-identity,sequencer/*}`, `/api/chat/telemetry` and `/api/moderation/status`. The UI uses the community `joinCode`. To bring one back, delete its line in `RETIRED_API_ROUTES` and review its authentication first.
- The community app routes (`/api/chat/communities/[id]/apps/**`) are used by the UI and stay.
