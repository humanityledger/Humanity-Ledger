/**
 * lib/security/ipPolicy.ts
 *
 * Which IP addresses a server-side fetch of a user-supplied URL may connect to.
 *
 * The rule is "public unicast only". Everything else is refused: loopback,
 * private and shared ranges, link-local (cloud metadata lives there),
 * documentation and benchmark ranges, multicast, reserved space, and the IPv6
 * forms that embed an IPv4 address (mapped, compatible, NAT64, 6to4, Teredo),
 * because each of those can be turned back into a private IPv4 target.
 *
 * This works on IP addresses only. Hostnames must be resolved first and every
 * resolved address checked; lib/security/publicFetch.ts does that inside the
 * socket's DNS lookup, so the address that is checked is the one connected to.
 */

import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();

const V4: Array<[string, number]> = [
  ['0.0.0.0', 8],        // "this network"
  ['10.0.0.0', 8],       // RFC 1918
  ['100.64.0.0', 10],    // RFC 6598 carrier-grade NAT (also Alibaba metadata)
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local, cloud metadata (169.254.169.254, 169.254.170.2)
  ['172.16.0.0', 12],    // RFC 1918
  ['192.0.0.0', 24],     // IETF protocol assignments
  ['192.0.2.0', 24],     // TEST-NET-1
  ['192.88.99.0', 24],   // 6to4 relay anycast
  ['192.168.0.0', 16],   // RFC 1918
  ['198.18.0.0', 15],    // benchmarking
  ['198.51.100.0', 24],  // TEST-NET-2
  ['203.0.113.0', 24],   // TEST-NET-3
  ['224.0.0.0', 4],      // multicast
  ['240.0.0.0', 4],      // reserved, includes 255.255.255.255
];

const V6: Array<[string, number]> = [
  ['::', 96],            // unspecified, loopback and IPv4-compatible (::7f00:1)
  ['::ffff:0:0', 96],    // IPv4-mapped
  ['64:ff9b::', 96],     // NAT64 well-known prefix
  ['64:ff9b:1::', 48],   // NAT64 local-use
  ['100::', 64],         // discard-only
  ['2001::', 32],        // Teredo
  ['2001:db8::', 32],    // documentation
  ['2002::', 16],        // 6to4
  ['fc00::', 7],         // unique local (includes fd00:ec2::254, AWS metadata)
  ['fe80::', 10],        // link-local
  ['fec0::', 10],        // deprecated site-local
  ['ff00::', 8],         // multicast
];

// Two lists, not one: a single BlockList also matches IPv4 addresses against
// its IPv6 rules in their ::ffff: mapped form, so the ::ffff:0:0/96 rule
// would block every IPv4 address on the internet.
const blockedV6 = new BlockList();
for (const [net, prefix] of V4) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of V6) blockedV6.addSubnet(net, prefix, 'ipv6');

/** Strip the brackets URL.hostname keeps around IPv6 literals, and any zone id. */
export function normalizeIpLiteral(host: string): string {
  return host.replace(/^\[/, '').replace(/\]$/, '').replace(/%.*$/, '').toLowerCase();
}

/**
 * True when the address must not be connected to. Anything that is not a
 * valid IP address counts as blocked, so a caller that forgot to resolve a
 * hostname fails closed.
 */
export function isBlockedIp(address: string): boolean {
  const ip = normalizeIpLiteral(address);
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) return blockedV6.check(ip, 'ipv6');
  return true;
}

/** True when the string is an IPv4 or IPv6 literal (brackets allowed). */
export function isIpLiteral(host: string): boolean {
  return isIP(normalizeIpLiteral(host)) !== 0;
}
