# Legacy communities: read-only, with a way out to MLS

**Decision:** 25 November 2026, Stefan Antonio Cirisanu ("read-only with notice, and the option to re-create on MLS").
**State:** real in tests (`test/unit/communities/legacy-read-only.test.ts`, route tests with a mocked database). Not yet tried with two accounts on a device.
**Code:** `lib/communities/legacy.ts` (the rule), `lib/communities/recreate.ts` (the client calls), `components/communities/CommunityReader.tsx` (the notice).

## Why

Since 24 November 2026 a new community keeps its posts in an XMTP MLS group: our server never receives them. Communities made before that store their posts in PostgreSQL, where our server can read them. Letting those communities keep growing would mean more readable posts every day, on a screen that sits next to encrypted ones.

We do not migrate them silently. Posts the server could read cannot become private afterwards ("encrypted later" protects nothing that was already stored), and moving them into an encrypted group would make it look as if they had always been private.

## What changes

| Who | Before | Now |
|---|---|---|
| Anyone posting in a legacy community | Post stored, readable by our server | 410 `COMMUNITY_LEGACY_READ_ONLY`; nothing is written |
| System notices ("X joined", "X was added") | Stored as posts | Not written for legacy communities |
| Members reading | Old posts | The same old posts, unchanged |
| The screen | Composer | A notice: why it is read-only, and what happens next |
| Creating a community while XMTP is not ready | A server-readable community | Not created (409 `MLS_REQUIRED`); the person is told to try again |
| Owner or admin | — | "Re-create it end-to-end encrypted", once |
| Members, once re-created | — | "Join the encrypted community": their choice; nobody is added for them |

Re-creating makes a new community with the same name, description and privacy, on MLS, with only its creator as member. The old community stores the new one's id in `successorId` (set only while empty, so two taps cannot point it at two communities). Old posts are not copied.

A member who follows joins through `POST /api/chat/communities/join` with `{ fromCommunityId }`. The server checks that they are a member (or the owner) of the old community and that it has a successor; someone who was not a member gets the same 404 as a missing community. The admin's client then adds them to the encrypted group, as for any MLS community.

## Switches (operator only, server environment)

- `COMMUNITY_LEGACY_READONLY=off` reopens posting in legacy communities: the routes behave exactly as before this change.
- `COMMUNITY_MLS_NEW=off` (existing switch) creates communities without MLS again. It also reopens legacy communities, since otherwise nobody could post anywhere.

## Verify

```bash
npx vitest run test/unit/communities/legacy-read-only.test.ts test/communities/r17-acceptance.test.ts test/unit/security/communities-access.test.ts
```

## Limits

- Old posts stay readable by our server. They are not exported for members, and they are not deleted. Deleting is irreversible and needs an explicit decision.
- Who is a member of which community, and when, stays visible to our server and to XMTP, for old and new communities.
- Community apps (`CommunityApp`, `CommunityAppEntry`) stay server-readable; their screen says so.
- Pinning an old post is still allowed: it changes no content.
- The in-memory demo communities (`lib/communities/in-memory-communities.ts`) are not in the database and are not affected.
- Not yet tried end to end with two accounts on Safari iOS and Chrome Android.
