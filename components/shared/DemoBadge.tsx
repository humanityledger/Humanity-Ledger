'use client';

/**
 * components/shared/DemoBadge.tsx — I-010
 * Uniform badge for all non-real features/screens.
 *
 * Usage:
 *   import { DemoBadge } from '@/components/shared/DemoBadge';
 *   <DemoBadge />           // Default: "DEMO — No real data"
 *   <DemoBadge label="Coming Soon" />
 *   <DemoBadge label="Testnet only" variant="warning" />
 */

interface DemoBadgeProps {
  label?: string;
  variant?: 'demo' | 'warning' | 'coming-soon';
  className?: string;
}

const STYLES: Record<string, React.CSSProperties> = {
  demo: {
    background: '#f59e0b',
    color: '#000',
  },
  warning: {
    background: '#ef4444',
    color: '#fff',
  },
  'coming-soon': {
    background: '#6366f1',
    color: '#fff',
  },
};

export function DemoBadge({
  label = 'DEMO — No real data',
  variant = 'demo',
  className,
}: DemoBadgeProps) {
  return (
    <span
      className={className}
      style={{
        ...STYLES[variant],
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      aria-label={label}
    >
      {label}
    </span>
  );
}
