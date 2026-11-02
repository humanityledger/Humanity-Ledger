/**
 * formatQd
 * Uniform formatter for Quantum Dots to ensure Ledger Chat and Portfolio show the exact same representation.
 */
export function formatQd(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  
  // Return exactly 4 decimals as mandated, or up to 4 decimals
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}
