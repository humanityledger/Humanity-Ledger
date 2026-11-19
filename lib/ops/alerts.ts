/**
 * Package 6: alert rules for the closed alpha, pure so they are tested without Redis or a node.
 * Inputs are measured counts from the last 24 hours (lib/ops/counters.ts) and how long the Aztec
 * node's block number has not moved. Thresholds are proposals for Stefan to sign, like the targets
 * in docs/alpha/TESTER_MISSIONS.md.
 */
export const ALERT_THRESHOLDS = {
  /** Payments: alert when more than 10 % of at least 5 attempts failed. */
  paymentFailShare: 0.1,
  paymentMinAttempts: 5,
  /** Messages: alert when more than 5 % of at least 20 send reports are failures. */
  deliveryFailShare: 0.05,
  deliveryMinReports: 20,
  /** Node: alert when the block number has not moved for 10 minutes. */
  nodeStalledSeconds: 600,
} as const;

export type AlertKey = 'payment_failures' | 'delivery_failures' | 'node_stalled' | 'node_unreachable';
export interface Alert { key: AlertKey; detail: string }

export interface AlertInput {
  payments: Record<string, number>;
  delivery: Record<string, number>;
  /** null when the node did not answer. */
  nodeStalledSeconds: number | null;
}

export function alphaAlerts(i: AlertInput, t = ALERT_THRESHOLDS): Alert[] {
  const out: Alert[] = [];
  const attempted = i.payments.attempted ?? 0;
  const failed = i.payments.failed ?? 0;
  if (attempted >= t.paymentMinAttempts && failed / attempted > t.paymentFailShare) {
    out.push({ key: 'payment_failures', detail: `${failed} of ${attempted} payments failed in 24 h` });
  }
  const sendFailures = (i.delivery.send_failed ?? 0) + (i.delivery.publish_gave_up ?? 0);
  const sendReports = sendFailures + (i.delivery.send_published ?? 0);
  if (sendReports >= t.deliveryMinReports && sendFailures / sendReports > t.deliveryFailShare) {
    out.push({ key: 'delivery_failures', detail: `${sendFailures} of ${sendReports} send reports were failures in 24 h` });
  }
  if (i.nodeStalledSeconds === null) out.push({ key: 'node_unreachable', detail: 'the Aztec node did not answer' });
  else if (i.nodeStalledSeconds > t.nodeStalledSeconds) out.push({ key: 'node_stalled', detail: `no new block for ${Math.round(i.nodeStalledSeconds / 60)} min` });
  return out;
}
