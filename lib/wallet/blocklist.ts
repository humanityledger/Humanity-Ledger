// lib/wallet/blocklist.ts
// The block list has one home: lib/chat/blockList.ts (encrypted vault, synced
// across the account's devices, mirrored to XMTP consent and the server).
// This module only re-exports it so wallet code never grows a second list.
export { loadBlockList as getBlockList, setBlocked, isPeerBlocked, normalizeBlockList } from '@/lib/chat/blockList';
