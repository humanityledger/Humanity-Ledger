import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function NetworkStatusPage() {
  return (
    <AztecDocPage
      eyebrow="Network — System Status"
      title="Platform Health"
      subtitle="Live status of the Ledger Chat infrastructure. We commit to maximum transparency about uptime, incidents, and service degradations."
      sections={[
        {
          id: 'components',
          title: 'Platform Components',
          paragraphs: [
            'The Ledger Chat platform is composed of several independent services. Each is monitored continuously. This page describes what each component does and what a failure would mean for users.',
          ],
          bullets: [
            'Message Relay — The XMTP-based service that routes encrypted messages between users. Degradation here means messages are delayed or undelivered.',
            'API Server — The backend that powers authentication, communities, permissions, and account management. Degradation here means you may not be able to log in or load your community list.',
            'WebRTC Signaling — The coordination service that helps two devices establish a direct voice or video call. Degradation here means calls may fail to connect.',
            'Database — The PostgreSQL database storing community metadata, member lists, and channel structure. Note: message content is not stored here.',
            'Push Notifications — The service that sends alerts to mobile and desktop clients when you receive a new message.',
          ],
        },
        {
          id: 'incidents',
          title: 'Incident Response',
          paragraphs: [
            'When any component of the platform experiences a failure or significant performance degradation, we will publish an incident update on this page within fifteen minutes of detection.',
            'We will continue updating the status page at regular intervals until the incident is resolved. After resolution, we will publish a post-incident summary explaining what happened, why it happened, and what we have done to prevent it from recurring.',
          ],
        },
        {
          id: 'commitments',
          title: 'Uptime Commitments',
          paragraphs: [
            'We target 99.9% uptime for all platform components. This allows for approximately 8.7 hours of scheduled maintenance per year.',
            'Planned maintenance windows will be announced at least 48 hours in advance and will be scheduled during low-traffic periods to minimize disruption.',
          ],
          callout: {
            title: 'Your Data During Downtime',
            body: 'Because messages are stored locally on your device, a platform outage does not cause message loss. Any messages sent during an outage will be queued and delivered once the relay service is restored.',
          },
        },
        {
          id: 'payments-resilience',
          title: 'Crypto Payment Resilience',
          paragraphs: [
            'Crypto payments are settled directly on the Ethereum blockchain and do not depend on Humanity Ledger infrastructure. If our platform is entirely offline, a transaction that has already been submitted to the blockchain will still confirm and settle normally.',
            'The payment receipt in the chat window may not update until the platform recovers, but the funds will have moved regardless.',
          ],
        },
      ]}
    />
  );
}
