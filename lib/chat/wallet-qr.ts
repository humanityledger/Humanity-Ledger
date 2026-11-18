/**
 * The wallet address inside a QR code from any wallet (18 November 2026, "scan another wallet's
 * code at a meeting and talk to it").
 *
 * Wallets encode an address in different ways:
 *   0xAbC…                                   a bare address (most wallets)
 *   ethereum:0xAbC…@1  ethereum:0xAbC…?value=…  EIP-681, with a chain id or parameters
 *   ethereum:pay-0xAbC…                      EIP-681 with a "pay-" prefix
 *   ethereum:0xToken…/transfer?address=0xAbC… a token transfer: the recipient is `address`
 *   https://…/address/0xAbC…  https://link.trustwallet.com/send?address=0xAbC…  wallet and explorer links
 *
 * Returns the recipient's address, checksummed or not as written, or null when the text holds no
 * Ethereum address. Ledger Chat profile links and @usernames are handled before this, by the
 * caller. An Aztec address (0x + 64 hex) is returned whole when it is the entire text.
 */
const EVM = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;

export function walletAddressFromQr(raw: string): string | null {
  const text = (raw || '').trim();
  if (!text) return null;
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) return text; // an Aztec address, as Ledger Chat shows it
  if (/^0x[0-9a-fA-F]{40}$/.test(text)) return text;
  // EIP-681 token transfer: the token contract comes first, the recipient is the `address` parameter.
  const param = /[?&](?:address|to|recipient)=(0x[0-9a-fA-F]{40})(?![0-9a-fA-F])/i.exec(text);
  if (param) return param[1];
  const all = text.match(EVM);
  return all && all.length ? all[0] : null;
}
