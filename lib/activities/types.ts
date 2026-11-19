/**
 * Live activities: the one model behind the island, the floating call window and, later, iOS.
 *
 * Every activity has two halves, the same split ActivityKit uses:
 *   - attributes: fixed for the life of the activity (who, which token) -> ActivityAttributes
 *   - state:      what changes while it runs (phase, step, timer)        -> ContentState
 * Both halves are plain serialisable data, so a native bridge can send them to ActivityKit
 * unchanged. Media streams and callbacks never live here (see call-media.ts).
 *
 * Privacy by construction: no field can hold the text of a message.
 *   - Names are `DisplayName`, a branded string that only `toDisplayName()` makes: one line,
 *     at most 32 characters, control characters removed. Passing a message body by accident is a
 *     type error, and even a forced cast is cut to a short single line.
 *   - Amounts are `Amount`: a decimal string and a token symbol, both validated.
 *   - There is no free-text field anywhere. Labels come from the presentation registry.
 *
 * ActivityKit mapping (for the native app):
 *   kind             attributes          state                 compact L / R        minimal
 *   call             peer, media         phase, connectedAt..  status dot / timer   phone
 *   paymentProof     to, amount          step                  ring / step          ring
 *   paymentReceived  from, amount        receivedAt            arrow / amount       arrow
 *   recording        peer                startedAt             red dot / timer      red dot
 *   message          from                count                 bubble / name        bubble
 *   session          -                   status                ring / label         ring
 */

declare const displayNameBrand: unique symbol;
/** A short, single-line name made by toDisplayName(). Never a message body. */
export type DisplayName = string & { readonly [displayNameBrand]: true };

declare const symbolBrand: unique symbol;
/** A token symbol such as HLC: 1 to 8 upper-case letters or digits. */
export type TokenSymbol = string & { readonly [symbolBrand]: true };

/** An amount as the user reads it: decimal digits (at most 18 after the point) and a symbol. */
export interface Amount {
  readonly value: string;
  readonly symbol: TokenSymbol;
}

export type MediaKind = 'audio' | 'video';

export type CallPhase =
  | 'outgoing' // we are calling, the other side has not answered
  | 'incoming' // the other side is calling us
  | 'connecting' // answered, media on its way
  | 'active' // connected; connectedAt is set
  | 'reconnecting' // the network changed; the call is being resumed
  | 'ended'; // shown briefly, then removed

export type ProofStep = 'preparing' | 'proving' | 'sending' | 'settled' | 'failed';

export type SessionStatus = 'signing-in' | 'offline' | 'online' | 'syncing';

export interface Attributes {
  call: { readonly peer: DisplayName; readonly media: MediaKind };
  paymentProof: { readonly to: DisplayName; readonly amount: Amount };
  paymentReceived: { readonly from: DisplayName; readonly amount: Amount };
  recording: { readonly peer: DisplayName };
  message: { readonly from: DisplayName };
  session: Record<string, never>;
}

export interface ContentState {
  call: {
    readonly phase: CallPhase;
    /** ms since epoch; set once the call is active. The timer counts from here. */
    readonly connectedAt?: number;
    readonly micMuted: boolean;
    readonly cameraOff: boolean;
    /** The other side is sending live video. */
    readonly remoteVideo: boolean;
    /** Duration in seconds, set when phase is 'ended'. */
    readonly endedAfter?: number;
  };
  paymentProof: { readonly step: ProofStep; readonly updatedAt: number };
  paymentReceived: { readonly receivedAt: number };
  recording: { readonly startedAt: number };
  message: { readonly count: number };
  session: { readonly status: SessionStatus };
}

export type ActivityKind = keyof Attributes;

export interface Activity<K extends ActivityKind = ActivityKind> {
  readonly id: string;
  readonly kind: K;
  readonly attributes: Attributes[K];
  readonly state: ContentState[K];
  readonly startedAt: number;
  /** After this time (ms since epoch) the activity is removed even if nobody ended it. */
  readonly staleAt?: number;
}

/** Any activity, narrowed by its kind. */
export type AnyActivity = { [K in ActivityKind]: Activity<K> }[ActivityKind];

/**
 * Where the call is drawn. One value for the whole app, so the call is never on screen twice:
 *   stage   full screen, inside the chat
 *   window  the floating window (or the browser's picture in picture)
 *   island  a compact capsule in the island
 */
export type CallPresentation = 'stage' | 'window' | 'island';
