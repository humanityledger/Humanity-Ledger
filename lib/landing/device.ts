/**
 * Which landing a request gets: the mobile tree (components/landing/mobile) for phones, the
 * immersive desktop tree for everything else, tablets and iPads included.
 *
 * A phone is a request whose user agent parses as a mobile device (userAgent() from next/server,
 * ua-parser), or that sends the client hint Sec-CH-UA-Mobile: ?1. iPadOS Safari reports a desktop
 * Mac user agent and Android tablets report "tablet", so both keep the desktop tree.
 *
 * The answer depends on request headers, so every response for / carries
 * Vary: User-Agent, Sec-CH-UA-Mobile and Accept-CH: Sec-CH-UA-Mobile (middleware.ts): no cache
 * serves one tree to the other.
 */
import { userAgent } from 'next/server';

type HeaderSource = { get(name: string): string | null };

export const LANDING_VARY = 'User-Agent, Sec-CH-UA-Mobile';
export const LANDING_ACCEPT_CH = 'Sec-CH-UA-Mobile';
/** Request header set by the middleware for / only, read by the root layout. */
export const LANDING_TREE_HEADER = 'x-hl-landing';

export function isPhoneRequest(headers: HeaderSource): boolean {
  if (headers.get('sec-ch-ua-mobile') === '?1') return true;
  const ua = headers.get('user-agent') ?? '';
  if (!ua) return false;
  const { device } = userAgent({ headers: headers as unknown as Headers });
  return device.type === 'mobile';
}
