export type ZKStatus = 'active' | 'mock' | 'disabled';

export function getZKStatus(): ZKStatus {
  if (process.env.NODE_ENV !== 'production') return 'mock';
  if (process.env.ZK_PROVING_ENABLED === 'true') return 'active';
  return 'disabled';
}

export function isZKAvailable(): boolean {
  return getZKStatus() === 'active';
}
