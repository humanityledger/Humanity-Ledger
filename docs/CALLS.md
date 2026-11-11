# 1:1 calls: how they connect, recover and how to check them

Ledger Chat calls are peer to peer (WebRTC through PeerJS), encrypted with DTLS-SRTP between the two
browsers. No media server: the app never holds call audio or video. XMTP carries the ring, answer,
decline and hang-up signals; PeerJS carries the WebRTC offer, answer and candidates.

## Pieces

| Piece | Where | Purpose |
|---|---|---|
| Media settings | `lib/calls/media.ts` | Mic processing (echo cancellation, noise suppression, gain), 720p30 camera, Opus for speech (FEC, mono, 32 kbps), RED preferred, voice sent at high priority, ICE list, PeerServer options |
| Recovery and voice→video | `lib/calls/resume.ts` + `LedgerChatV2.tsx` | Make-before-break "resume" connections |
| TURN credentials | `GET /api/calls/ice` | Short-lived TURN credentials, signed-in sessions only |
| Call screens | `components/chat/call/CallScreens.tsx` | Clock and voice pulse that never re-render the chat |

### Recovery (network change, Wi-Fi ↔ mobile, a dropped path)

PeerJS cannot renegotiate a running connection, and closes it when ICE fails. So:

1. ICE `disconnected` for 2.5 s (or the connection closing) on a running call starts a recovery;
   the call is not ended. Screen: "Reconnecting…".
2. The caller (or the side whose peer id changed) dials a new connection to the same person,
   `metadata.kind = 'resume'`. A new connection gathers fresh candidates on the new network.
3. The other side answers it only during that call and only from the same account's peer id.
4. When the new connection carries the other person, it replaces the old one, which is then closed.
   If the old path recovers first, it is kept and the attempt is dropped.
5. After 25 s without success, the call ends on both sides ("The call lost its connection").

Losing the PeerJS signalling socket during a call no longer destroys the peer (that used to end
every call on a network change). The socket reconnects every 3 s with the same id.

### Voice → video

The camera button is shown in voice calls. Turning it on adds a camera track and sends it on a
resume connection (`reason: 'upgrade'`); the voice keeps going on the old connection until the new
one carries the call. The other side sees the video and can turn on its own camera the same way.
If the other app cannot take it (an older version), the camera is turned off again and the voice
call goes on.

Both sides need this version for recovery, screen sharing and the switch to video. With an older
app on the other side, calls behave as before.

## Server variables (Railway)

TURN is what connects calls behind mobile carriers (CGNAT), strict routers and many public Wi-Fi
networks, and what "Hide my IP address in calls" relies on. Set ONE option, as server variables
(never `NEXT_PUBLIC_`):

| Option | Variables |
|---|---|
| Cloudflare Realtime TURN (recommended) | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` |
| coturn with `static-auth-secret` | `TURN_URLS` (comma-separated `turn:`/`turns:` URLs), `TURN_SECRET` |
| Fixed credentials | `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` |

Credentials live 6 h; browsers fetch new ones 15 min before they expire, so long sessions keep
working TURN. Without any of these, calls use a free public relay as last resort, which is not
reliable.

### Own signalling server (optional, recommended)

By default PeerJS uses its free public cloud server (shared, best effort). One small Railway
service from the `peerjs/peerjs-server` image removes that dependency. Then set, as build
variables: `NEXT_PUBLIC_PEERJS_HOST` (e.g. `peer.ledgerchat.org`), and if needed
`NEXT_PUBLIC_PEERJS_PORT` (default 443), `NEXT_PUBLIC_PEERJS_PATH` (default `/`),
`NEXT_PUBLIC_PEERJS_KEY`. TLS is always used. All clients must use the same server: during the
switch, people on a page loaded before the deploy cannot reach people on the new one until they
reload.

## What the screen shows, state by state

| State | Screen |
|---|---|
| calling | "Calling", with your own camera (mirrored) for a video call; Cancel stops the other phone ringing |
| ringing | Incoming call: Decline, Answer |
| connecting | The call screen with "Connecting" (it used to show the chat for up to 30 s) |
| active | Voice: name and clock; video: the other person's camera, yours small and mirrored |
| reconnecting | "Reconnecting…" (voice: under the name; video: a pill; minimised: the green bar) |
| voice refused by the browser (iOS) | "Tap to hear …" button above the controls |
| screen shared to you | Their screen over the call; it goes away as soon as they stop |

## Measurements

Each call records, on the device only (`lib/calls/metrics.ts`): time to the other person's stream
(`setupMs`), time to their voice playing (`firstAudioMs`), route (direct or relay) and round trip,
recoveries, and JavaScript memory every 30 s (Chrome and Edge). The last 10 calls are in
`sessionStorage["hl.call.metrics"]`; in the console, `window.__ledgerCalls` after a call ends.

## Validation checklist (two real devices)

Do each on two devices signed in as different accounts, with the browser console open where you can.

1. **TURN is served.** Signed in, open `/api/calls/ice`: `source` is `cloudflare` (or `coturn`,
   `static`) and `iceServers` has `turn:` URLs. `none` means no TURN is configured.
2. **Relay works.** Turn on Settings → "Hide my IP address in calls" on one side (relay only) and
   call. It must connect. In `chrome://webrtc-internals` the selected candidate pair is `relay`.
3. **Mobile ↔ Wi-Fi.** Phone on 4G/5G (Wi-Fi off), computer on Wi-Fi: voice and video calls connect,
   both hear each other, no echo.
4. **Time to first audio.** From tapping Answer to hearing the other person: target under 2 s on
   Wi-Fi, under 3 s through TURN.
5. **Network change.** During a call, switch the phone from Wi-Fi to mobile data. Expected:
   "Reconnecting…" then the call continues within a few seconds, same clock. If it cannot, it ends
   on both sides within 25 s.
6. **Voice → video.** In a voice call, tap the camera: the other side sees you within a few
   seconds; the voice is not interrupted. The other side taps its camera: both see each other.
7. **Screen sharing** (desktop): share in a voice call and in a video call; "Stop" and the browser's
   own stop button both end it; hang-up ends it.
8. **Loss.** In `chrome://webrtc-internals`, `inbound-rtp` (audio): `concealedSamples` stays low and
   `packetsLost` / `packetsReceived` under 2 % on a normal network. With RED negotiated (Chrome/Edge
   on both sides) the audio codec shows `red`.
9. **Hang-up and decline** end the call on both sides, and the call log shows the real duration.
10. **Measurements.** After each call, in the console, `window.__ledgerCalls.at(-1)`: `firstAudioMs`
    under 2000 on Wi-Fi, under 3000 through TURN; `heapMb` stays flat over a 30-minute call.
11. **Cancel while ringing.** Caller cancels: the callee's phone stops ringing at once.
12. **Devices released.** After a call the camera light is off and the browser shows no microphone
    in use.

## Known limits

- PeerJS peer ids are derived from the account address and are not authenticated by the signalling
  server: someone who registers another person's id first could receive a call meant for them
  (the media stays encrypted, but to the wrong endpoint). Binding the DTLS fingerprint to the XMTP
  identity would close this; it is not done yet.
- Group calls are separate (community calls) and not covered here.
- Most mobile browsers cannot share their screen.
