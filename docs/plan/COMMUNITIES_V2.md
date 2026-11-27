# Communities V2 — architecture, UX and roadmap

Status: Phase 1 shipped in `feat/communities-v2` (27 Nov 2026). Phases 2–4 are plans, not features.

## 1. Where Communities stood (analysis)

| Area | Before V2 | Problem |
|---|---|---|
| Creation | `LedgerCommunitiesTab` made the MLS group only if the XMTP client was already open; otherwise the server answered `MLS_REQUIRED` | Creating failed for anyone whose encryption was still starting — the most common case right after sign-in |
| Posts | `CommunityReader`: text only, one textarea, Send the only action | No photos, files, voice, polls; links not tappable |
| Media | None | Nothing to browse |
| Members | Count in the header; list only inside Manage | Avatars and names not tappable; no profile, no Message/Pay |
| Roles | Server: OWNER (ownerAddress), ADMIN, MODERATOR, MEMBER (`/api/chat/communities/[id]/members`) | UI showed admin/member only |
| Privacy | New communities on XMTP MLS since 24 Nov 2026; legacy ones read-only | Correct — kept |

## 2. Architecture

```
CommunityReader (screen)
 ├─ header: Shared media · Members · Manage
 ├─ posts: PostBody (attachment | large file | GIF | voice | poll | text+links)
 │          avatar/name → MemberSheet
 ├─ composer (MLS only): Attach (prepareAttachmentMessage) · Poll (PollComposer) · Send
 ├─ CommunityMediaSheet  ← lib/communities/media-index.ts (pure, on device)
 ├─ MembersPanel / MemberSheet ← lib/communities/roles.ts (pure) + members API
 └─ PollCard tallies votes from every group message (one vote per member, last wins)
CreateCommunitySheet: Basics → Who can join (+welcome) → Invite (link + QR)
```

Principles:
- **The server never sees content of new communities.** Posts, attachments, votes and the media index live in the XMTP MLS group and on the device. Attachments use the existing pipeline: encrypted in the browser, ciphertext on our storage, key only inside the MLS message.
- **One message format everywhere.** Communities reuse the private-chat formats (`hl.attachment`, `hl.largefile`, `[GIF]`, `__POLL__`, `__VOTE__`), so a renderer improvement helps both.
- **Pure logic, tested.** Classification, poll tallies and the role matrix are pure modules with unit tests; components only render.
- **The server stays authoritative for membership and roles.** The UI shows an admin action only to someone who outranks the target (`canActOn`); the members route checks again.

## 3. UX specification (Phase 1, shipped)

- **Create**: three steps with a progress indicator. Name (60), optional description (280), a 10 × 10 mosaic preview derived from the name, Public/Private cards, optional welcome message (first encrypted post). While encryption starts, a status line says so (up to 30 s) instead of failing. Done screen: invite link, QR code, Copy, Share (Web Share on phones), Open.
- **Community screen**: header buttons for Shared media and Members; author avatar and name open the member profile; links open in a new tab with `noopener noreferrer nofollow`; photos open in a lightbox.
- **Shared media**: tabs Media · Files · Links · Voice · GIFs · Polls · Music with counts; search; 3-column grid for media and GIFs (thumbnails decrypted only when scrolled into view); full-screen viewer with arrows, Esc and download; files with size/date/download; poll results.
- **Member profile**: avatar (photo or mosaic), name, wallet, role badge, joined date; Message, Pay (opens the private chat with the private payment sheet), Add to contacts, Copy wallet, Report; admin actions (change role, remove) only when allowed.
- **Members list**: search by name or wallet, filter by role, sorted by rank then name.
- **Mobile**: every sheet uses `100dvh`/`92–94dvh`, safe-area insets, bottom-sheet on phones and side sheet on computers, tap targets ≥ 44 px, horizontal tab strips without visible scrollbars.

## 4. Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Reliable creation (waits for encryption), invite link + QR, rich posts (photos, videos, files, voice playback, GIFs, polls with live results, links), Shared Media gallery, member profiles and list, role matrix, Pay from a profile | **Shipped** |
| 2 | Composer parity: voice recording, GIF search (privacy-preserving proxy, no third-party tracking), reactions, replies, forwards, pins inline, in-community search over decrypted posts, typing indicators over MLS, mute/archive per community | Planned |
| 3 | Discovery and management: trending/recommended from public metadata only, join requests for private communities, invite links with expiry and usage limits, admin analytics from server-side metadata only (member counts, joins) | Planned |
| 4 | Scale: channels as separate MLS groups, large public channels as a hybrid (broadcast group + read-only fan-out), installation hygiene so one person does not grow the ratchet tree | Research |

## 5. Database / API

Phase 1 needs **no migration**: it uses `Community`, `CommunityMember.role/joinedAt`, `GET/PATCH/DELETE /api/chat/communities/[id]/members`, `POST /api/moderation/report` and the existing attachment routes. Phase 3 will add `CommunityInvite (code, expiresAt, maxUses, uses)` and `CommunityJoinRequest`.

## 6. Scale roadmap (aligned with the protocol evolution document)

- **MLS group size is a hard constraint.** A community is a composition: one MLS group per channel for trusted spaces (target ≤ 1,500–2,000 members per group, measured before raising), and public metadata (name, description, member count) that can be browsed without joining. Very large public channels are a Phase 4 hybrid, never a weakening of private groups.
- **Media index on the device.** Nothing about what a community shares reaches the server; search runs over decrypted messages locally.
- **Fewer central paths.** Presence and typing move to XMTP-native signals (Phase 2); the server keeps authentication, usernames, membership and public metadata.
- **Private group payments.** Pay from a member profile uses the client-proven Aztec private payment; split bills and community treasuries stay client-proven when they come (Phase 4 research).
- **Measure, then publish.** Each phase records proving time, memory and failure modes on mid-range phones (see `scripts/benchmark-ram.ts`), so the numbers can be shared.

## 7. Edge cases and privacy

- Votes are posts in the encrypted group: members can see who voted for what. The composer says so. Anonymous polls need a different construction (Phase 2 research) and are not offered.
- A member removed from a community starts a new MLS epoch: they cannot read new posts; old posts they already have stay on their device.
- Legacy communities remain read-only; their posts were stored by our server and are never presented as encrypted.
- GIFs and links load from their own sites when shown (that site sees the viewer's IP), with `referrerPolicy="no-referrer"`. A privacy-preserving proxy is Phase 2.
- Membership (who is in a community) is known to our server; the screen says so.
