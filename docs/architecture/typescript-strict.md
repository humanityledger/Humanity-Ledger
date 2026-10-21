# TypeScript Configuration Decision — J-019

## Strict Mode
- `"strict": true` is enabled for all application code in `tsconfig.json`.
- Type safety is enforced in CI via `npx tsc --noEmit`.

## Justification for `skipLibCheck: true`
- The project integrates `@xmtp/browser-sdk` and `@aztec/*` alongside Next.js 15.
- These dependencies define overlapping globals and conflicting utility types in their respective `.d.ts` declaration trees.
- Validating their internal third-party declarations provides zero security benefit to application logic while causing build failures on third-party typos.
- Therefore, `skipLibCheck: true` is intentionally kept for third-party libraries while strict typing is fully enforced for all first-party application source code.
