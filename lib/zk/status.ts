export type ZKStatus = 'active' | 'proving' | 'disabled';

export function getZKStatus(): ZKStatus {
  if (process.env.ZK_PROVING_ENABLED === 'false') return 'disabled';
  return 'active';
}

export function isZKAvailable(): boolean {
  return getZKStatus() === 'active';
}
