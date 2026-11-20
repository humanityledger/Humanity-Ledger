/**
 * Ledger Chat's own icon set for the rail and the chats header.
 *
 * Geometry (every icon):
 *   - 24 × 24 grid, live area 3–21 (an 18-unit square), optical centre at 12,12.
 *   - One stroke weight (1.6 at 24 px, scaled with the icon), round caps and joins, no fills,
 *     so the set reads as one family at 18–24 px on white.
 *   - Corners: radius 3 on large shapes, 1.5 on small ones. Circles that must read as round
 *     are drawn 0.5 unit larger than squares of the same nominal size (optical balance).
 *   - Each glyph has one idea: a bubble (chats), a handset (calls), a ring with a mark (status),
 *     a person with an index line (contacts), a note with a shield cut (private payments),
 *     three linked heads (communities), a gear with eight teeth (settings: tips on r 9, roots on
 *     r 6.9, one closed outline plus a hub of r 2.75, so it reads as a gear and not as a sun).
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number; weight?: number };

function Svg({ size = 22, weight = 1.6, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

/** A speech bubble with a short square tail at the lower left. */
export const ChatsIcon = (p: P) => (
  <Svg {...p}><path d="M6 4.5h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H10l-4.5 3v-3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z" /><path d="M8 10h8M8 13h5" /></Svg>
);

/** A handset at 45°, ear and mouth pieces as rounded ends. */
export const CallsIcon = (p: P) => (
  <Svg {...p}><path d="M5.2 3.8l3 .4 1.3 3.6-1.9 1.6a11 11 0 0 0 7 7l1.6-1.9 3.6 1.3.4 3a1.7 1.7 0 0 1-1.8 1.8C10.7 20.2 3.8 13.3 3.4 5.6a1.7 1.7 0 0 1 1.8-1.8z" /></Svg>
);

/** A ring broken at the top right, with a centre mark: something posted for a while. */
export const StatusIcon = (p: P) => (
  <Svg {...p}><path d="M18.4 7.2A8.5 8.5 0 1 1 12 3.5" /><circle cx="12" cy="12" r="3.2" /><path d="M16.2 3.9l1.6.9" /></Svg>
);

/** A person (head and shoulders) beside two index lines. */
export const ContactsIcon = (p: P) => (
  <Svg {...p}><circle cx="9.5" cy="9" r="3.3" /><path d="M3.5 19a6 6 0 0 1 12 0" /><path d="M17.5 8h3M17.5 12h3" /></Svg>
);

/** A folded note with a shield-shaped cut: a private payment on Aztec. */
export const PaymentsIcon = (p: P) => (
  <Svg {...p}><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="M3 9.5h18" /><path d="M14.5 13.2l2-.8 2 .8v1.6c0 1-.8 1.8-2 2.2-1.2-.4-2-1.2-2-2.2z" /></Svg>
);

/** Three heads joined by one line: a community. */
export const CommunitiesIcon = (p: P) => (
  <Svg {...p}><circle cx="12" cy="7" r="2.6" /><circle cx="5.5" cy="15.5" r="2.6" /><circle cx="18.5" cy="15.5" r="2.6" /><path d="M10.6 9.3l-3.4 4M13.4 9.3l3.4 4M8.1 15.5h7.8" /></Svg>
);

/** A dial with eight short teeth and an open centre. */
export const SettingsIcon = (p: P) => (
  <Svg {...p}><path d="M10.21 5.34L10.51 3.12A9 9 0 0 1 13.49 3.12L13.79 5.34A6.9 6.9 0 0 1 15.45 6.02L17.23 4.67A9 9 0 0 1 19.33 6.77L17.98 8.55A6.9 6.9 0 0 1 18.66 10.21L20.88 10.51A9 9 0 0 1 20.88 13.49L18.66 13.79A6.9 6.9 0 0 1 17.98 15.45L19.33 17.23A9 9 0 0 1 17.23 19.33L15.45 17.98A6.9 6.9 0 0 1 13.79 18.66L13.49 20.88A9 9 0 0 1 10.51 20.88L10.21 18.66A6.9 6.9 0 0 1 8.55 17.98L6.77 19.33A9 9 0 0 1 4.67 17.23L6.02 15.45A6.9 6.9 0 0 1 5.34 13.79L3.12 13.49A9 9 0 0 1 3.12 10.51L5.34 10.21A6.9 6.9 0 0 1 6.02 8.55L4.67 6.77A9 9 0 0 1 6.77 4.67L8.55 6.02A6.9 6.9 0 0 1 10.21 5.34Z" /><circle cx="12" cy="12" r="2.75" /></Svg>
);

/** A bell with a flat lip. */
export const BellIcon = (p: P) => (
  <Svg {...p}><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" /><path d="M10.2 20.5a2 2 0 0 0 3.6 0" /></Svg>
);

/** A person with a plus: new group. */
export const NewGroupIcon = (p: P) => (
  <Svg {...p}><circle cx="9.5" cy="9" r="3.3" /><path d="M3.5 19a6 6 0 0 1 12 0" /><path d="M18.5 7v6M15.5 10h6" /></Svg>
);

/** A plus, optically 0.5 shorter than the grid so it does not look larger than the others. */
export const PlusIcon = (p: P) => (
  <Svg {...p}><path d="M12 5.5v13M5.5 12h13" /></Svg>
);
