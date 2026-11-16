# Constants (comments only)

Not a source file. Do not compile. Numbers are the authorized D5 baseline. No other numbers are introduced here.

```text
// Escrow settlement only.
// FEE_BPS = 50
// MIN_FEE = 1000          // base units; 0.001 HLC at 6 decimals
// MAX_FEE_SHARE_BPS = 1000
// TX_CAP = 5000000        // base units; refuse when fee is above this; do not clamp
// DAILY_CAP             // rejected; do not declare this constant

// Stream withdrawal only.
// STREAM_MIN_FEE = 0

// TREASURY
// Unset. Section 6 D-4: an Aztec account of the 4-of-7 multisig.
// Do not substitute a zero address. Do not invent an address in this skeleton.
```

The section 6 D-2 cell still prints `minFee = 1` as its original placeholder sentence. The escrow minimum authorized for a future compile is `MIN_FEE = 1000` above. `FEE_BPS` and `MAX_FEE_SHARE_BPS` match that cell (50 and 1000).

Network gas stays Fee Juice and stays public. These constants are the protocol fee, in the agreement token.
